import React from "react";
import type { CanvasWidgetKey } from "../../config/widgetConfig";
import { Avatar } from "../Widgets/Avatar/Avatar";
import { DateDisplay } from "../Widgets/Date/Date";
import { GoogleApps } from "../Widgets/GoogleApps/GoogleApps";
import { Greeting } from "../Widgets/Greeting/Greeting";
import { Info } from "../Widgets/Info/Info";
import { Notes } from "../Widgets/Notes/Notes";
import Pomodoro from "../Widgets/Pomodoro/Pomodoro";
import QuickLinks from "../Widgets/QuickLinks/QuickLinks";
import SearchBar from "../Widgets/SearchBar/SearchBar";
import { Time } from "../Widgets/Time/Time";
import { Todo } from "../Widgets/Todo/Todo";
import Weather from "../Widgets/Weather/Weather";

export interface FilmInfo {
  titlejp: string;
  title: string;
  year: string;
  screentime: string;
  quote: string;
}

interface WidgetRendererProps {
  storageKey: CanvasWidgetKey;
  filmInfo: FilmInfo;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  storageKey,
  filmInfo,
}) => {
  switch (storageKey) {
    case "time":
      return <Time />;
    case "date":
      return <DateDisplay />;
    case "greeting":
      return <Greeting />;
    case "info":
      return <Info {...filmInfo} />;
    case "todo":
      return <Todo />;
    case "avatar":
      return <Avatar />;
    case "quicklinks":
      return <QuickLinks />;
    case "searchbar":
      return <SearchBar />;
    case "pomodoro":
      return <Pomodoro />;
    case "weather":
      return <Weather />;
    case "notes":
      return <Notes />;
    case "googleApps":
      return <GoogleApps />;
  }
  storageKey satisfies never;
  return null;
};
