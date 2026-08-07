import { useSyncExternalStore } from "react";

let currentTimestamp = Date.now();
let timer: number | null = null;
const listeners = new Set<() => void>();

const emitTick = () => {
  currentTimestamp = Date.now();
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (timer == null) {
    currentTimestamp = Date.now();
    timer = window.setInterval(emitTick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
};

const getSnapshot = (): number => currentTimestamp;

export const useNow = (): Date =>
  new Date(useSyncExternalStore(subscribe, getSnapshot, getSnapshot));
