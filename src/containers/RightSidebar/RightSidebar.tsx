import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import React, { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
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
      const sidebarWidth = window.innerWidth - Math.min(450, window.innerWidth);

      // Open if cursor is within 50px of right edge
      if (e.clientX > window.innerWidth - 50) {
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

  return (
    <div className={`right-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-content">
        <div className="widget-section">
          <div
            className={`widget-icon ${widgetVisibility.time ? "active" : ""}`}
            onClick={() => toggleWidgetVisibility("time")}
          >
            <AccessTimeFilledIcon />
          </div>
          <div
            className={`widget-icon ${widgetVisibility.date ? "active" : ""}`}
            onClick={() => toggleWidgetVisibility("date")}
          >
            <CalendarTodayIcon />
          </div>
          <div
            className={`widget-icon ${widgetVisibility.info ? "active" : ""}`}
            onClick={() => toggleWidgetVisibility("info")}
          >
            <FormatQuoteIcon />
          </div>
          <div className="widget-toggle">
            <div
              className={`widget-icon ${widgetVisibility.todo ? "active" : ""}`}
              onClick={() => toggleWidgetVisibility("todo")}
            >
              <CheckBoxIcon />
            </div>
          </div>
        </div>
      </div>
      <div className="sidebar-footer">
        <Button variant="dark" size="medium" pill onClick={handleEditToggle}>
          {showWidgetEdits ? "✓ Done" : "✎ Edit Widgets"}
        </Button>
      </div>
    </div>
  );
};
