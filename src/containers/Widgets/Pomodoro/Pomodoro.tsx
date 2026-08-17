import React, { useEffect, useRef, useState } from "react";
import { assetUrl } from "../../../utils/assetUrl";
import { Button } from "../../../components/Button/Button";
import { useAppContext } from "../../../contexts/AppContext";
import { isPomodoroImageKey } from "../../../config/widgetConfig";
import { POMODORO_STATE_KEY } from "../../../utils/pomodoroMode";
import {
  isHighlightTextColor,
  resolveForeground,
} from "../../../utils/textHighlight";
import { useT } from "../../../i18n/i18n";
import { CloseIcon } from "../../../components/Icons/Icons";
import { CenterFocusStrongIcon, PauseCircleIcon, PlayCircleFilledWhiteIcon, ReplayCircleFilledIcon } from "../../../components/Icons/Icons";
import {
  playPomodoroChime,
  primePomodoroAudio,
  isPomodoroSoundKey,
  type PomodoroSoundKey,
} from "../../../utils/pomodoroChime";
import {
  POMODORO_LEGACY_DIMS,
  type PomodoroSize,
} from "../../../config/widgetConfig";
import "./Pomodoro.css";

const DEFAULT_POMODORO_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

const POMODORO_IMAGES = [
  "catbus.gif",
  "chibi.gif",
  "heen.gif",
  "mei.gif",
  "noface.gif",
  "sootsprite.gif",
];

/** The sticker for this break: the one the user picked, or a fresh
 *  random pick when they have not picked (the original behaviour, and
 *  still the default). */
const pickTimerImage = (choice: unknown): string =>
  isPomodoroImageKey(choice) && choice !== "random"
    ? `${choice}.gif`
    : POMODORO_IMAGES[Math.floor(Math.random() * POMODORO_IMAGES.length)];

// ---------------------------------------------------------------------------
// Single-key persistence + cross-tab sync.
// One JSON blob in localStorage replaces the 8 individual pomodoro_*
// keys this component used to scatter. The `storage` event still fires
// across tabs whenever the blob is rewritten - followers diff against
// the previous value to apply granular updates.
// ---------------------------------------------------------------------------

// Shared with the edit panel, which reads the mode to open its
// Background control on the right surface.
const POMODORO_KEY = POMODORO_STATE_KEY;

interface PomodoroBlob {
  /** Tab id of the leader (the tab that runs the countdown). null = no
   *  leader; the next tab that ticks claims it. */
  leader: string | null;
  isRunning: boolean;
  isBreak: boolean;
  /** Concentration mode - persisted so cross-tab sync mirrors entry/
   *  exit, but defensively cleared on mount (see init effect below). */
  focusMode: boolean;
  pomodoroSeconds: number;
  breakSeconds: number;
  pomodoroOriginal: number;
  breakOriginal: number;
}

const DEFAULT_POMODORO: PomodoroBlob = {
  leader: null,
  isRunning: false,
  isBreak: false,
  focusMode: false,
  pomodoroSeconds: DEFAULT_POMODORO_MINUTES * 60,
  breakSeconds: DEFAULT_BREAK_MINUTES * 60,
  pomodoroOriginal: DEFAULT_POMODORO_MINUTES * 60,
  breakOriginal: DEFAULT_BREAK_MINUTES * 60,
};

