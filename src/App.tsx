import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import React, { useEffect } from "react";
import "./App.css";
import { Button } from "./components/Button/Button";
import WelcomeModal from "./components/WelcomeModal/WelcomeModal";
import { Background } from "./containers/Background/Background";
import { LeftSidebar } from "./containers/LeftSidebar/LeftSidebar";
import { RightSidebar } from "./containers/RightSidebar/RightSidebar";
import { Widget } from "./containers/Widget/Widget";
import TooltipPortal from "./components/TooltipPortal/TooltipPortal";
import { Avatar } from "./containers/Widgets/Avatar/Avatar";
import { DateDisplay } from "./containers/Widgets/Date/Date";
import { Info } from "./containers/Widgets/Info/Info";
import Pomodoro from "./containers/Widgets/Pomodoro/Pomodoro";
import QuickLinks from "./containers/Widgets/QuickLinks/QuickLinks";
import SearchBar from "./containers/Widgets/SearchBar/SearchBar";
import { Time } from "./containers/Widgets/Time/Time";
import { Todo } from "./containers/Widgets/Todo/Todo";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { useBackground } from "./hooks/useBackground";
import { useInfoConfig } from "./hooks/useInfoConfig";

const AppContent: React.FC = () => {
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
  } = useAppContext();

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
      if (target.closest(".left-sidebar, .edit-toggle-button, [role='dialog']"))
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
      <LeftSidebar />
      <RightSidebar visible={widgets.bookmarks.visible} />
      {(showWidgetEdits || editingWidgetKey) && (
        <div className="edit-toggle-button">
          <Button
            variant="outline-light"
            size="small"
            pill
            onClick={() => setShowGuide(true)}
            aria-label="Open the guide"
            aria-haspopup="dialog"
            data-tooltip="Guide"
          >
            <HelpOutlineIcon style={{ fontSize: 14 }} />
            Guide
          </Button>
          <Button
            variant="outline-light"
            size="small"
            pill
            onClick={() => {
              if (showWidgetEdits) toggleEditMode();
              if (editingWidgetKey) setEditingWidgetKey(null);
            }}
          >
            Done
          </Button>
        </div>
      )}
      <WelcomeModal open={showGuide} onClose={() => setShowGuide(false)} />
      <TooltipPortal />
      <Background
        currentBackground={currentBackground}
        loading={bgLoading}
        backgroundFilters={backgroundFilters}
        showWidgetEdits={showWidgetEdits}
      >
        <Widget storageKey="quicklinks" visible={widgets.quicklinks.visible}>
          <QuickLinks />
        </Widget>
        <Widget storageKey="time" visible={widgets.time.visible}>
          <Time />
        </Widget>
        <Widget storageKey="date" visible={widgets.date.visible}>
          <DateDisplay />
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
