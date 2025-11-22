import RestoreIcon from "@mui/icons-material/Restore";
import React, { useEffect, useState } from "react";
import { BackgroundSettingsModal } from "../../components/BackgroundSettingsModal/BackgroundSettingsModal";
import { Button } from "../../components/Button/Button";
import {
  BUYMEACOFFEE_URL,
  GITHUB_REPO_URL,
  SIDEBAR_EDGE_TRIGGER,
  SIDEBAR_WIDTH,
} from "../../config/appConfig";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import "./LeftSidebar.css";

export const LeftSidebar: React.FC = () => {
  const {
    backgroundFilters,
    updateBackgroundFilters,
    backgroundSelection,
    updateBackgroundSelection,
  } = useAppContext();
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
    const defaultFilters = { blur: 0, brightness: 100, saturation: 100 };
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
          <h3>Settings</h3>
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
          {/* background settings modal is rendered below as a sibling so it isn't
            constrained by the sidebar's transform (allows centering) */}
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

            <div className="filter-actions">
              <Button
                variant="outline-light"
                size="small"
                onClick={resetFilters}
              >
                <RestoreIcon style={{ fontSize: 16, marginRight: 8 }} />
                Reset Filters
              </Button>
            </div>
          </div>
          <div className="sidebar-section">
            <Button
              variant={showBackgroundSettings ? "dark" : "outline-light"}
              fullWidth={true}
              onClick={() => setShowBackgroundSettings((s) => !s)}
            >
              Background Settings
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
