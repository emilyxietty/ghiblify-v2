import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import "./Pomodoro.css";

const POMODORO_DURATION = 25 * 60; // 25 minutes
const BREAK_DURATION = 5 * 60; // 5 minutes

const Pomodoro: React.FC = () => {
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { setWidgetsTemporarilyHidden } = useAppContext();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startTimer = () => {
    if (!isRunning) {
      setIsRunning(true);
      setWidgetsTemporarilyHidden(true);
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev > 0) return prev - 1;
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          setIsBreak((b) => !b);
          setSecondsLeft(isBreak ? POMODORO_DURATION : BREAK_DURATION);
          setWidgetsTemporarilyHidden(false);
          return prev;
        });
      }, 1000);
    }
  };

  const pauseTimer = () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setWidgetsTemporarilyHidden(false);
  };

  const resetTimer = () => {
    pauseTimer();
    setSecondsLeft(isBreak ? BREAK_DURATION : POMODORO_DURATION);
    setWidgetsTemporarilyHidden(false);
  };
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setWidgetsTemporarilyHidden(false);
    };
  }, [setWidgetsTemporarilyHidden]);

  return (
    <div className="pomodoro-widget">
      <h2>{isBreak ? "Break" : "Pomodoro"} Timer</h2>
      <div className="timer-display">{formatTime(secondsLeft)}</div>
      <div className="controls">
        <button onClick={startTimer} disabled={isRunning}>
          Start
        </button>
        <button onClick={pauseTimer} disabled={!isRunning}>
          Pause
        </button>
        <button onClick={resetTimer}>Reset</button>
      </div>
    </div>
  );
};

export default Pomodoro;
