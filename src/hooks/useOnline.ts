import { useEffect, useState } from "react";

// Tracks browser network connectivity via `navigator.onLine` + the
// window `online` / `offline` events. `navigator.onLine` is the
// MV3-friendly source of truth for the new-tab page (no service-
// worker hop required). It can occasionally over-report online state
// when the OS thinks it's connected but DNS is broken — consumers
// that hit the network anyway should treat fetch errors as offline
// regardless of this flag.
export const useOnline = (): boolean => {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
};
