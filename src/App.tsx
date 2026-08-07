import React, { lazy, Suspense, useEffect, useState } from "react";
import { HelpOutlineIcon } from "./components/Icons/Icons";
import "./App.css";
import { Button } from "./components/Button/Button";
// Lazy - fetched only on first guide open. Saves it from the initial
// newtab paint chunk.
const WelcomeModal = lazy(() => import("./components/WelcomeModal/WelcomeModal"));
import { Background } from "./containers/Background/Background";
import { LeftSidebar } from "./containers/LeftSidebar/LeftSidebar";
import { DockWidget } from "./containers/RightDock/DockWidget";
import { RightDock } from "./containers/RightDock/RightDock";
import { RightSidebar } from "./containers/RightSidebar/RightSidebar";
import { Widget } from "./containers/Widget/Widget";
import {
  WidgetRenderer,
  type FilmInfo,
} from "./containers/WidgetRenderer/WidgetRenderer";
import TooltipPortal from "./components/TooltipPortal/TooltipPortal";
import CursorEffect from "./components/CursorEffect/CursorEffect";
import {
  CANVAS_WIDGET_KEYS,
  DOCK_WIDGET_KEYS,
  type CanvasWidgetKey,
} from "./config/widgetConfig";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { useBackground } from "./hooks/useBackground";
import { useInfoConfig } from "./hooks/useInfoConfig";
import { useOnline } from "./hooks/useOnline";
import { useT } from "./i18n/i18n";

