/**
 * DockWidget — lightweight wrapper for a widget rendered inside the
 * RightDock. Skips the canvas-only mechanics that `<Widget>` carries
 * (free positioning, drag-to-position, resize handles, focus-mode
 * portal) since the dock controls layout itself: widgets stack
 * vertically and size to their column.
 *
 * Right-click context menu reuses the canvas Widget's per-widget
 * extras (time format radios, info fields, weather sections, etc.)
 * via `buildContextMenuItems(..., mode: "dock")`.
 *
 * Drag-and-drop: each DockWidget is `draggable`. On dragstart it
 * carries its widget key in dataTransfer; on drop it reads the
 * source key, computes whether the drop landed above or below the
 * target's midline, then calls `reorderDockedWidgets` with the new
 * key sequence. The dragged element dims while in flight; the hover
 * target gets a colored line on the side the drop will land.
 */

import React, { useMemo, useState } from "react";
import {
  ContextMenu,
} from "../../components/ContextMenu/ContextMenu";
import { WidgetKey, WIDGET_KEYS } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { DockSurfaceContext } from "../../contexts/DockSurfaceContext";
import { useT } from "../../i18n/i18n";
import { buildContextMenuItems } from "../Widget/Widget";
import "./DockWidget.css";

// Custom MIME so dragstart from random sources (text on the page,
// browser tab tabs, etc.) doesn't accidentally trigger a reorder.
const DOCK_DRAG_MIME = "application/x-ghiblify-dock-key";

interface DockWidgetProps {
  storageKey: WidgetKey;
  visible: boolean;
  children: React.ReactNode;
}

export const DockWidget: React.FC<DockWidgetProps> = ({
  storageKey,
  visible,
  children,
}) => {
  const t = useT();
  const {
    widgets,
    setEditingWidgetKey,
    toggleWidgetVisibility,
    updateWidgetSettings,
    updateWidgetDockSettings,
    setWidgetInRightSidebar,
    setWidgetDockWidth,
    setWidgetShowBackground,
    reorderDockedWidgets,
    setDragMode,
    appearance,
  } = useAppContext();
  const [contextMenuPos, setContextMenuPos] = useState<
    { x: number; y: number } | null
  >(null);
  const [dragging, setDragging] = useState(false);
  const [dropSide, setDropSide] = useState<"before" | "after" | null>(null);

  // Merged view of widget settings used by the dock context menu —
  // each entry's `settings` is canvas + dockSettings overrides, so
  // radios and checkboxes reflect what's actually rendered in the
  // dock (not the canvas state). Writes go through
  // updateWidgetDockSettings (aliased below) so they touch only the
  // dock override layer.
  const dockMergedWidgets = useMemo(() => {
    const out = { ...widgets };
    (WIDGET_KEYS as readonly WidgetKey[]).forEach((k) => {
      out[k] = {
        ...out[k],
        settings: {
          ...out[k].settings,
          ...(out[k].dockSettings as object),
        },
      } as typeof out[typeof k];
    });
    return out;
  }, [widgets]);

  if (!visible) return null;

  // Half-width widgets share a row with another half — the dock body
  // is a 2-column grid; full widgets span both columns. Some widgets
  // are locked to a specific size regardless of stored preference
  // (matches the gating in buildContextMenuItems → mode === "dock").
  // Todo/Info compress poorly into a half cell so they're full-only.
  // Avatar is a small image tile that looks lonely as a full-row
  // surface, so it's locked to half.
  const FULL_WIDTH_ONLY: WidgetKey[] = ["todo", "info"];
  const HALF_WIDTH_ONLY: WidgetKey[] = ["avatar"];
  const dockWidth = HALF_WIDTH_ONLY.includes(storageKey)
    ? "half"
    : FULL_WIDTH_ONLY.includes(storageKey)
      ? "full"
      : widgets[storageKey].dockWidth;
  const showBg = widgets[storageKey].showBackground;

  // Build the current ordered list of docked keys — the helper used
  // by drop handlers to compute the new sequence.
  const orderedDockedKeys = (): WidgetKey[] =>
    (WIDGET_KEYS as readonly WidgetKey[])
      .filter((k) => widgets[k].inRightSidebar)
      .sort((a, b) => widgets[a].dockOrder - widgets[b].dockOrder);

  return (
    <div
      className={`dock-widget dock-widget-${storageKey} dock-widget-${dockWidth}${
        showBg ? " dock-widget-show-bg" : ""
      }${dragging ? " is-dragging" : ""}${
        dropSide === "before" ? " drop-before" : ""
      }${dropSide === "after" ? " drop-after" : ""}`}
      data-widget-key={storageKey}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DOCK_DRAG_MIME, storageKey);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => {
        setDragging(false);
        setDropSide(null);
      }}
      onDragOver={(e) => {
        // The dataTransfer types check ensures we only react to our
        // own dock drags — text selections etc. are ignored. Note:
        // dataTransfer is read-only during dragover, so we check
        // .types (a frozen DOMStringList) rather than getData.
        if (!e.dataTransfer.types.includes(DOCK_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDropSide(e.clientY < midY ? "before" : "after");
      }}
      onDragLeave={(e) => {
        // Only clear when leaving the wrapper itself, not when the
        // cursor moves between child nodes.
        const related = e.relatedTarget as Node | null;
        if (related && (e.currentTarget as HTMLElement).contains(related))
          return;
        setDropSide(null);
      }}
      onDrop={(e) => {
        const sourceKey = e.dataTransfer.getData(DOCK_DRAG_MIME) as WidgetKey;
        setDropSide(null);
        if (!sourceKey || sourceKey === storageKey) return;
        e.preventDefault();
        const ordered = orderedDockedKeys();
        const filtered = ordered.filter((k) => k !== sourceKey);
        const targetIdx = filtered.indexOf(storageKey);
        if (targetIdx < 0) return;
        const insertAt =
          dropSide === "after" ? targetIdx + 1 : targetIdx;
        filtered.splice(insertAt, 0, sourceKey);
        reorderDockedWidgets(filtered);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      <DockSurfaceContext.Provider value={true}>
        <div className="dock-widget-content">{children}</div>
      </DockSurfaceContext.Provider>
      {contextMenuPos && (
        <ContextMenu
          position={contextMenuPos}
          onClose={() => setContextMenuPos(null)}
          items={buildContextMenuItems({
            storageKey,
            widgets: dockMergedWidgets,
            t,
            setEditingWidgetKey,
            toggleWidgetVisibility,
            // In dock mode, settings writes from right-click extras
            // go to dockSettings so the canvas instance keeps its
            // own values intact.
            updateWidgetSettings: updateWidgetDockSettings,
            setWidgetInRightSidebar,
            setWidgetDockWidth,
            setWidgetShowBackground,
            setDragMode,
            isFrost: appearance.theme === "frost",
            mode: "dock",
          })}
        />
      )}
    </div>
  );
};
