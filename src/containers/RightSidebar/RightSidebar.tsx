import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import React, { useEffect, useState } from "react";
import { AVATAR_OPTIONS } from "../../components/Avatar/Avatar";
import { Button } from "../../components/Button/Button";
import { SIDEBAR_EDGE_TRIGGER, SIDEBAR_WIDTH } from "../../config/appConfig";
import { useAppContext } from "../../contexts/AppContext";
import "./RightSidebar.css";

export const RightSidebar: React.FC = () => {
  const {
    showWidgetEdits,
    toggleEditMode,
    widgetVisibility,
    toggleWidgetVisibility,
  } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const sidebarWidth =
        window.innerWidth - Math.min(SIDEBAR_WIDTH, window.innerWidth);

      // Open if cursor is within SIDEBAR_EDGE_TRIGGER px of right edge
      if (e.clientX > window.innerWidth - SIDEBAR_EDGE_TRIGGER) {
        setIsOpen(true);
      }
      // Only close if sidebar is open AND cursor moves past sidebar width
      else if (isOpen && e.clientX < sidebarWidth) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isOpen]);

  // Close sidebar when edit mode changes
  useEffect(() => {
    setIsOpen(false);
  }, [showWidgetEdits]);

  const handleEditToggle = () => {
    toggleEditMode();
    setIsOpen(false);
  };

  // Get the selected avatar from localStorage
  const [selectedAvatar, setSelectedAvatar] = useState(
    () => localStorage.getItem("avatar_selected") || "totoro"
  );

  useEffect(() => {
    const handleChange = () => {
      setSelectedAvatar(localStorage.getItem("avatar_selected") || "totoro");
    };
    window.addEventListener("avatarSettingsChange", handleChange);
    return () =>
      window.removeEventListener("avatarSettingsChange", handleChange);
  }, []);

  const avatarData = AVATAR_OPTIONS.find((a) => a.value === selectedAvatar);

  return (
    <div className={`right-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-content">
        <div className="widget-section">
          <Button
            className={`widget-icon${widgetVisibility.time ? " active" : ""}`}
            icon={<AccessTimeFilledIcon />}
            size="medium"
            onClick={() => toggleWidgetVisibility("time")}
            title="Toggle Time Widget"
            variant="transparent"
          ></Button>
          <Button
            className={`widget-icon${widgetVisibility.date ? " active" : ""}`}
            icon={<CalendarTodayIcon />}
            size="medium"
            onClick={() => toggleWidgetVisibility("date")}
            title="Toggle Date Widget"
            variant="transparent"
          ></Button>
          <Button
            className={`widget-icon${widgetVisibility.info ? " active" : ""}`}
            icon={<FormatQuoteIcon />}
            size="medium"
            onClick={() => toggleWidgetVisibility("info")}
            title="Toggle Info Widget"
            variant="transparent"
          ></Button>
          <Button
            className={`widget-icon${widgetVisibility.todo ? " active" : ""}`}
            icon={<CheckBoxIcon />}
            size="medium"
            onClick={() => toggleWidgetVisibility("todo")}
            title="Toggle Todo Widget"
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
        </div>
      </div>
      <div className="sidebar-footer">
        <Button variant="dark" size="medium" pill onClick={handleEditToggle}>
          {showWidgetEdits ? "Done" : "✎ Edit Widgets"}
        </Button>
      </div>
    </div>
  );
};
