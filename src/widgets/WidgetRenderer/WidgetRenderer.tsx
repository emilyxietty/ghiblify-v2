import React from "react";
import type { CanvasWidgetKey } from "../../config/widgetConfig";
import { Avatar } from "../Avatar/Avatar";
import { DateDisplay } from "../Date/Date";
import { GoogleApps } from "../GoogleApps/GoogleApps";
import { Greeting } from "../Greeting/Greeting";
import { Info } from "../Info/Info";
import { Notes } from "../Notes/Notes";
import Pomodoro from "../Pomodoro/Pomodoro";
import QuickLinks from "../QuickLinks/QuickLinks";
import SearchBar from "../SearchBar/SearchBar";
import { Time } from "../Time/Time";
import { Todo } from "../Todo/Todo";
import Weather from "../Weather/Weather";

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
    case "notes2":
    case "notes3":
    case "notes4":
      return <Notes storageKey={storageKey} />;
    case "googleApps":
      return <GoogleApps />;
  }
  storageKey satisfies never;
  return null;
};
