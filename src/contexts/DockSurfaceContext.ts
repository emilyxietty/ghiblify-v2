/**
 * DockSurfaceContext — signals "this subtree is rendering inside the
 * right dock." Used by per-widget hooks to merge `dockSettings` over
 * `settings` (so a widget rendered in the dock can have a separate
 * unit / layout / visible-fields config from the canvas instance)
 * and to route writes from edit controls into `updateWidgetDockSettings`
 * instead of `updateWidgetSettings`.
 *
 * Default false — canvas widgets that don't sit inside the dock get
 * the canvas-only behavior with no extra wiring.
 */

import { createContext, useContext } from "react";

export const DockSurfaceContext = createContext<boolean>(false);

export const useDockSurface = (): boolean => useContext(DockSurfaceContext);
