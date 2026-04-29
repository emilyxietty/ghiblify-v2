/**
 * useWidgetSettings(key) — returns the effective settings for a
 * widget at the current rendering surface (canvas or dock), and a
 * setter that writes back to the right surface.
 *
 *   surface = canvas → settings (the user's saved canvas config)
 *   surface = dock   → settings merged with dockSettings
 *                      (overrides only — anything not set in
 *                      dockSettings falls through to canvas)
 *
 * Writes:
 *   surface = canvas → updateWidgetSettings (modifies canvas
 *                      settings; dock instance, if any, ignores)
 *   surface = dock   → updateWidgetDockSettings (modifies dock
 *                      override; canvas instance untouched)
 *
 * This is the abstraction that lets one widget component (e.g.
 * Weather, Info) render in both surfaces with separate per-surface
 * config without forking the file.
 */

import { useCallback } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useDockSurface } from "../contexts/DockSurfaceContext";
import { WidgetKey, WidgetSettingsMap } from "../config/widgetConfig";

export interface UseWidgetSettingsResult<K extends WidgetKey> {
  settings: WidgetSettingsMap[K];
  updateSettings: (patch: Partial<WidgetSettingsMap[K]>) => void;
  inDock: boolean;
}

export const useWidgetSettings = <K extends WidgetKey>(
  key: K
): UseWidgetSettingsResult<K> => {
  const { widgets, updateWidgetSettings, updateWidgetDockSettings } =
    useAppContext();
  const inDock = useDockSurface();
  const entry = widgets[key];
  // Merged effective view. Dock overrides win on a per-field basis;
  // anything not present in dockSettings falls back to canvas.
  const settings = inDock
    ? ({ ...entry.settings, ...(entry.dockSettings as object) } as
        WidgetSettingsMap[K])
    : entry.settings;
  const updateSettings = useCallback(
    (patch: Partial<WidgetSettingsMap[K]>) => {
      if (inDock) updateWidgetDockSettings(key, patch);
      else updateWidgetSettings(key, patch);
    },
    [inDock, key, updateWidgetSettings, updateWidgetDockSettings]
  );
  return { settings, updateSettings, inDock };
};
