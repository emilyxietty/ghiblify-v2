/**
 * DockWidget - lightweight wrapper for a widget rendered inside the
 * RightDock. Skips the canvas-only mechanics that `<Widget>` carries
 * (free positioning, drag-to-position, resize handles, focus-mode
 * portal) since the dock controls layout itself: widgets flow through
 * its grid and size to their assigned column span.
 *
 * Right-click opens the same edit panel used by canvas widgets, with
 * writes routed into dockSettings so the canvas copy stays independent.
 */

import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  DOCK_WIDTH_POLICIES,
  type DockWidgetKey,
} from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { DockSurfaceContext } from "../../contexts/DockSurfaceContext";
import { useRightDockGuide } from "../../contexts/RightDockGuideContext";
import { getWidgetSurfacePresentation } from "../../utils/widgetSurfacePresentation";
import { useT } from "../../i18n/i18n";
import "./DockWidget.css";

const EditWidget = lazy(() => import("../../components/EditWidget/EditWidget"));

interface DockWidgetProps {
  storageKey: DockWidgetKey;
  visible: boolean;
  children: React.ReactNode;
  guidePreview?: boolean;
}

export const DockWidget: React.FC<DockWidgetProps> = ({
  storageKey,
  visible,
  children,
  guidePreview = false,
}) => {
  const t = useT();
  const guide = useRightDockGuide();
  const {
    widgets,
    appearance,
  } = useAppContext();
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const guideWasOpenRef = useRef(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const guideEditorOpen =
      guide.open &&
      (guide.step === "order" || guide.step === "size") &&
      storageKey === "time";
    if (guide.open || guideWasOpenRef.current) setEditing(guideEditorOpen);
    guideWasOpenRef.current = guide.open;
  }, [guide.open, guide.step, storageKey]);

  if (!visible) return null;

  // Half-width widgets share a row with another half - the dock body
  // is a 2-column grid; full widgets span both columns. Some widgets
  // are locked to a specific size regardless of stored preference.
  // Todo/Info compress poorly into a half cell so they're full-only.
  // Avatar is a small image tile that looks lonely as a full-row
  // surface, so it's locked to half.
  const widthPolicy = DOCK_WIDTH_POLICIES[storageKey];
  const dockWidth =
    widthPolicy === "flexible" ? widgets[storageKey].dockWidth : widthPolicy;
  const dockAlignment = widgets[storageKey].dockAlignment;
  const surfacePresentation = getWidgetSurfacePresentation({
    storageKey,
    settings: {
      ...widgets[storageKey].settings,
      ...widgets[storageKey].dockSettings,
    },
    theme: appearance.theme,
  });
  const isGuideTarget =
    guide.open && storageKey === "time";

  return (
    <div
      ref={widgetRef}
      className={`dock-widget dock-widget-${storageKey} dock-widget-${dockWidth} dock-align-${dockAlignment}${
        editing ? " is-editing" : ""
      }${
        guidePreview ? " is-guide-preview" : ""
      }${
        isGuideTarget ? " right-dock-guide-target" : ""
      }${
        surfacePresentation.className
          ? ` ${surfacePresentation.className}`
          : ""
      }`}
      data-widget-key={storageKey}
      data-guide-right-click={t("rightDock.guide.rightClickCue")}
      style={surfacePresentation.style}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement | null;
        const isEditable = !!target?.closest(
          "input, textarea, [contenteditable], [contenteditable='true']",
        );
        e.stopPropagation();
        if (isEditable) return;
        e.preventDefault();
        setEditing(true);
        guide.onWidgetEdit(storageKey);
      }}
    >
      <DockSurfaceContext.Provider value={true}>
        <div className="dock-widget-content">{children}</div>
      </DockSurfaceContext.Provider>
      {editing && (
        <Suspense fallback={null}>
          <EditWidget
            showWidgetEdits
            isResizing={false}
            storageKey={storageKey}
            anchorEl={widgetRef.current}
            surface="dock"
            onClose={() => setEditing(false)}
            dockGuidePreview={guidePreview}
          />
        </Suspense>
      )}
    </div>
  );
};