const AppContent: React.FC = () => {
  const t = useT();
  const online = useOnline();
  // Surface a transient toast on every transition into offline (and
  // also on first load if we boot up offline). Re-shown if the user
  // briefly comes back online and drops again.
  const [showOfflineCallout, setShowOfflineCallout] = React.useState<boolean>(
    () => (typeof navigator !== "undefined" ? !navigator.onLine : false)
  );
  const wasOnline = React.useRef<boolean>(online);
  React.useEffect(() => {
    if (!online && wasOnline.current) setShowOfflineCallout(true);
    wasOnline.current = online;
  }, [online]);
  React.useEffect(() => {
    if (!showOfflineCallout) return;
    const id = window.setTimeout(() => setShowOfflineCallout(false), 5000);
    return () => window.clearTimeout(id);
  }, [showOfflineCallout]);
  const { currentBackground, filmTitle, loading: bgLoading } = useBackground();
  const {
    titlejp,
    title,
    year,
    screentime,
    quote,
    loading: infoLoading,
  } = useInfoConfig(filmTitle);

  const {
    showWidgetEdits,
    backgroundFilters,
    widgets,
    showGuide,
    setShowGuide,
    editingWidgetKey,
    setEditingWidgetKey,
    setCurrentBackground,
  } = useAppContext();

  // Transient "you can drag this now" toast, fired when a widget
  // enters edit mode. Entering edit mode makes the whole widget the
  // drag surface, which is invisible otherwise - the outline says
  // "selected", not "movable". Keyed on the widget so re-entering on a
  // different widget re-announces it.
  const [dragHint, setDragHint] = useState<string | null>(null);
  useEffect(() => {
    if (!editingWidgetKey) return;
    setDragHint(t("widgets.names." + editingWidgetKey));
    const id = window.setTimeout(() => setDragHint(null), 3200);
    return () => {
      window.clearTimeout(id);
      setDragHint(null);
    };
  }, [editingWidgetKey, t]);

  // Mirror the resolved background URL into context so consumers
  // outside the App tree (e.g. the LeftSidebar's delete-background
  // button) can act on it.
  useEffect(() => {
    setCurrentBackground(currentBackground);
  }, [currentBackground, setCurrentBackground]);


  //   const widgetsContainerRef = useRef<HTMLDivElement>(null);

  // Exit per-widget edit mode on outside click / Esc / Enter.
  useEffect(() => {
    if (!editingWidgetKey) return;
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || !(e.target instanceof Element)) return;
      const target = e.target;
      // Stay editing if the click landed inside the editing widget itself
      // or other UI chrome.
      const widget = target.closest(".widget") as HTMLElement | null;
      if (widget?.dataset.widgetKey === editingWidgetKey) return;
      // Stay editing if the click landed inside any chrome that isn't
       // a `.widget` itself: sidebar, dialog overlays, the global edit
       // toggle, OR the right-click ContextMenu (portal'd to <body>,
       // which means a click on its "Edit widget" item would otherwise
       // clear the state we just set).
      if (
        target.closest(
          ".left-sidebar, .edit-toggle-button, [role='dialog'], .ctx-menu"
        )
      )
        return;
      setEditingWidgetKey(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") setEditingWidgetKey(null);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [editingWidgetKey, setEditingWidgetKey]);

  const filmInfo: FilmInfo = { titlejp, title, year, screentime, quote };
  const filmWidgetsReady = !bgLoading && !infoLoading;
  const dockedWidgetKeys = DOCK_WIDGET_KEYS.filter(
    (key) =>
      widgets[key].inRightSidebar &&
      (!(key === "info" || key === "avatar") || filmWidgetsReady),
  ).sort((a, b) => widgets[a].dockOrder - widgets[b].dockOrder);
  const isCanvasWidgetVisible = (key: CanvasWidgetKey): boolean => {
    if (key === "time") return widgets.time.visible || showGuide;
    if (key === "info" || key === "avatar") {
      return widgets[key].visible && filmWidgetsReady;
    }
    return widgets[key].visible;
  };

  return (
    <>
      {showOfflineCallout && (
        <div className="offline-callout" role="status" aria-live="polite">
          {t("common.offlineCallout")}
        </div>
      )}
      {dragHint && (
        <div
          /* Same chrome as the offline toast; keyed so re-entering edit
             mode on another widget restarts the animation instead of
             leaving a stale pill on screen. */
          key={dragHint}
          className="offline-callout drag-hint-callout"
          role="status"
          aria-live="polite"
        >
          {t("callouts.widgetDraggable", { name: dragHint })}
        </div>
      )}
      <LeftSidebar />
      <RightSidebar visible={widgets.bookmarks.visible} />
      <RightDock
        visible={widgets.rightSidebar.visible}
        hasWidgets={dockedWidgetKeys.length > 0}
      >
        {dockedWidgetKeys.map((key) => (
          <DockWidget key={key} storageKey={key} visible>
            <WidgetRenderer storageKey={key} filmInfo={filmInfo} />
          </DockWidget>
        ))}
      </RightDock>
      {!showGuide && (showWidgetEdits || editingWidgetKey) && (
        <div className="edit-toggle-button">
          <Button
            variant="outline-light"
            size="small"
            pill
            onClick={() => setShowGuide(true)}
            aria-label={t("sidebar.buttons.guideAria")}
            aria-haspopup="dialog"
            data-tooltip={t("common.guide")}
          >
            <HelpOutlineIcon style={{ fontSize: 14 }} />
            {t("common.guide")}
          </Button>
          <Button
            variant="outline-light"
            size="small"
            pill
            onClick={() => setEditingWidgetKey(null)}
          >
            {t("common.done")}
          </Button>
        </div>
      )}
      {showGuide && (
        <Suspense fallback={null}>
          <WelcomeModal open={showGuide} onClose={() => setShowGuide(false)} />
        </Suspense>
      )}
      <TooltipPortal />
      {/* Cursor whimsy - companion sprite or particle trail beside
          the OS cursor. Reads appearance.cursor; null when the
          preset is "default". */}
      <CursorEffect />
      <Background
        currentBackground={currentBackground}
        loading={bgLoading}
        backgroundFilters={backgroundFilters}
        showWidgetEdits={showWidgetEdits}
      >
        {CANVAS_WIDGET_KEYS.map((key) => (
          <Widget
            key={key}
            storageKey={key}
            visible={isCanvasWidgetVisible(key)}
          >
            <WidgetRenderer storageKey={key} filmInfo={filmInfo} />
          </Widget>
        ))}
      </Background>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
