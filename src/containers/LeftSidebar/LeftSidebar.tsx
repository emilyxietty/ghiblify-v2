import React, { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import "./LeftSidebar.css";

export const LeftSidebar: React.FC = () => {
  const {
    showWidgetEdits,
    toggleEditMode,
    backgroundFilters,
    updateBackgroundFilters,
    widgetVisibility,
    toggleWidgetVisibility,
  } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<BackgroundFilters>(backgroundFilters);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const sidebarWidth = Math.min(450, window.innerWidth);

      if (e.clientX < 50) {
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

  const handleGithubClick = () => {
    window.open(
      "https://github.com/emilyxietty/ghiblify-v2",
      "_blank",
      "noopener,noreferrer"
    );
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
    const defaultFilters = { blur: 0, brightness: 100, saturation: 100 };
    setFilters(defaultFilters);
    updateBackgroundFilters(defaultFilters);
  };

  return (
    <div className={`left-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-content">
        <h3>Settings</h3>
        <div className="sidebar-section">
          <Button
            variant="outline-light"
            size="small"
            onClick={handleGithubClick}
          >
            Github Repo
          </Button>
        </div>
        <div className="sidebar-section">
          <h4>Background</h4>
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

          <Button
            variant="outline-light"
            size="small"
            onClick={resetFilters}
            style={{ marginTop: "12px" }}
          >
            Reset Filters
          </Button>
        </div>
      </div>
    </div>
  );
};
