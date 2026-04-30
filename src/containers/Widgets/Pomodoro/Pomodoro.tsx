import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import CloseIcon from "@mui/icons-material/Close";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PlayCircleFilledWhiteIcon from "@mui/icons-material/PlayCircleFilledWhite";
import ReplayCircleFilledIcon from "@mui/icons-material/ReplayCircleFilled";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button/Button";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
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

// ---------------------------------------------------------------------------
// Single-key persistence + cross-tab sync.
// One JSON blob in localStorage replaces the 8 individual pomodoro_*
// keys this component used to scatter. The `storage` event still fires
// across tabs whenever the blob is rewritten — followers diff against
// the previous value to apply granular updates.
// ---------------------------------------------------------------------------

const POMODORO_KEY = "ghiblify_pomodoro";

interface PomodoroBlob {
  /** Tab id of the leader (the tab that runs the countdown). null = no
   *  leader; the next tab that ticks claims it. */
  leader: string | null;
  isRunning: boolean;
  isBreak: boolean;
  /** Concentration mode — persisted so cross-tab sync mirrors entry/
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
  // Concentration / focus mode — hides everything else and centers
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [pomodoroOriginalSecondsState, setPomodoroOriginalSecondsState] =
    useState<number>(initial.current.pomodoroOriginal);
  const [breakOriginalSecondsState, setBreakOriginalSecondsState] =
    useState<number>(initial.current.breakOriginal);

  // Pick a random break image each break period
  const [timerImage, settimerImage] = useState<string>(() => {
    if (initial.current.isBreak) {
      const idx = Math.floor(Math.random() * POMODORO_IMAGES.length);
      return POMODORO_IMAGES[idx];
    }
    return "";
  });

  // When mode switches (Pomodoro <-> Break), pick a new image
  useEffect(() => {
    const idx = Math.floor(Math.random() * POMODORO_IMAGES.length);
    settimerImage(POMODORO_IMAGES[idx]);
  }, [isBreak]);

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
      // Leader assignment — react when a different tab claims/releases.
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
            setIsRunning(false);
            setIsBreak(false);
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
            setIsRunning(false);
            setIsBreak(true);
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

  // Progress bar — driven entirely by the locally-mirrored *State
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
    return () => {
      document.body.classList.remove("pomodoro-focus");
    };
  }, [focusMode]);

  // When Pomodoro unmounts because the user HID the widget, clear
  // focus mode so the body class doesn't get stuck with no Pomodoro
  // to dismiss it from. But when unmount is part of a tab close
  // (beforeunload fired first), leave the persisted flag alone — we
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

  // Pomodoro snaps to one of three discrete size presets — small,
  // medium, large — picked from the right-click menu or the edit
  // overlay. Each preset has its own crafted layout
  // (see Pomodoro.css `.size-small` etc.), so we don't expose a
  // free-resize handle.
  // Stored values from before the rename ("compact" / "regular")
  // get normalised to the new names so existing users don't see a
  // jarring layout shift on first open after the rename.
  const { widgets } = useAppContext();
  const { size, opacity } = widgets.pomodoro.settings;
  // Cast through string so legacy stored values from before the rename
  // ("compact" / "regular") still match — the type system sees only the
  // new union, but storage may carry the old labels.
  // Anything that isn't a known current size collapses to "medium" so
  // the default experience is medium for both fresh users (config
  // default is "medium") and users carrying over a legacy value.
  const sizeStr = size as unknown as string;
  const normalizedSize: "small" | "medium" | "large" =
    sizeStr === "small" || sizeStr === "medium" || sizeStr === "large"
      ? sizeStr
      : "medium";
  const SIZE_DIMS: Record<string, { width: number; height: number }> = {
    small: { width: 160, height: 200 },
    medium: { width: 220, height: 260 },
    large: { width: 300, height: 340 },
  };
  const dims = SIZE_DIMS[normalizedSize];

  // Focus mode forces a single static, near-fullscreen layout regardless
  // of the size preset — the overrides live in Pomodoro.css under
  // `body.pomodoro-focus`, so we must NOT emit the size-* class or the
  // inline width/height (inline styles would beat the focus stylesheet
  // since they have higher CSS priority than non-!important rules).
  return (
    <div
      className={`pomodoro-widget widget-header${
        focusMode ? "" : ` size-${normalizedSize}`
      }${isBreak ? " break-mode" : ""}`}
      style={{
        ...(focusMode
          ? {}
          : { width: `${dims.width}px`, height: `${dims.height}px` }),
        ["--pomodoro-opacity" as string]:
          (typeof opacity === "number" ? opacity : 100) / 100,
      }}
    >
      <div className="pomodoro-switch-header">
        <h2
          className={isBreak ? "inactive-mode" : "active-mode"}
          style={{ cursor: isRunning ? "not-allowed" : "pointer" }}
          onClick={() => {
            // When switching to Pomodoro, reset to default
            if (!isRunning && isBreak) {
              setIsBreak(false);
              const stored = localStorage.getItem("pomodoro_seconds_left");
              const value = stored
                ? parseInt(stored)
                : DEFAULT_POMODORO_MINUTES * 60;
              setPomodoroSecondsLeft(
                value === 0 ? DEFAULT_POMODORO_MINUTES * 60 : value
              );
              localStorage.setItem(
                "pomodoro_seconds_left",
                (value === 0 ? DEFAULT_POMODORO_MINUTES * 60 : value).toString()
              );
            }
          }}
        >
          {t("pomodoro.modeFocus")}
        </h2>
        <h2
          className={isBreak ? "active-mode" : "inactive-mode"}
          style={{ cursor: isRunning ? "not-allowed" : "pointer" }}
          onClick={() => {
            // When switching to Break, reset to default
            if (!isRunning && !isBreak) {
              setIsBreak(true);
              const stored = localStorage.getItem("break_seconds_left");
              const value = stored
                ? parseInt(stored)
                : DEFAULT_BREAK_MINUTES * 60;
              setBreakSecondsLeft(
                value === 0 ? DEFAULT_BREAK_MINUTES * 60 : value
              );
              localStorage.setItem(
                "break_seconds_left",
                (value === 0 ? DEFAULT_BREAK_MINUTES * 60 : value).toString()
              );
            }
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
            ? `/assets/pomodoro/${timerImage}`
            : `/assets/pomodoro/${stillName}`;
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
