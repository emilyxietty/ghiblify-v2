import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PlayCircleFilledWhiteIcon from "@mui/icons-material/PlayCircleFilledWhite";
import ReplayCircleFilledIcon from "@mui/icons-material/ReplayCircleFilled";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button/Button";
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

const Pomodoro: React.FC = () => {
  // State for timer input value
  const [inputValue, setInputValue] = useState<string>("");
  // Unique tab ID for leader election
  const [tabId] = useState(() => Math.random().toString(36).slice(2));
  const [isLeader, setIsLeader] = useState(false);

  // Leader election: only one tab writes
  useEffect(() => {
    // Try to become leader if no leader exists
    if (!localStorage.getItem("pomodoro_leader")) {
      localStorage.setItem("pomodoro_leader", tabId);
      setIsLeader(true);
      console.log("Tab", tabId, "is claiming leader on mount");
    } else if (localStorage.getItem("pomodoro_leader") === tabId) {
      setIsLeader(true);
      console.log("Tab", tabId, "is already leader on mount");
    } else {
      setIsLeader(false);
      console.log(
        "Tab",
        tabId,
        "is not leader on mount. Current leader:",
        localStorage.getItem("pomodoro_leader")
      );
    }
    // Listen for leader changes (e.g., tab close)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pomodoro_leader") {
        const isNowLeader = localStorage.getItem("pomodoro_leader") === tabId;
        setIsLeader(isNowLeader);
        console.log(
          "Tab",
          tabId,
          isNowLeader
            ? "became leader (storage event)"
            : "is not leader (storage event)",
          "Current leader:",
          localStorage.getItem("pomodoro_leader")
        );
      }
    };
    window.addEventListener("storage", onStorage);
    // On unload, release leadership if this tab is leader
    const onUnload = () => {
      if (localStorage.getItem("pomodoro_leader") === tabId) {
        localStorage.removeItem("pomodoro_leader");
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onUnload);
      if (localStorage.getItem("pomodoro_leader") === tabId) {
        localStorage.removeItem("pomodoro_leader");
      }
    };
  }, [tabId]);

  // --- State initialization from localStorage ---
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(() => {
    const saved = localStorage.getItem("pomodoro_seconds_left");
    return saved ? parseInt(saved) : DEFAULT_POMODORO_MINUTES * 60;
  });
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(() => {
    const saved = localStorage.getItem("break_seconds_left");
    return saved ? parseInt(saved) : DEFAULT_BREAK_MINUTES * 60;
  });
  const [isRunning, setIsRunning] = useState(() => {
    const saved = localStorage.getItem("pomodoro_is_running");
    return saved === "true";
  });
  const [isBreak, setIsBreak] = useState(() => {
    const saved = localStorage.getItem("pomodoro_is_break");
    return saved === "true";
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [pomodoroOriginalSecondsState, setPomodoroOriginalSecondsState] =
    useState<number>(
      parseInt(
        localStorage.getItem("pomodoro_original_seconds") ||
          (DEFAULT_POMODORO_MINUTES * 60).toString()
      )
    );
  const [breakOriginalSecondsState, setBreakOriginalSecondsState] =
    useState<number>(
      parseInt(
        localStorage.getItem("break_original_seconds") ||
          (DEFAULT_BREAK_MINUTES * 60).toString()
      )
    );

  // Pick a random break image each break period
  const [timerImage, settimerImage] = useState<string>(() => {
    // If starting in break mode, pick one
    if (localStorage.getItem("pomodoro_is_break") === "true") {
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

  // --- Only leader manages seconds remaining ---
  useEffect(() => {
    if (isLeader) {
      localStorage.setItem(
        "pomodoro_seconds_left",
        pomodoroSecondsLeft.toString()
      );
      localStorage.setItem("break_seconds_left", breakSecondsLeft.toString());
    }
  }, [pomodoroSecondsLeft, breakSecondsLeft, isLeader]);

  // --- All tabs can control running, break mode, and reset ---
  useEffect(() => {
    localStorage.setItem("pomodoro_is_running", isRunning.toString());
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem("pomodoro_is_break", isBreak.toString());
  }, [isBreak]);

  // --- Listen for changes from other tabs ---
  useEffect(() => {
    const syncState = (e: StorageEvent) => {
      if (e.key === "pomodoro_seconds_left" && e.newValue && !isLeader) {
        setPomodoroSecondsLeft(parseInt(e.newValue));
      }
      if (e.key === "break_seconds_left" && e.newValue && !isLeader) {
        setBreakSecondsLeft(parseInt(e.newValue));
      }
      if (e.key === "pomodoro_is_running" && e.newValue !== null) {
        setIsRunning(e.newValue === "true");
      }
      if (e.key === "pomodoro_is_break" && e.newValue !== null) {
        setIsBreak(e.newValue === "true");
      }
    };
    window.addEventListener("storage", syncState);
    return () => window.removeEventListener("storage", syncState);
  }, [isLeader]);

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
    if (localStorage.getItem("pomodoro_leader") === tabId) {
      localStorage.removeItem("pomodoro_leader");
      setIsLeader(false);
    }
  };

  const claimLeader = () => {
    // Always claim leadership for this tab
    localStorage.setItem("pomodoro_leader", tabId);
    setIsLeader(true);
    console.log("Tab", tabId, "is claiming leader (claimLeader called)");
    if (isRunning) {
      setIsRunning((prev) => prev);
    }
  };

  const startTimer = () => {
    claimLeader();
    if (!isBreak) {
      localStorage.setItem(
        "pomodoro_seconds_left",
        pomodoroSecondsLeft.toString()
      );
    } else {
      localStorage.setItem("break_seconds_left", breakSecondsLeft.toString());
    }
    if (!isRunning) {
      setIsRunning(true);
    }
  };

  useEffect(() => {
    const syncOriginalSeconds = (e: StorageEvent) => {
      if (e.key === "pomodoro_original_seconds") {
        setPomodoroOriginalSecondsState(
          parseInt(e.newValue || (DEFAULT_POMODORO_MINUTES * 60).toString())
        );
      }
      if (e.key === "break_original_seconds") {
        setBreakOriginalSecondsState(
          parseInt(e.newValue || (DEFAULT_BREAK_MINUTES * 60).toString())
        );
      }
    };
    window.addEventListener("storage", syncOriginalSeconds);
    return () => window.removeEventListener("storage", syncOriginalSeconds);
  }, []);

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
            if (localStorage.getItem("pomodoro_leader") === tabId) {
              localStorage.removeItem("pomodoro_leader");
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
            if (localStorage.getItem("pomodoro_leader") === tabId) {
              localStorage.removeItem("pomodoro_leader");
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
  }, [isLeader, isRunning, isBreak]);

  const pauseTimer = () => {
    // Save current seconds left when pausing
    if (isBreak) {
      localStorage.setItem("break_seconds_left", breakSecondsLeft.toString());
    } else {
      localStorage.setItem(
        "pomodoro_seconds_left",
        pomodoroSecondsLeft.toString()
      );
    }
    releaseLeader();
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resetTimer = () => {
    claimLeader();
    setIsRunning(false);
    if (isBreak) {
      setBreakSecondsLeft(DEFAULT_BREAK_MINUTES * 60);
      setBreakOriginalSecondsState(DEFAULT_BREAK_MINUTES * 60);
      localStorage.setItem(
        "break_seconds_left",
        (DEFAULT_BREAK_MINUTES * 60).toString()
      );
      localStorage.setItem(
        "break_original_seconds",
        (DEFAULT_BREAK_MINUTES * 60).toString()
      );
    } else {
      setPomodoroSecondsLeft(DEFAULT_POMODORO_MINUTES * 60);
      setPomodoroOriginalSecondsState(DEFAULT_POMODORO_MINUTES * 60);
      localStorage.setItem(
        "pomodoro_seconds_left",
        (DEFAULT_POMODORO_MINUTES * 60).toString()
      );
      localStorage.setItem(
        "pomodoro_original_seconds",
        (DEFAULT_POMODORO_MINUTES * 60).toString()
      );
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
      localStorage.setItem("break_seconds_left", val.toString());
      localStorage.setItem("break_original_seconds", val.toString());
    } else {
      setPomodoroSecondsLeft(val);
      localStorage.setItem("pomodoro_seconds_left", val.toString());
      localStorage.setItem("pomodoro_original_seconds", val.toString());
    }
  };

  const minutesLeft = Math.floor(getCurrentSecondsLeft() / 60);

  // Progress bar calculation
  // Use original seconds from localStorage if available
  const pomodoroOriginalSeconds = parseInt(
    localStorage.getItem("pomodoro_original_seconds") ||
      (DEFAULT_POMODORO_MINUTES * 60).toString()
  );
  const breakOriginalSeconds = parseInt(
    localStorage.getItem("break_original_seconds") ||
      (DEFAULT_BREAK_MINUTES * 60).toString()
  );
  const totalSeconds = isBreak
    ? breakOriginalSecondsState
    : pomodoroOriginalSecondsState;
  const progressPercent = 100 * (1 - getCurrentSecondsLeft() / totalSeconds);

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

  return (
    <div
      className={`pomodoro-widget widget-header${isBreak ? " break-mode" : ""}`}
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
          Pomodoro
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
          Break
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
          return (
            <img
              src={"/assets/pomodoro/" + timerImage}
              alt={isBreak ? "Break" : "Pomodoro"}
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
            <span className="timer-mins-label">mins</span>
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
            icon={<PauseCircleIcon />}
            variant="transparent"
          />
        ) : (
          <Button
            onClick={startTimer}
            disabled={isRunning}
            icon={<PlayCircleFilledWhiteIcon />}
            variant="transparent"
          />
        )}
        {/* {!isRunning && ( */}
        <Button
          onClick={resetTimer}
          icon={<ReplayCircleFilledIcon />}
          variant="transparent"
          disabled={isRunning}
        />
        {/* )} */}
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
