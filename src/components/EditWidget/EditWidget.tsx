import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import ListIcon from "@mui/icons-material/List";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import React, { useEffect, useReducer } from "react";
import { Button } from "../../components/Button/Button";
import { getWidgetConfig } from "../../config/widgetConfig";
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
  const {
    infoSettings,
    updateInfoSettings,
    timeSettings,
    updateTimeSettings,
    dateSettings,
    updateDateSettings,
    avatarSettings,
    updateAvatarSettings,
    todoSettings,
    updateTodoSettings,
    quicklinksSettings,
    updateQuicklinksSettings,
    searchbarSettings,
    updateSearchbarSettings,
  } = useAppContext();
  const widgetConfig = getWidgetConfig(storageKey);

  if (!showWidgetEdits || isResizing || !storageKey) return null;

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const handler = () => forceUpdate();
    window.addEventListener("timeSettingsChange", handler);
    window.addEventListener("infoSettingsChange", handler);
    window.addEventListener("avatarSettingsChange", handler);
    window.addEventListener("dateSettingsChange", handler);
    window.addEventListener("quicklinksSettingsChange", handler);
    window.addEventListener("searchbarSettingsChange", handler);
    window.addEventListener(
      `${storageKey.replace(/_position$/, "")}SettingsChange`,
      handler
    );
    return () => {
      window.removeEventListener("timeSettingsChange", handler);
      window.removeEventListener("infoSettingsChange", handler);
      window.removeEventListener("avatarSettingsChange", handler);
      window.removeEventListener("dateSettingsChange", handler);
      window.removeEventListener("quicklinksSettingsChange", handler);
      window.removeEventListener("searchbarSettingsChange", handler);
      window.removeEventListener(
        `${storageKey.replace(/_position$/, "")}SettingsChange`,
        handler
      );
    };
  }, [storageKey]);

  const baseKey = storageKey.replace(/_position$/, "");
  let darkMode = false;
  if (baseKey === "todo") {
    darkMode = todoSettings.darkMode;
  } else if (baseKey === "searchbar") {
    darkMode = searchbarSettings.darkMode ?? false;
  } else {
    darkMode = localStorage.getItem(`${storageKey}_darkMode`) === "true";
  }
  const selectedAvatar =
    avatarSettings.selectedAvatar ||
    localStorage.getItem("avatar_selected") ||
    "totoro";

  // Toggles
  const toggleTimeFormat = () => {
    updateTimeSettings({ is24Hour: !timeSettings.is24Hour });
    window.dispatchEvent(
      new CustomEvent("timeSettingsChange", {
        detail: { is24Hour: !timeSettings.is24Hour },
      })
    );
    forceUpdate();
  };

  const handleDarkModeToggle = () => {
    const newValue = !darkMode;
    const baseKey = storageKey.replace(/_position$/, "");
    if (baseKey === "todo" && updateTodoSettings) {
      updateTodoSettings({ darkMode: newValue });
    } else if (baseKey === "searchbar" && updateSearchbarSettings) {
      updateSearchbarSettings({ darkMode: newValue });
    } else {
      localStorage.setItem(`${storageKey}_darkMode`, newValue.toString());
      window.dispatchEvent(
        new CustomEvent(`${baseKey}SettingsChange`, {
          detail: { darkMode: newValue },
        })
      );
    }
    forceUpdate();
  };

  const handleInfoFieldsChange = (fields: string[]) => {
    if (fields.length === 0) return;
    // Convert array to object for context
    const fieldsObj = {
      japaneseTitle: fields.includes("japaneseTitle"),
      title: fields.includes("title"),
      year: fields.includes("year"),
      movieLength: fields.includes("movieLength"),
      quote: fields.includes("quote"),
    };
    updateInfoSettings({ infoFields: fieldsObj });
    window.dispatchEvent(
      new CustomEvent("infoSettingsChange", {
        detail: { selectedFields: fields },
      })
    );
    forceUpdate();
  };

  const handleAvatarChange = (avatar: string) => {
    updateAvatarSettings({ selectedAvatar: avatar });
    forceUpdate();
  };

  const fontSizeEnabled = widgetConfig?.fontSize?.enabled ?? false;
  const sizeEnabled = widgetConfig?.size?.enabled ?? false;
  const hasTimeFormat = widgetConfig?.customControls?.timeFormat ?? false;
  const hasInfoFields = widgetConfig?.customControls?.infoFields ?? false;
  const hasAvatarSelector =
    widgetConfig?.customControls?.avatarSelector ?? false;
  const hasDarkMode =
    typeof widgetConfig?.darkMode === "object"
      ? widgetConfig.darkMode.enabled
      : !!widgetConfig?.darkMode;
  const hasAnyControls =
    fontSizeEnabled ||
    hasTimeFormat ||
    hasInfoFields ||
    sizeEnabled ||
    hasAvatarSelector ||
    hasDarkMode;

  const isQuicklinks = baseKey === "quicklinks";
  const quicklinksGrid = quicklinksSettings.format === "grid";

  const toggleQuicklinksGrid = () => {
    const newFormat = quicklinksGrid ? "list" : "grid";
    updateQuicklinksSettings({ format: newFormat });
    window.dispatchEvent(
      new CustomEvent("quicklinksGridChange", { detail: { value: newFormat } })
    );
    forceUpdate();
  };

  return (
    <div className="widget-overlay">
      {(hasAnyControls || isQuicklinks) && (
        <>
          <div className="widget-controls-container">
            {hasTimeFormat && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTimeFormat();
                }}
                title="Toggle 12/24 hour format"
                variant="dark"
                size="small"
                icon={timeSettings.is24Hour ? "12h" : "24h"}
              />
            )}
            {hasDarkMode && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDarkModeToggle();
                }}
                title="Toggle dark mode"
                variant={darkMode ? "light" : "dark"}
                size="small"
                icon={darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              />
            )}
            {isQuicklinks && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleQuicklinksGrid();
                }}
                title={quicklinksGrid ? "Show as list" : "Show as grid"}
                variant="dark"
                size="small"
                icon={quicklinksGrid ? <ViewModuleIcon /> : <ListIcon />}
              />
            )}
          </div>
          {hasInfoFields && (
            <div
              style={{ pointerEvents: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              <FieldSelector
                options={INFO_FIELD_OPTIONS}
                selectedValues={Object.entries(infoSettings.infoFields)
                  .filter(([_, v]) => v)
                  .map(([k]) => k)}
                onChange={handleInfoFieldsChange}
                variant="dark"
                minSelected={1}
              />
            </div>
          )}
          {hasAvatarSelector && (
            <div
              style={{ pointerEvents: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              <AvatarSelector
                selectedAvatar={selectedAvatar}
                onChange={handleAvatarChange}
                avatarSize={
                  avatarSettings.size || widgetConfig?.size?.default || 100
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EditWidget;
