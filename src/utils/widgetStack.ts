import { useSyncExternalStore } from "react";
import { isWidgetKey, type WidgetKey } from "../config/widgetConfig";

/* Click-to-front stacking for canvas widgets.
 *
 * Rather than an ever-incrementing "top z" counter (which grows without
 * bound and eventually collides with the chrome layers at 2000+), we
 * keep the RELATIVE ORDER of recently-raised widgets, bottom → top.
 * A widget's z-index is BASE + its position in that order, so the
 * whole band stays within [BASE, BASE + widget count] forever — the
 * list is a permutation, not a counter.
 *
 * Persisted so the stack survives reloads — a new tab opens with the
 * same widget on top that you left on top.
 */

const WIDGET_Z_BASE = 1000;
const STORAGE_KEY = "widget_stack_order";

const loadOrder = (): readonly WidgetKey[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything that isn't a current widget key (renamed/removed
    // widgets, hand-edited storage) and any duplicates.
    return [...new Set(parsed.filter(isWidgetKey))];
  } catch {
    return [];
  }
};

// Bottom → top. Widgets never clicked aren't in the list — they sit at
// BASE, below everything that has been raised.
let order: readonly WidgetKey[] = loadOrder();
const listeners = new Set<() => void>();

export function bringWidgetToFront(key: WidgetKey): void {
  if (order[order.length - 1] === key) return;
  order = [...order.filter((k) => k !== key), key];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Storage full / unavailable — stacking still works for the session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shell's z-index: BASE for untouched widgets, BASE+1…BASE+n in
 *  last-clicked order for raised ones. */
export function useWidgetZIndex(key: WidgetKey): number {
  return useSyncExternalStore(subscribe, () => {
    const i = order.indexOf(key);
    return i === -1 ? WIDGET_Z_BASE : WIDGET_Z_BASE + 1 + i;
  });
}
