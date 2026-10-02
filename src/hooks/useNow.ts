import { useSyncExternalStore } from "react";

let currentTimestamp = Date.now();
let timer: number | null = null;
const listeners = new Set<() => void>();

const emitTick = () => {
  currentTimestamp = Date.now();
  listeners.forEach((listener) => listener());
};

// Each tick is scheduled for just past the next whole second. A plain
// setInterval(1000) kept whatever phase the tab opened at, so the
// minute rolled over up to a second after the system clock did.
const scheduleTick = () => {
  timer = window.setTimeout(() => {
    emitTick();
    scheduleTick();
  }, 1000 - (Date.now() % 1000) + 5);
};

const stopTicking = () => {
  if (timer != null) window.clearTimeout(timer);
  timer = null;
};

// A background tab's timers are throttled, so catch up the moment the
// page is shown again rather than on the next scheduled tick.
const onVisibilityChange = () => {
  if (document.visibilityState !== "visible" || timer == null) return;
  stopTicking();
  emitTick();
  scheduleTick();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (timer == null) {
    currentTimestamp = Date.now();
    scheduleTick();
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopTicking();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
};

const getSnapshot = (): number => currentTimestamp;

export const useNow = (): Date =>
  new Date(useSyncExternalStore(subscribe, getSnapshot, getSnapshot));
