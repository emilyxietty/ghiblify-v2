import React from "react";
import type { WidgetKey } from "../../config/widgetConfig";
import {
  AccessTimeFilledIcon,
  AppsIcon,
  BookmarksIcon,
  CalendarTodayIcon,
  CheckBoxIcon,
  EmojiEmotionsIcon,
  FaceIcon,
  FormatQuoteIcon,
  LinkIcon,
  SearchIcon,
  StickyNote2Icon,
  TimerIcon,
  VerticalSplitIcon,
  WbSunnyIcon,
} from "../Icons/Icons";

interface WidgetIconProps {
  storageKey: WidgetKey;
}

export const WidgetIcon: React.FC<WidgetIconProps> = ({ storageKey }) => {
  switch (storageKey) {
    case "time":
      return <AccessTimeFilledIcon />;
    case "date":
      return <CalendarTodayIcon />;
    case "greeting":
      return <EmojiEmotionsIcon />;
    case "info":
      return <FormatQuoteIcon />;
    case "todo":
      return <CheckBoxIcon />;
    case "avatar":
      return <FaceIcon />;
    case "quicklinks":
      return <LinkIcon />;
    case "searchbar":
      return <SearchIcon />;
    case "pomodoro":
      return <TimerIcon />;
    case "bookmarks":
      return <BookmarksIcon />;
    case "weather":
      return <WbSunnyIcon />;
    case "notes":
      return <StickyNote2Icon />;
    case "rightSidebar":
      return <VerticalSplitIcon />;
    case "googleApps":
      return <AppsIcon />;
  }
  storageKey satisfies never;
  return null;
};
