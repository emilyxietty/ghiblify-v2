import React from "react";
import "./App.css";
import { Avatar } from "./components/Avatar/Avatar";
import { Button } from "./components/Button/Button";
import { DateDisplay } from "./components/Date/Date";
import { Info } from "./components/Info/Info";
import { Time } from "./components/Time/Time";
import { Todo } from "./components/Todo/Todo";
import { Background } from "./containers/Background/Background";
import { LeftSidebar } from "./containers/LeftSidebar/LeftSidebar";
import { RightSidebar } from "./containers/RightSidebar/RightSidebar";
import { Widget } from "./containers/Widget/Widget";
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

  console.log("Widget visibility:", widgetVisibility); // Debug log

  return (
    <>
      <LeftSidebar />
      <RightSidebar />
      {showWidgetEdits && (
        <div className="edit-toggle-button">
          <Button
            variant={"outline-light"}
            size="small"
            pill
            onClick={toggleEditMode}
          >
            ✓ Done
          </Button>
        </div>
      )}
      <Background
        currentBackground={currentBackground}
        loading={bgLoading}
        backgroundFilters={backgroundFilters}
        showWidgetEdits={showWidgetEdits}
      >
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
        <Widget storageKey="avatar_position" initialPosition={{ x: 80, y: 20 }}>
          <Avatar />
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
