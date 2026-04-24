import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import ListIcon from "@mui/icons-material/List";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import React from "react";
import { Button } from "../../components/Button/Button";
import {
  AvatarSettings,
  getWidgetConfig,
  InfoFields,
  InfoSettings,
  isWidgetKey,
  QuicklinksSettings,
  TimeSettings,
} from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { AvatarSelector } from "../AvatarSelector/AvatarSelector";
import { FieldSelector } from "../FieldSelector/FieldSelector";
import "./EditWidget.css";

interface EditWidgetProps {
  showWidgetEdits: boolean;
  isResizing: boolean;
  storageKey?: string;
}

const INFO_FIELD_OPTIONS = [
  { value: "japaneseTitle", label: "Japanese Title" },
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
  { value: "movieLength", label: "Movie Length" },
  { value: "quote", label: "Quote" },
];

const EditWidget: React.FC<EditWidgetProps> = ({
  showWidgetEdits,
  isResizing,
  storageKey,
}) => {
  const { widgets, updateWidgetSettings } = useAppContext();

  if (!showWidgetEdits || isResizing || !isWidgetKey(storageKey)) return null;

  const widgetConfig = getWidgetConfig(storageKey);
  const settings = widgets[storageKey].settings as Record<string, unknown>;
  const controls = widgetConfig.customControls;

  const darkMode = (settings.darkMode as boolean | undefined) ?? false;

  const toggleTimeFormat = () => {
    const cur = (widgets.time.settings as TimeSettings).is24Hour;
    updateWidgetSettings("time", { is24Hour: !cur });
  };

  const toggleDarkMode = () => {
    updateWidgetSettings(storageKey, { darkMode: !darkMode } as never);
  };

  const toggleQuicklinksGrid = () => {
    const cur = (widgets.quicklinks.settings as QuicklinksSettings).gridMode;
    updateWidgetSettings("quicklinks", { gridMode: !cur });
  };

  const handleInfoFieldsChange = (fields: string[]) => {
    if (fields.length === 0) return;
    const infoFields: InfoFields = {
      japaneseTitle: fields.includes("japaneseTitle"),
      title: fields.includes("title"),
      year: fields.includes("year"),
      movieLength: fields.includes("movieLength"),
      quote: fields.includes("quote"),
    };
    updateWidgetSettings("info", { infoFields });
  };

  const handleAvatarChange = (avatar: string) => {
    updateWidgetSettings("avatar", { selectedAvatar: avatar });
  };

  const hasAnyControls = !!(
    widgetConfig.fontSize ||
    widgetConfig.size ||
    widgetConfig.width ||
    widgetConfig.height ||
    controls?.timeFormat ||
    controls?.infoFields ||
    controls?.avatarSelector ||
    controls?.darkMode ||
    controls?.gridMode
  );

  if (!hasAnyControls) return <div className="widget-overlay" />;

  const timeIs24Hour = (widgets.time.settings as TimeSettings).is24Hour;
  const quicklinksGrid = (widgets.quicklinks.settings as QuicklinksSettings).gridMode;
  const infoFields = (widgets.info.settings as InfoSettings).infoFields;
  const avatarSettings = widgets.avatar.settings as AvatarSettings;

  return (
    <div className="widget-overlay">
      <div className="widget-controls-container">
        {controls?.timeFormat && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              toggleTimeFormat();
            }}
            title="Toggle 12/24 hour format"
            variant="dark"
            size="small"
            icon={timeIs24Hour ? "12h" : "24h"}
          />
        )}
        {controls?.darkMode && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              toggleDarkMode();
            }}
            title="Toggle dark mode"
            variant={darkMode ? "light" : "dark"}
            size="small"
            icon={darkMode ? <LightModeIcon /> : <DarkModeIcon />}
          />
        )}
        {controls?.gridMode && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              toggleQuicklinksGrid();
            }}
            title={quicklinksGrid ? "Show as list" : "Show as grid"}
            variant="dark"
            size="small"
            icon={quicklinksGrid ? <ListIcon /> : <ViewModuleIcon />}
          />
        )}
      </div>
      {controls?.infoFields && (
        <div
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <FieldSelector
            options={INFO_FIELD_OPTIONS}
            selectedValues={Object.entries(infoFields)
              .filter(([_, v]) => v)
              .map(([k]) => k)}
            onChange={handleInfoFieldsChange}
            variant="dark"
            minSelected={1}
          />
        </div>
      )}
      {controls?.avatarSelector && (
        <div
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <AvatarSelector
            selectedAvatar={avatarSettings.selectedAvatar}
            onChange={handleAvatarChange}
            avatarSize={avatarSettings.size}
          />
        </div>
      )}
    </div>
  );
};

export default EditWidget;
