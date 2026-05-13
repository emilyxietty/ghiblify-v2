import { useEffect, useState } from "react";

/**
 * Viewport-relative size scaling.
 *
 * Every widget setting that's stored as "pixels" (fontSize, width,
 * height, size) is now interpreted as "pixels at a 1920px-wide
 * reference viewport." When rendered, we multiply by the live
 * viewport-width ratio so the widget looks proportionally the same
 * on any screen — matching the position system, which already stores
 * x/y as vw/vh percentages.
 *
 * Storage stays a plain number; only the interpretation changes.
 * Sliders in EditWidget operate in CURRENT-viewport pixels (so the
 * number a user drags matches what they see), and translate to/from
 * reference pixels at the read/write boundary via `toReferencePx` /
 * `toScreenPx`.
 *
 * Slider min/max bounds (declared in widgetConfig) are also
 * reference-px values — `useScaledRange` converts them to current-
 * viewport bounds for display.
 */

export const REFERENCE_VIEWPORT_WIDTH = 1920;

/** Reference px → current-viewport px. Use at render. */
export const toScreenPx = (refPx: number, viewportWidth?: number): number => {
  const w =
    typeof viewportWidth === "number" ? viewportWidth : window.innerWidth;
  return (refPx * w) / REFERENCE_VIEWPORT_WIDTH;
};

/** Current-viewport px → reference px. Use when writing to storage. */
export const toReferencePx = (
  screenPx: number,
  viewportWidth?: number,
): number => {
  const w =
    typeof viewportWidth === "number" ? viewportWidth : window.innerWidth;
  return (screenPx * REFERENCE_VIEWPORT_WIDTH) / w;
};

/**
 * Subscribes to `window.resize` and returns the current
 * `window.innerWidth`. Components that need to re-render on resize
 * can read this once and React will re-render them every time the
 * viewport changes.
 */
export const useViewportWidth = (): number => {
  const [w, setW] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : REFERENCE_VIEWPORT_WIDTH,
  );
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
};

/**
 * Hook: takes a reference-pixel value and returns the screen-pixel
 * value for the current viewport. Re-renders the caller on resize.
 */
export const useScaledPx = (refPx: number): number => {
  const w = useViewportWidth();
  return toScreenPx(refPx, w);
};
