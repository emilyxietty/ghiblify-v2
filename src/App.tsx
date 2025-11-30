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
    widgetVisibility,
  } = useAppContext();

  //   const widgetsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showWidgetEdits) return;

    const handleClick = (e: MouseEvent) => {
      const widget = (e.target as HTMLElement).closest(".widget");
      if (!widget) {
        toggleEditMode();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        toggleEditMode();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
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
        {widgetVisibility.quicklinks && (
          <Widget storageKey="quicklinks">
            <QuickLinks />
          </Widget>
        )}
        {widgetVisibility.time && (
          <Widget storageKey="time">
            <Time />
          </Widget>
        )}
        {widgetVisibility.date && (
          <Widget storageKey="date">
            <DateDisplay />
          </Widget>
        )}
        {widgetVisibility.todo && (
          <Widget storageKey="todo">
            <Todo />
          </Widget>
        )}
        {widgetVisibility.info && !bgLoading && !infoLoading && (
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
        {widgetVisibility.avatar && !bgLoading && !infoLoading && (
          <Widget storageKey="avatar">
            <Avatar />
          </Widget>
        )}
        {widgetVisibility.searchbar && (
          <Widget storageKey="searchbar">
            <SearchBar />
          </Widget>
        )}
        {widgetVisibility.pomodoro && (
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
