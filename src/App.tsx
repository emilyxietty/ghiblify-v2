import React, { useEffect } from "react";
import "./App.css";
import { Button } from "./components/Button/Button";
import { Background } from "./containers/Background/Background";
import { LeftSidebar } from "./containers/LeftSidebar/LeftSidebar";
import { Widget } from "./containers/Widget/Widget";
import { Avatar } from "./containers/Widgets/Avatar/Avatar";
import { DateDisplay } from "./containers/Widgets/Date/Date";
import { Info } from "./containers/Widgets/Info/Info";
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
          <Widget
            storageKey="quicklinks_position"
            initialPosition={{ x: 50, y: 36 }}
          >
            <QuickLinks />
          </Widget>
        )}
        {widgetVisibility.time && (
          <Widget storageKey="time_position" initialPosition={{ x: 50, y: 20 }}>
            <Time />
          </Widget>
        )}
        {widgetVisibility.date && (
          <Widget storageKey="date_position" initialPosition={{ x: 50, y: 52 }}>
            <DateDisplay />
          </Widget>
        )}
        {widgetVisibility.todo && (
          <Widget storageKey="todo_position" initialPosition={{ x: 10, y: 50 }}>
            <Todo />
          </Widget>
        )}
        {widgetVisibility.info && !bgLoading && !infoLoading && (
          <Widget
            storageKey="info_position"
            initialPosition={{ x: 50, y: 88.5 }}
          >
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
          <Widget
            storageKey="avatar_position"
            initialPosition={{ x: 80, y: 20 }}
          >
            <Avatar />
          </Widget>
        )}
        {widgetVisibility.searchbar && (
          <Widget
            storageKey="searchbar_position"
            initialPosition={{ x: 50, y: 70 }}
          >
            <SearchBar />
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
