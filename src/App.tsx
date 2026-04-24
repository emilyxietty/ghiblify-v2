import React, { useEffect } from "react";
import "./App.css";
import { Button } from "./components/Button/Button";
import { Background } from "./containers/Background/Background";
import { LeftSidebar } from "./containers/LeftSidebar/LeftSidebar";
import { Widget } from "./containers/Widget/Widget";
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
  } = useAppContext();

  //   const widgetsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showWidgetEdits) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't exit edit mode when clicking UI chrome — those buttons own
      // their own edit-mode toggling and would otherwise double-toggle.
      if (
        target.closest(
          ".widget, .left-sidebar, .sidebar-trigger, .edit-toggle-button, [role='dialog']"
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

  return (
    <>
      <LeftSidebar />
      {showWidgetEdits && (
        <div className="edit-toggle-button">
          <Button
            variant={"outline-light"}
            size="small"
            pill
            onClick={toggleEditMode}
          >
            Done
          </Button>
        </div>
      )}
      <Background
        currentBackground={currentBackground}
        loading={bgLoading}
        backgroundFilters={backgroundFilters}
        showWidgetEdits={showWidgetEdits}
      >
        {widgets.quicklinks.visible && (
          <Widget storageKey="quicklinks">
            <QuickLinks />
          </Widget>
        )}
        {widgets.time.visible && (
          <Widget storageKey="time">
            <Time />
          </Widget>
        )}
        {widgets.date.visible && (
          <Widget storageKey="date">
            <DateDisplay />
          </Widget>
        )}
        {widgets.todo.visible && (
          <Widget storageKey="todo">
            <Todo />
          </Widget>
        )}
        {widgets.info.visible && !bgLoading && !infoLoading && (
          <Widget storageKey="info">
            <Info
              titlejp={titlejp}
              title={title}
              year={year}
              screentime={screentime}
              quote={quote}
            />
          </Widget>
        )}
        {widgets.avatar.visible && !bgLoading && !infoLoading && (
          <Widget storageKey="avatar">
            <Avatar />
          </Widget>
        )}
        {widgets.searchbar.visible && (
          <Widget storageKey="searchbar">
            <SearchBar />
          </Widget>
        )}
        {widgets.pomodoro.visible && (
          <Widget storageKey="pomodoro">
            <Pomodoro />
          </Widget>
        )}
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
