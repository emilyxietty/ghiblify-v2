import EditIcon from "@mui/icons-material/Edit";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import React, { useEffect } from "react";
import "./App.css";
import { Button } from "./components/Button/Button";
import WelcomeModal from "./components/WelcomeModal/WelcomeModal";
import { Background } from "./containers/Background/Background";
import { LeftSidebar } from "./containers/LeftSidebar/LeftSidebar";
import { DockWidget } from "./containers/RightDock/DockWidget";
import { RightDock } from "./containers/RightDock/RightDock";
import { RightSidebar } from "./containers/RightSidebar/RightSidebar";
import { Widget } from "./containers/Widget/Widget";
import TooltipPortal from "./components/TooltipPortal/TooltipPortal";
import CursorEffect from "./components/CursorEffect/CursorEffect";
import { Avatar } from "./containers/Widgets/Avatar/Avatar";
import { DateDisplay } from "./containers/Widgets/Date/Date";
import { Greeting } from "./containers/Widgets/Greeting/Greeting";
import { Notes } from "./containers/Widgets/Notes/Notes";
import { Info } from "./containers/Widgets/Info/Info";
import Pomodoro from "./containers/Widgets/Pomodoro/Pomodoro";
import QuickLinks from "./containers/Widgets/QuickLinks/QuickLinks";
import SearchBar from "./containers/Widgets/SearchBar/SearchBar";
import { Time } from "./containers/Widgets/Time/Time";
import { Todo } from "./containers/Widgets/Todo/Todo";
import Weather from "./containers/Widgets/Weather/Weather";
import { WidgetKey } from "./config/widgetConfig";
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
    toggleEditMode,
    backgroundFilters,
    widgets,
    showGuide,
    setShowGuide,
    editingWidgetKey,
    setEditingWidgetKey,
    setCurrentBackground,
    dragMode,
    setDragMode,
    dockShowBackgrounds,
  } = useAppContext();

  // While Drag Mode is on, mark the body so widgets get the same
  // visual cues they get on Shift (outline, grab cursor, quick-edit
  // pencils visible). Distinct from `.show-widget-outline` (which is
  // the transient Shift-held state) so the keyup handler in Widget.tsx
  // doesn't tear it off when Shift is released.
  useEffect(() => {
    if (dragMode) {
      document.body.classList.add("drag-mode-on");
      return () => document.body.classList.remove("drag-mode-on");
    }
  }, [dragMode]);

  // Mirror the global "show dock backgrounds" toggle onto the body
  // so DockWidget.css can scope the optional glass-card rule
  // (`body.dock-show-bg .dock-widget-time`, etc) without each
  // widget having to thread the flag.
  useEffect(() => {
    if (dockShowBackgrounds) {
      document.body.classList.add("dock-show-bg");
      return () => document.body.classList.remove("dock-show-bg");
    }
  }, [dockShowBackgrounds]);

  // Exit Drag Mode on outside click / Esc / Enter — same dismissal
  // model as global Edit Mode. Clicks on widgets, the sidebar, the
  // top edit-toggle bar (where the Drag Mode toggle lives), the
  // right-click ContextMenu, and modals don't count as "outside" so
  // the user can interact with all of those without losing drag mode.
  useEffect(() => {
    if (!dragMode) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          ".widget, .left-sidebar, .edit-toggle-button, .ctx-menu, [role='dialog']"
        )
      )
        return;
      setDragMode(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") setDragMode(false);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dragMode, setDragMode]);

  // Mirror the resolved background URL into context so consumers
  // outside the App tree (e.g. the LeftSidebar's delete-background
  // button) can act on it.
  useEffect(() => {
    setCurrentBackground(currentBackground);
  }, [currentBackground, setCurrentBackground]);

  //   const widgetsContainerRef = useRef<HTMLDivElement>(null);

  // Exit GLOBAL edit mode on outside click / Esc / Enter.
  useEffect(() => {
    if (!showWidgetEdits) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          ".widget, .left-sidebar, .edit-toggle-button, [role='dialog']"
        )
      )
        return;
      toggleEditMode();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        toggleEditMode();
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showWidgetEdits, toggleEditMode]);

  // Exit per-widget edit mode on outside click / Esc / Enter.
  useEffect(() => {
    if (!editingWidgetKey) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
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

  return (
    <>
      {showOfflineCallout && (
        <div className="offline-callout" role="status" aria-live="polite">
          {t("common.offlineCallout")}
        </div>
      )}
      <LeftSidebar />
      <RightSidebar visible={widgets.bookmarks.visible} />
      {(() => {
        // The dock surface is independent of the canvas: a widget can
        // appear in the dock, on the canvas, in both, or in neither.
        // We render whatever has `inRightSidebar: true` here and
        // leave canvas placement (driven by `visible`) untouched.
        // RightDock is always mounted (gated internally on `visible`)
        // so it can detect the off→on transition and fire its hint
        // callout, the same way the bookmarks RightSidebar does.
        // Excludes greeting, quicklinks, searchbar, and pomodoro —
        // their canvas-tuned layouts don't compress cleanly into the
        // dock column, so they're canvas-only by design.
        const dockEntries: Array<{
          key: WidgetKey;
          element: React.ReactNode;
        }> = [
          { key: "time", element: <Time /> },
          { key: "date", element: <DateDisplay /> },
          { key: "todo", element: <Todo /> },
          {
            key: "info",
            element:
              !bgLoading && !infoLoading ? (
                <Info
                  titlejp={titlejp}
                  title={title}
                  year={year}
                  screentime={screentime}
                  quote={quote}
                />
              ) : null,
          },
          {
            key: "avatar",
            element: !bgLoading && !infoLoading ? <Avatar /> : null,
          },
          { key: "weather", element: <Weather /> },
          { key: "notes", element: <Notes /> },
        ];
        const docked = dockEntries
          .filter((e) => widgets[e.key].inRightSidebar && e.element)
          // Render in user-defined order. dockOrder is an integer
          // assigned by `reorderDockedWidgets` after a drag, or the
          // canonical WIDGET_KEYS index when the user hasn't dragged
          // yet — both produce a stable sort.
          .sort(
            (a, b) =>
              widgets[a.key].dockOrder - widgets[b.key].dockOrder,
          );
        return (
          <RightDock
            visible={widgets.rightSidebar.visible}
            hasWidgets={docked.length > 0}
          >
            {docked.map((e) => (
              <DockWidget key={e.key} storageKey={e.key} visible={true}>
                {e.element}
              </DockWidget>
            ))}
          </RightDock>
        );
      })()}
      {(showWidgetEdits || editingWidgetKey || dragMode) && (
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
          {/* Mode segmented toggle — Edit Widgets and Drag Mode are
              mutually exclusive (enforced in AppContext). Rendering
              them as one connected pill with a filled "active" half
              makes the current mode unmistakable; the previous pair
              of similarly-styled outline buttons made it hard to tell
              which was on. */}
          <div
            className="mode-toggle"
            role="tablist"
            aria-label={t("sidebar.buttons.modeToggleAria")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={showWidgetEdits}
              className={`mode-toggle-segment${
                showWidgetEdits ? " is-active" : ""
              }`}
              onClick={() => {
                if (!showWidgetEdits) toggleEditMode();
              }}
            >
              <EditIcon style={{ fontSize: 14 }} />
              {t("sidebar.buttons.editWidgets")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dragMode}
              className={`mode-toggle-segment${
                dragMode ? " is-active" : ""
              }`}
              onClick={() => {
                if (!dragMode) setDragMode(true);
              }}
            >
              <OpenWithIcon style={{ fontSize: 14 }} />
              {t("sidebar.buttons.dragMode")}
            </button>
          </div>
          <Button
            variant="outline-light"
            size="small"
            pill
            onClick={() => {
              if (showWidgetEdits) toggleEditMode();
              if (editingWidgetKey) setEditingWidgetKey(null);
              if (dragMode) setDragMode(false);
            }}
          >
            {t("common.done")}
          </Button>
        </div>
      )}
      <WelcomeModal open={showGuide} onClose={() => setShowGuide(false)} />
      <TooltipPortal />
      {/* Cursor whimsy — companion sprite or particle trail beside
          the OS cursor. Reads appearance.cursor; null when the
          preset is "default". */}
      <CursorEffect />
      <Background
        currentBackground={currentBackground}
        loading={bgLoading}
        backgroundFilters={backgroundFilters}
        showWidgetEdits={showWidgetEdits}
      >
        <Widget storageKey="quicklinks" visible={widgets.quicklinks.visible}>
          <QuickLinks />
        </Widget>
        {/* Force the Time widget mounted while the welcome guide is
            running so the adjustTime / drag / rightClick demo slides
            always have a Time widget to point at, even if the user
            hid it via the sidebar toggles. Reverts to the user's
            choice as soon as the guide closes. */}
        <Widget
          storageKey="time"
          visible={widgets.time.visible || showGuide}
        >
          <Time />
        </Widget>
        <Widget storageKey="date" visible={widgets.date.visible}>
          <DateDisplay />
        </Widget>
        <Widget storageKey="greeting" visible={widgets.greeting.visible}>
          <Greeting />
        </Widget>
        <Widget storageKey="todo" visible={widgets.todo.visible}>
          <Todo />
        </Widget>
        <Widget
          storageKey="info"
          visible={widgets.info.visible && !bgLoading && !infoLoading}
        >
          <Info
            titlejp={titlejp}
            title={title}
            year={year}
            screentime={screentime}
            quote={quote}
          />
        </Widget>
        <Widget
          storageKey="avatar"
          visible={widgets.avatar.visible && !bgLoading && !infoLoading}
        >
          <Avatar />
        </Widget>
        <Widget storageKey="searchbar" visible={widgets.searchbar.visible}>
          <SearchBar />
        </Widget>
        <Widget storageKey="pomodoro" visible={widgets.pomodoro.visible}>
          <Pomodoro />
        </Widget>
        <Widget storageKey="weather" visible={widgets.weather.visible}>
          <Weather />
        </Widget>
        <Widget storageKey="notes" visible={widgets.notes.visible}>
          <Notes />
        </Widget>
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
