import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import EditIcon from "@mui/icons-material/Edit";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import LinkIcon from "@mui/icons-material/Link";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import React, { useEffect, useState } from "react";
import { BackgroundSettingsModal } from "../../components/BackgroundSettingsModal/BackgroundSettingsModal";
import { WIDGET_CONFIGS } from "../../config/widgetConfig";

import { Button } from "../../components/Button/Button";
import {
  BUYMEACOFFEE_URL,
  GITHUB_REPO_URL,
  SIDEBAR_EDGE_TRIGGER,
  SIDEBAR_WIDTH,
} from "../../config/appConfig";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import "./LeftSidebar.css";

export const LeftSidebar: React.FC = () => {
  // Reset all widget settings to default
  const {
    updateAvatarSettings,
    updateTodoSettings,
    updateDateSettings,
    updateTimeSettings,
    updateInfoSettings,
    updateQuicklinksSettings,
    updateSearchbarSettings,
    quicklinksSettings,
    updateWidgetPosition,
  } = useAppContext();

  function handleResetAllWidgets() {
    if (
      window.confirm("Are you sure you want to reset all widgets to default?")
    ) {
      // List of widget keys and their update functions
      const widgetUpdaters: {
        key: string;
        updater: (settings: any) => void;
      }[] = [
        { key: "avatar", updater: updateAvatarSettings },
        { key: "todo", updater: updateTodoSettings },
        { key: "date", updater: updateDateSettings },
        { key: "time", updater: updateTimeSettings },
        { key: "info", updater: updateInfoSettings },
        { key: "quicklinks", updater: updateQuicklinksSettings },
        { key: "searchbar", updater: updateSearchbarSettings },
      ];

      widgetUpdaters.forEach(({ key, updater }) => {
        updater(WIDGET_CONFIGS[key].defaults);
        if (WIDGET_CONFIGS[key].defaults.position) {
          updateWidgetPosition(
            `${key}_position`,
            WIDGET_CONFIGS[key].defaults.position
          );
        }
      });

      // Reload the page after reset
      window.location.reload();
    }
  }
  const {
    backgroundFilters,
    updateBackgroundFilters,
    backgroundSelection,
    updateBackgroundSelection,
    showWidgetEdits,
    toggleEditMode,
    widgetVisibility,
    toggleWidgetVisibility,
  } = useAppContext();

  //   useEffect(() => {
  //     const handleMouseMove = (e: MouseEvent) => {
  //       const sidebarWidth =
  //         window.innerWidth - Math.min(SIDEBAR_WIDTH, window.innerWidth);

  //       // Open if cursor is within SIDEBAR_EDGE_TRIGGER px of right edge
  //       if (e.clientX > window.innerWidth - SIDEBAR_EDGE_TRIGGER) {
  //         setIsOpen(true);
  //       }
  //       // Only close if sidebar is open AND cursor moves past sidebar width
  //       else if (isOpen && e.clientX < sidebarWidth) {
  //         setIsOpen(false);
  //       }
  //     };

  //     document.addEventListener("mousemove", handleMouseMove);
  //     return () => {
  //       document.removeEventListener("mousemove", handleMouseMove);
  //     };
  //   }, [isOpen]);

  // Close sidebar when edit mode changes
  useEffect(() => {
    setIsOpen(false);
  }, [showWidgetEdits]);

  const handleEditToggle = () => {
    toggleEditMode();
    setIsOpen(false);
  };

  // Get the selected avatar from localStorage
  const [selectedAvatar, setSelectedAvatar] = useState(() =>
    localStorage.getItem("avatar_selected")
  );

  useEffect(() => {
    const handleChange = () => {
      setSelectedAvatar(localStorage.getItem("avatar_selected"));
    };
    window.addEventListener("avatarSettingsChange", handleChange);
    return () =>
      window.removeEventListener("avatarSettingsChange", handleChange);
  }, []);

  const avatarData = AVATAR_OPTIONS.find((a) => a.value === selectedAvatar);
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<BackgroundFilters>(backgroundFilters);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [movies, setMovies] = useState<Array<{ key: string; title: string }>>(
    []
  );
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const sidebarWidth = Math.min(SIDEBAR_WIDTH, window.innerWidth);

      if (e.clientX < SIDEBAR_EDGE_TRIGGER) {
        setIsOpen(true);
      } else if (isOpen && e.clientX > sidebarWidth) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isOpen]);

  const handleSiteClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFilterChange = (
    filterType: keyof BackgroundFilters,
    value: number
  ) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    updateBackgroundFilters({ [filterType]: value });
  };

  const resetFilters = () => {
    const defaultFilters = {
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
    };
    setFilters(defaultFilters);
    updateBackgroundFilters(defaultFilters);
  };

  type ItemProps = {
    movieKey: string;
    title: string;
    enabled: boolean;
    available: boolean;
    links: string[];
    disableLast?: boolean;
    onUpdate: (k: string, v: boolean) => void;
  };

  return (
    <>
      <div className={`left-sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-content">
          <div className="sidebar-section button-group">
            <Button
              variant="dark"
              size="small"
              onClick={() => handleSiteClick(GITHUB_REPO_URL)}
            >
              Github Repo
            </Button>
            <Button
              variant="dark"
              size="small"
              onClick={() => handleSiteClick(BUYMEACOFFEE_URL)}
            >
              Buy me a Coffee
            </Button>
          </div>
          <div className="sidebar-section">
            <h4>Widgets</h4>
            <div className="widget-section">
              <Button
                className={`widget-icon${
                  widgetVisibility.time ? " active" : ""
                }`}
                icon={<AccessTimeFilledIcon />}
                size="medium"
                onClick={() => toggleWidgetVisibility("time")}
                title="Toggle Time Widget"
                variant="transparent"
              ></Button>
              <Button
                className={`widget-icon${
                  widgetVisibility.date ? " active" : ""
                }`}
                icon={<CalendarTodayIcon />}
                size="medium"
                onClick={() => toggleWidgetVisibility("date")}
                title="Toggle Date Widget"
                variant="transparent"
              ></Button>
              <Button
                className={`widget-icon${
                  widgetVisibility.info ? " active" : ""
                }`}
                icon={<FormatQuoteIcon />}
                size="medium"
                onClick={() => toggleWidgetVisibility("info")}
                title="Toggle Info Widget"
                variant="transparent"
              ></Button>
              <Button
                className={`widget-icon${
                  widgetVisibility.todo ? " active" : ""
                }`}
                icon={<CheckBoxIcon />}
                size="medium"
                onClick={() => toggleWidgetVisibility("todo")}
                title="Toggle Todo Widget"
                variant="transparent"
              ></Button>
              <Button
                className={`widget-icon${
                  widgetVisibility.quicklinks ? " active" : ""
                }`}
                icon={<LinkIcon />}
                size="medium"
                onClick={() => toggleWidgetVisibility("quicklinks")}
                title="Toggle Quicklinks Widget"
                variant="transparent"
              ></Button>
              <Button
                className={`widget-icon avatar-with-overlay${
                  widgetVisibility.avatar ? " active" : ""
                }`}
                variant="transparent"
                icon={
                  avatarData ? (
                    <img src={avatarData.src} alt={avatarData.label} />
                  ) : (
                    <span
                      style={{ width: 28, height: 28, display: "inline-block" }}
                    >
                      A
                    </span>
                  )
                }
                size="medium"
                onClick={() => toggleWidgetVisibility("avatar")}
                title="Toggle Avatar Widget"
              ></Button>
              <Button
                className={`widget-icon${
                  widgetVisibility.searchbar ? " active" : ""
                }`}
                variant="transparent"
                icon={<SearchIcon />}
                size="medium"
                onClick={() => toggleWidgetVisibility("searchbar")}
                title="Toggle Searchbar Widget"
              ></Button>
            </div>
            <div className="widget-edits">
              <Button
                variant="dark"
                size="medium"
                pill
                onClick={handleEditToggle}
              >
                <EditIcon
                  style={{
                    fontSize: 14,
                  }}
                />
                {showWidgetEdits ? "Done" : "Edit Widgets"}
              </Button>
              <Button
                variant="dark"
                size="medium"
                pill
                onClick={handleResetAllWidgets}
              >
                <RestoreIcon style={{ fontSize: "14px" }} />
                Reset All Widgets
              </Button>
            </div>
          </div>
          <div className="sidebar-section">
            <h4>Background</h4>
            <div className="filter-group">
              <div className="filter-control">
                <label>
                  <span>Blur</span>
                  <span className="filter-value">{filters.blur}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={filters.blur}
                  onChange={(e) =>
                    handleFilterChange("blur", parseInt(e.target.value))
                  }
                  className="filter-slider"
                />
              </div>

              <div className="filter-control">
                <label>
                  <span>Brightness</span>
                  <span className="filter-value">{filters.brightness}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.brightness}
                  onChange={(e) =>
                    handleFilterChange("brightness", parseInt(e.target.value))
                  }
                  className="filter-slider"
                />
              </div>

              <div className="filter-control">
                <label>
                  <span>Contrast</span>
                  <span className="filter-value">
                    {filters.contrast ?? 100}%
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.contrast ?? 100}
                  onChange={(e) =>
                    handleFilterChange("contrast", parseInt(e.target.value))
                  }
                  className="filter-slider"
                />
              </div>

              <div className="filter-control">
                <label>
                  <span>Saturation</span>
                  <span className="filter-value">{filters.saturation}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.saturation}
                  onChange={(e) =>
                    handleFilterChange("saturation", parseInt(e.target.value))
                  }
                  className="filter-slider"
                />
              </div>

              <div className="filter-actions">
                <Button variant="dark" size="small" onClick={resetFilters}>
                  <RestoreIcon style={{ fontSize: 16, marginRight: 8 }} />
                  Reset Filters
                </Button>
              </div>
            </div>
            <Button
              variant={"dark"}
              fullWidth={true}
              onClick={() => setShowBackgroundSettings((s) => !s)}
            >
              Select Backgrounds
            </Button>
          </div>
        </div>
      </div>
      {showBackgroundSettings && (
        <BackgroundSettingsModal
          showBackgroundSettings={showBackgroundSettings}
          setShowBackgroundSettings={setShowBackgroundSettings}
        />
      )}
    </>
  );
};