const readPomodoro = (): PomodoroBlob => {
  try {
    const raw = localStorage.getItem(POMODORO_KEY);
    if (raw) return { ...DEFAULT_POMODORO, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_POMODORO };
};

const writePomodoro = (patch: Partial<PomodoroBlob>) => {
  const next = { ...readPomodoro(), ...patch };
  try {
    localStorage.setItem(POMODORO_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};

// One-time migration: collapse the 8 legacy `pomodoro_*` / `break_*`
// keys into the new single blob, then remove the originals. Idempotent:
// once `ghiblify_pomodoro` exists this is a no-op (and a sweep of any
// stragglers).
const migrateLegacyPomodoro = () => {
  const LEGACY = [
    "pomodoro_seconds_left",
    "break_seconds_left",
    "pomodoro_is_running",
    "pomodoro_is_break",
    "pomodoro_original_seconds",
    "break_original_seconds",
    "pomodoro_focus_mode",
    "pomodoro_leader",
  ];
  try {
    if (localStorage.getItem(POMODORO_KEY)) {
      LEGACY.forEach((k) => localStorage.removeItem(k));
      return;
    }
    const has = LEGACY.some((k) => localStorage.getItem(k) !== null);
    if (!has) return;
    const num = (k: string, fallback: number) => {
      const v = localStorage.getItem(k);
      const n = v == null ? NaN : parseInt(v, 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const blob: PomodoroBlob = {
      leader: localStorage.getItem("pomodoro_leader"),
      isRunning: localStorage.getItem("pomodoro_is_running") === "true",
      isBreak: localStorage.getItem("pomodoro_is_break") === "true",
      focusMode: localStorage.getItem("pomodoro_focus_mode") === "true",
      pomodoroSeconds: num("pomodoro_seconds_left", DEFAULT_POMODORO_MINUTES * 60),
      breakSeconds: num("break_seconds_left", DEFAULT_BREAK_MINUTES * 60),
      pomodoroOriginal: num(
        "pomodoro_original_seconds",
        DEFAULT_POMODORO_MINUTES * 60
      ),
      breakOriginal: num("break_original_seconds", DEFAULT_BREAK_MINUTES * 60),
    };
    localStorage.setItem(POMODORO_KEY, JSON.stringify(blob));
    LEGACY.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};
migrateLegacyPomodoro();

const Pomodoro: React.FC = () => {
  const t = useT();
  // State for timer input value
  const [inputValue, setInputValue] = useState<string>("");
  // Concentration / focus mode - hides everything else and centers
  // the pomodoro widget. Toggled via a button on the widget; Esc
  // exits. Persisted to localStorage so opening a new tab while
  // focus mode is on keeps the user in focus across tabs.
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    try {
      return readPomodoro().focusMode === true;
    } catch {
      return false;
    }
  });
  // Unique tab ID for leader election
  const [tabId] = useState(() => Math.random().toString(36).slice(2));
  const [isLeader, setIsLeader] = useState(false);

  // Leader election: only one tab writes the countdown.
  useEffect(() => {
    const initial = readPomodoro();
    if (!initial.leader) {
      writePomodoro({ leader: tabId });
      setIsLeader(true);
    } else if (initial.leader === tabId) {
      setIsLeader(true);
    } else {
      setIsLeader(false);
    }
    // Release leadership on unload if this tab held it.
    const onUnload = () => {
      if (readPomodoro().leader === tabId) {
        writePomodoro({ leader: null });
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (readPomodoro().leader === tabId) {
        writePomodoro({ leader: null });
      }
    };
  }, [tabId]);

  // --- State initialization from the single blob ---
  const initial = useRef<PomodoroBlob>(readPomodoro());
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(
    initial.current.pomodoroSeconds
  );
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(
    initial.current.breakSeconds
  );
  const [isRunning, setIsRunning] = useState(initial.current.isRunning);
  const [isBreak, setIsBreak] = useState(initial.current.isBreak);
  const intervalRef = useRef<number | null>(null);

  // --- Completion chime ---------------------------------------------
  // Settings are mirrored into a ref because the countdown effect below
  // closes over its deps ([isLeader, isRunning, isBreak, tabId]) and
  // would otherwise fire with whatever sound was configured when the
  // interval was created, not when it finished.
  const chimeSettingsRef = useRef<{
    sound: PomodoroSoundKey;
    volume: number;
  }>({ sound: "musicbox", volume: 70 });
  // Guards against a double chime. The 0-crossing is detected inside a
  // setState updater, and React invokes updaters twice under StrictMode
  // in development - so the flag makes the call idempotent per run and
  // startTimer/resetTimer re-arm it.
  const chimeArmedRef = useRef(true);

  /** Fire the completion chime once, off the render path.
   *
   *  Called from inside a state updater, so the actual playback is
   *  deferred to a microtask: scheduling Web Audio work during render
   *  is a side effect in a place React expects purity. */
  const fireChime = () => {
    if (!chimeArmedRef.current) return;
    chimeArmedRef.current = false;
    queueMicrotask(() => {
      const { sound, volume } = chimeSettingsRef.current;
      playPomodoroChime(sound, volume);
    });
  };

  const [pomodoroOriginalSecondsState, setPomodoroOriginalSecondsState] =
    useState<number>(initial.current.pomodoroOriginal);
  const [breakOriginalSecondsState, setBreakOriginalSecondsState] =
    useState<number>(initial.current.breakOriginal);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // --- Only leader writes the per-second countdown ---
  useEffect(() => {
    if (isLeader) {
      writePomodoro({
        pomodoroSeconds: pomodoroSecondsLeft,
        breakSeconds: breakSecondsLeft,
      });
    }
  }, [pomodoroSecondsLeft, breakSecondsLeft, isLeader]);

  // --- All tabs broadcast running / break-mode toggles ---
  useEffect(() => {
    writePomodoro({ isRunning });
  }, [isRunning]);

  useEffect(() => {
    writePomodoro({ isBreak });
  }, [isBreak]);

  // --- Listen for blob changes from other tabs ---
  // The blob writes once per change, so we get one storage event with
  // the full new value. Diff against current state and apply pieces.
  useEffect(() => {
    const syncState = (e: StorageEvent) => {
      if (e.key !== POMODORO_KEY || !e.newValue) return;
      let next: PomodoroBlob;
      try {
        next = { ...DEFAULT_POMODORO, ...JSON.parse(e.newValue) };
      } catch {
        return;
      }
      // Leader assignment - react when a different tab claims/releases.
      setIsLeader(next.leader === tabId);
      // Followers mirror the leader's countdown.
      if (next.leader !== tabId) {
        setPomodoroSecondsLeft(next.pomodoroSeconds);
        setBreakSecondsLeft(next.breakSeconds);
      }
      setIsRunning(next.isRunning);
      setIsBreak(next.isBreak);
      setPomodoroOriginalSecondsState(next.pomodoroOriginal);
      setBreakOriginalSecondsState(next.breakOriginal);
      setFocusMode(next.focusMode);
    };
    window.addEventListener("storage", syncState);
    return () => window.removeEventListener("storage", syncState);
  }, [tabId]);

  useEffect(() => {
    if (!isRunning) {
      if (isBreak && breakSecondsLeft === 0) {
        setBreakSecondsLeft(DEFAULT_BREAK_MINUTES * 60);
      }
      if (!isBreak && pomodoroSecondsLeft === 0) {
        setPomodoroSecondsLeft(DEFAULT_POMODORO_MINUTES * 60);
      }
    }
  }, [isBreak, isRunning, breakSecondsLeft, pomodoroSecondsLeft]);

  const releaseLeader = () => {
    if (readPomodoro().leader === tabId) {
      writePomodoro({ leader: null });
      setIsLeader(false);
    }
  };

  const claimLeader = () => {
    writePomodoro({ leader: tabId });
    setIsLeader(true);
    if (isRunning) {
      setIsRunning((prev) => prev);
    }
  };

  const startTimer = () => {
    // Open the audio context while this click is still on the stack.
    // Chrome requires user activation to start audio, and the chime is
    // 25 minutes away - far outside the activation window - so the
    // context has to be unsuspended here rather than at playback.
    primePomodoroAudio();
    chimeArmedRef.current = true;
    claimLeader();
    writePomodoro(
      isBreak
        ? { breakSeconds: breakSecondsLeft }
        : { pomodoroSeconds: pomodoroSecondsLeft }
    );
    if (!isRunning) {
      setIsRunning(true);
    }
  };

  useEffect(() => {
    if (isLeader && isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (isBreak) {
          setBreakSecondsLeft((prev) => {
            if (prev > 0) return prev - 1;
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            // Only the leader tab runs this interval, so the chime
            // sounds once no matter how many new tabs are open -
            // followers just mirror the countdown via `storage`.
            fireChime();
            setIsRunning(false);
            setIsBreak(false);
            // The period ending is a mode change like any other, so the
            // edit panel's tab follows it too.
            window.dispatchEvent(
              new CustomEvent("ghiblify:pomodoro:mode", { detail: "focus" }),
            );
            setPomodoroSecondsLeft(DEFAULT_POMODORO_MINUTES * 60);
            if (readPomodoro().leader === tabId) {
              writePomodoro({ leader: null });
              setIsLeader(false);
            }
            return prev;
          });
        } else {
          setPomodoroSecondsLeft((prev) => {
            if (prev > 0) return prev - 1;
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            fireChime();
            setIsRunning(false);
            setIsBreak(true);
            window.dispatchEvent(
              new CustomEvent("ghiblify:pomodoro:mode", { detail: "break" }),
            );
            setBreakSecondsLeft(DEFAULT_BREAK_MINUTES * 60);
            if (readPomodoro().leader === tabId) {
              writePomodoro({ leader: null });
              setIsLeader(false);
            }
            return prev;
          });
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLeader, isRunning, isBreak, tabId]);

  const pauseTimer = () => {
    // Save current seconds left when pausing.
    writePomodoro(
      isBreak
        ? { breakSeconds: breakSecondsLeft }
        : { pomodoroSeconds: pomodoroSecondsLeft }
    );
    releaseLeader();
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resetTimer = () => {
    claimLeader();
    chimeArmedRef.current = true;
    setIsRunning(false);
    if (isBreak) {
      const v = DEFAULT_BREAK_MINUTES * 60;
      setBreakSecondsLeft(v);
      setBreakOriginalSecondsState(v);
      writePomodoro({ breakSeconds: v, breakOriginal: v });
    } else {
      const v = DEFAULT_POMODORO_MINUTES * 60;
      setPomodoroSecondsLeft(v);
      setPomodoroOriginalSecondsState(v);
      writePomodoro({ pomodoroSeconds: v, pomodoroOriginal: v });
    }
  };

  // Helper to get current seconds left
  const getCurrentSecondsLeft = () =>
    isBreak ? breakSecondsLeft : pomodoroSecondsLeft;
  const setCurrentSecondsLeft = (val: number) => {
    if (!isRunning) {
      claimLeader();
    }
    if (isBreak) {
      setBreakSecondsLeft(val);
      writePomodoro({ breakSeconds: val, breakOriginal: val });
    } else {
      setPomodoroSecondsLeft(val);
      writePomodoro({ pomodoroSeconds: val, pomodoroOriginal: val });
    }
  };

  const minutesLeft = Math.floor(getCurrentSecondsLeft() / 60);

  // Progress bar - driven entirely by the locally-mirrored *State
  // values, which the storage event keeps in sync across tabs.
  const totalSeconds = isBreak
    ? breakOriginalSecondsState
    : pomodoroOriginalSecondsState;
  const progressPercent = 100 * (1 - getCurrentSecondsLeft() / totalSeconds);

  // Toggle the focus-mode body class so app-wide CSS can hide other
  // widgets and dim the background while concentration mode is on.
  // Persisted into the shared blob so other tabs pick up the change
  // via the unified storage listener above.
  useEffect(() => {
    if (focusMode) {
      document.body.classList.add("pomodoro-focus");
    } else {
      document.body.classList.remove("pomodoro-focus");
    }
    writePomodoro({ focusMode });
    // The edit panel greys its Background control while this is on -
    // the card has no surface to colour in concentration mode.
    window.dispatchEvent(
      new CustomEvent("ghiblify:pomodoro:focus", { detail: focusMode }),
    );
    return () => {
      document.body.classList.remove("pomodoro-focus");
    };
  }, [focusMode]);

  // When Pomodoro unmounts because the user HID the widget, clear
  // focus mode so the body class doesn't get stuck with no Pomodoro
  // to dismiss it from. But when unmount is part of a tab close
  // (beforeunload fired first), leave the persisted flag alone - we
  // want focus mode to carry over to the next new-tab so the user
  // stays focused across tabs.
  useEffect(() => {
    let isUnloading = false;
    const onBeforeUnload = () => {
      isUnloading = true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (!isUnloading) {
        document.body.classList.remove("pomodoro-focus");
        writePomodoro({ focusMode: false });
      }
    };
  }, []);

  // Esc exits focus mode
  useEffect(() => {
    if (!focusMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [focusMode]);

  // Right-click → "Enter/Exit focus mode" in the widget context menu
  // dispatches this event (Widget.tsx can't reach into Pomodoro's local
  // state directly). Toggle here so the menu item actually does
  // something.
  useEffect(() => {
    const handler = () => setFocusMode((v) => !v);
    window.addEventListener("ghiblify:pomodoro:toggle-focus", handler);
    return () =>
      window.removeEventListener("ghiblify:pomodoro:toggle-focus", handler);
  }, []);

  // Sync inputValue with timer when timer resets or changes
  useEffect(() => {
    if (!isRunning) {
      // If timer is at default or zero, show that in input
      if (
        getCurrentSecondsLeft() === 0 ||
        (!isBreak &&
          getCurrentSecondsLeft() === DEFAULT_POMODORO_MINUTES * 60) ||
        (isBreak && getCurrentSecondsLeft() === DEFAULT_BREAK_MINUTES * 60)
      ) {
        setInputValue(minutesLeft.toString());
      }
    }
  }, [isRunning, isBreak, pomodoroSecondsLeft, breakSecondsLeft]);

  // The card free-resizes from the canvas handle, like todo and notes.
  // Everything inside is sized in container-query units against the
  // card's own width (see Pomodoro.css), so there are no breakpoints
  // to land on - it just scales.
  const { widgets } = useAppContext();
  const {
    width,
    height,
    size,
    opacity,
    sound,
    soundVolume,
    cardColor,
    textColor,
    breakColor,
    breakOpacity,
    breakTextColor,
    blur: focusBlur,
    breakBlur,
    timerImage: imageChoice,
  } = widgets.pomodoro.settings;

  // Changing mode, in one place: the two header labels, and the edit
  // panel's Focus / Break switch, which drives this through
  // `ghiblify:pomodoro:mode` so the card shows the surface being
  // edited. Refused while the timer runs - the header has always
  // refused there, and a colour preview is not a reason to end
  // someone's session.
  const switchMode = React.useCallback(
    (toBreak: boolean) => {
      if (isRunning || toBreak === isBreak) return;
      setIsBreak(toBreak);
      const key = toBreak ? "break_seconds_left" : "pomodoro_seconds_left";
      const fallback =
        (toBreak ? DEFAULT_BREAK_MINUTES : DEFAULT_POMODORO_MINUTES) * 60;
      const stored = localStorage.getItem(key);
      const value = stored ? parseInt(stored) : fallback;
      const next = value === 0 ? fallback : value;
      if (toBreak) setBreakSecondsLeft(next);
      else setPomodoroSecondsLeft(next);
      localStorage.setItem(key, next.toString());
    },
    [isRunning, isBreak],
  );

  // The edit panel asks for a mode; the panel also listens, so a click
  // on the card's own header moves its tab. Same event both ways.
  useEffect(() => {
    const onMode = (e: Event) => {
      const mode = (e as CustomEvent<"focus" | "break">).detail;
      if (mode === "focus" || mode === "break") switchMode(mode === "break");
    };
    window.addEventListener("ghiblify:pomodoro:mode", onMode as EventListener);
    return () =>
      window.removeEventListener(
        "ghiblify:pomodoro:mode",
        onMode as EventListener,
      );
  }, [switchMode]);

  // The break sticker. A specific choice is honoured; "random" (or no
  // choice at all) re-rolls on every mode flip, as it always did.
  const [timerImage, settimerImage] = useState<string>(() =>
    initial.current.isBreak ? pickTimerImage(imageChoice) : "",
  );

  // Re-resolve when the mode flips, and when the setting changes - so
  // picking a character in the edit panel swaps the sticker on screen
  // instead of waiting for the next break.
  useEffect(() => {
    settimerImage(pickTimerImage(imageChoice));
  }, [isBreak, imageChoice]);


  // Keep the countdown effect's view of the chime settings current -
  // see chimeSettingsRef above. Validated on the way in because stored
  // settings can predate this feature (undefined) or carry a sound key
  // that no longer exists.
  useEffect(() => {
    chimeSettingsRef.current = {
      sound: isPomodoroSoundKey(sound) ? sound : "musicbox",
      volume: typeof soundVolume === "number" ? soundVolume : 70,
    };
  }, [sound, soundVolume]);
  // Footprint. Width/height are the source of truth; `size` is only
  // consulted for a blob written before free-resize existed, so that a
  // user who had picked "small" opens on a small card instead of
  // snapping to the default. Legacy names from an earlier rename
  // ("compact" / "regular") aren't in the map and fall through to the
  // default, which is what they normalised to anyway.
  const legacy =
    typeof size === "string"
      ? POMODORO_LEGACY_DIMS[size as PomodoroSize]
      : undefined;
  const dims = {
    width: typeof width === "number" ? width : (legacy?.width ?? 220),
    height: typeof height === "number" ? height : (legacy?.height ?? 260),
  };

  // Focus mode forces a single static, near-fullscreen layout - the
  // overrides live in Pomodoro.css under `body.pomodoro-focus`, so we
  // must NOT emit the inline width/height (inline styles would beat
  // the focus stylesheet since they have higher CSS priority than
  // non-!important rules).
  return (
    <div
      className={`pomodoro-widget widget-header${
        isBreak ? " break-mode" : ""
      }${
        // A user-picked card colour applies to BOTH modes - the
        // break-mode surface recolor rules skip .custom-card, so the
        // card keeps the chosen colour (and its light text) during
        // breaks. The break progress-bar gradient stays as the mode
        // signal.
        // Each mode has its OWN surface now, so "custom" is decided
        // per mode rather than one flag covering both.
        (isBreak ? typeof breakColor === "string" : typeof cardColor === "string")
          ? " custom-card"
          : ""
      }`}
      style={{
        ...(focusMode
          ? {}
          : { width: `${dims.width}px`, height: `${dims.height}px` }),
        // Focus and break each carry their own alpha; the active mode
        // publishes into the single var the CSS reads.
        ["--pomodoro-opacity" as string]:
          ((isBreak
            ? typeof breakOpacity === "number"
              ? breakOpacity
              : 100
            : typeof opacity === "number"
              ? opacity
              : 100) as number) / 100,
        // Wallpaper blur behind the card, per mode, from the Background
        // row's blur slider - the CSS used to hard-code 30px and ignore
        // this setting.
        ["--pomodoro-blur" as string]:
          ((isBreak
            ? typeof breakBlur === "number"
              ? breakBlur
              : 0
            : typeof focusBlur === "number"
              ? focusBlur
              : 0) as number) / 100,
        ...(() => {
          const colour = isBreak ? breakColor : cardColor;
          const mode = isBreak ? breakTextColor : textColor;
          const out: Record<string, string> = {};
          if (typeof colour === "string") {
            out["--pomodoro-card"] = colour;
            // Ink follows the surface, so a pale card gets dark text
            // instead of the light default.
            const ink = resolveForeground(
              colour,
              isHighlightTextColor(mode) ? mode : "auto",
            );
            out["--pomodoro-ink"] = ink;
            // Most of Pomodoro's text and borders read var(--light)
            // rather than a widget-scoped token, so rebinding it here
            // is what actually makes the digits, labels and controls
            // follow the surface. Scoped to this element, and only
            // while a custom colour is set - the built-in focus and
            // break cards already ship tuned ink.
            out["--light"] = ink;
          } else if (mode === "light") {
            out["--pomodoro-ink"] = "#f7f3ea";
            out["--light"] = "#f7f3ea";
          } else if (mode === "dark") {
            out["--pomodoro-ink"] = "#1f2420";
            out["--light"] = "#1f2420";
          }
          return out;
        })(),
      }}
    >
      <div className="pomodoro-switch-header">
        <h2
          className={isBreak ? "inactive-mode" : "active-mode"}
          style={{ cursor: isRunning ? "not-allowed" : "pointer" }}
          onClick={() => {
            switchMode(false);
            window.dispatchEvent(
              new CustomEvent("ghiblify:pomodoro:mode", { detail: "focus" }),
            );
          }}
        >
          {t("pomodoro.modeFocus")}
        </h2>
        <h2
          className={isBreak ? "active-mode" : "inactive-mode"}
          style={{ cursor: isRunning ? "not-allowed" : "pointer" }}
          onClick={() => {
            switchMode(true);
            window.dispatchEvent(
              new CustomEvent("ghiblify:pomodoro:mode", { detail: "break" }),
            );
          }}
        >
          {t("pomodoro.modeBreak")}
        </h2>
      </div>

      {timerImage &&
        (() => {
          const imageSources: Record<string, string> = {
            "noface.gif":
              "https://giphy.com/stickers/ghibli-spirited-away-youyuan-ZGL0eNpGsmzCWd2q3o",
            "mei.gif":
              "https://giphy.com/stickers/pixel-8bit-sprite-gl2Pu1StPljmi561zN",
            "catbus.gif": "https://mx.pinterest.com/pin/6051780743226023/",
            "chibi.gif": "https://mx.pinterest.com/pin/605452743689055326/",
            "heen.gif": "https://mx.pinterest.com/pin/3377768467345470/",
            "sootsprite.gif": "https://mx.pinterest.com/pin/10344274145706593/",
          };
          const sourceUrl = imageSources[timerImage] || "";
          // Real pause: when the timer isn't running, render the
          // first-frame PNG instead of the GIF so the character
          // actually stops moving. Stills live in the same folder
          // as the GIFs with `-still.png` suffix.
          const stillName = timerImage.replace(/\.gif$/, "-still.png");
          const src = isRunning
            ? assetUrl(`/assets/pomodoro/${timerImage}`)
            : assetUrl(`/assets/pomodoro/${stillName}`);
          return (
            <img
              src={src}
              alt={isBreak ? t("pomodoro.modeBreak") : t("pomodoro.modeFocus")}
              className="timer-image"
              title={sourceUrl}
            />
          );
        })()}
      <div className="timer-display">
        {!isRunning &&
        (getCurrentSecondsLeft() === 0 ||
          getCurrentSecondsLeft() === totalSeconds) ? (
          <div className="timer-input-row">
            <input
              id="pomodoro-minutes"
              type="number"
              value={inputValue}
              placeholder={minutesLeft.toString()}
              onChange={(e) => {
                if (!isRunning) {
                  const val = e.target.value;
                  setInputValue(val);
                  if (!isLeader) {
                    claimLeader();
                  }
                  if (val === "") {
                    return;
                  }
                  const num = parseInt(val);
                  if (isNaN(num)) return;
                  setCurrentSecondsLeft(Math.max(0, num) * 60);
                  // Update original seconds state for progress bar
                  if (isBreak) {
                    setBreakOriginalSecondsState(Math.max(0, num) * 60);
                  } else {
                    setPomodoroOriginalSecondsState(Math.max(0, num) * 60);
                  }
                }
              }}
              onBlur={() => {
                claimLeader();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  claimLeader();
                }
              }}
            />
            <span className="timer-mins-label">{t("pomodoro.minsLabel")}</span>
          </div>
        ) : (
          formatTime(getCurrentSecondsLeft())
        )}
      </div>
      <div className="controls">
        {isRunning ? (
          <Button
            onClick={pauseTimer}
            disabled={!isRunning}
            variant="transparent"
            className="pomodoro-control-btn"
            aria-label={t("pomodoro.pauseAria")}
          >
            <PauseCircleIcon />
            <span>{t("pomodoro.pause")}</span>
          </Button>
        ) : (
          <Button
            onClick={startTimer}
            disabled={isRunning}
            variant="transparent"
            className="pomodoro-control-btn"
            aria-label={t("pomodoro.playAria")}
          >
            <PlayCircleFilledWhiteIcon />
            <span>{t("pomodoro.play")}</span>
          </Button>
        )}
        <Button
          onClick={resetTimer}
          variant="transparent"
          disabled={isRunning}
          className="pomodoro-control-btn pomodoro-control-btn-icon"
          aria-label={t("pomodoro.resetAria")}
          data-tooltip={t("pomodoro.reset")}
        >
          <ReplayCircleFilledIcon />
        </Button>
        <Button
          onClick={() => setFocusMode((f) => !f)}
          variant="transparent"
          className="pomodoro-control-btn pomodoro-control-btn-icon pomodoro-focus-btn"
          aria-label={focusMode ? t("pomodoro.focusAriaExit") : t("pomodoro.focusAriaEnter")}
          aria-pressed={focusMode}
          data-tooltip={focusMode ? t("pomodoro.focusTooltipExit") : t("pomodoro.focusTooltipEnter")}
        >
          {focusMode ? <CloseIcon /> : <CenterFocusStrongIcon />}
        </Button>
      </div>
      <div className="pomodoro-progress-bar-container">
        <div
          className="pomodoro-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export default Pomodoro;
