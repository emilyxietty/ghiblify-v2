import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import BookmarksIcon from "@mui/icons-material/Bookmarks";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import EditIcon from "@mui/icons-material/Edit";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LinkIcon from "@mui/icons-material/Link";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import TimerIcon from "@mui/icons-material/Timer";
import React, { useEffect, useRef, useState } from "react";
import { BackgroundSettingsModal } from "../../components/BackgroundSettingsModal/BackgroundSettingsModal";
import WelcomeModal from "../../components/WelcomeModal/WelcomeModal";

import { Button } from "../../components/Button/Button";
import {
  BUYMEACOFFEE_URL,
  GITHUB_REPO_URL,
  SIDEBAR_EDGE_TRIGGER,
  SIDEBAR_WIDTH,
} from "../../config/appConfig";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import { WidgetKey } from "../../config/widgetConfig";
import {
  BackgroundFilters,
  ThemeName,
  useAppContext,
} from "../../contexts/AppContext";
import "./LeftSidebar.css";

const THEMES: Array<{ name: ThemeName; label: string }> = [
  { name: "ghibli", label: "Ghibli" },
  { name: "spirited", label: "Spirited Away" },
  { name: "howls", label: "Howl's" },
  { name: "totoro", label: "Totoro" },
  { name: "ponyo", label: "Ponyo" },
  { name: "sky", label: "Sky" },
  { name: "sakura", label: "Sakura" },
  { name: "meadow", label: "Meadow" },
  { name: "pastel", label: "Pastel" },
  { name: "cream", label: "Cream" },
  { name: "mint", label: "Mint" },
  { name: "bloom", label: "Bloom" },
  { name: "mono", label: "Mono" },
];

const WIDGET_TOGGLES: Array<{
  key: WidgetKey;
  label: string;
  icon: React.ReactElement;
}> = [
  { key: "time", label: "Time", icon: <AccessTimeFilledIcon /> },
  { key: "date", label: "Date", icon: <CalendarTodayIcon /> },
  { key: "info", label: "Film info", icon: <FormatQuoteIcon /> },
  { key: "todo", label: "Todo list", icon: <CheckBoxIcon /> },
  { key: "quicklinks", label: "Quick links", icon: <LinkIcon /> },
  { key: "searchbar", label: "Search bar", icon: <SearchIcon /> },
  { key: "pomodoro", label: "Pomodoro timer", icon: <TimerIcon /> },
  { key: "bookmarks", label: "Bookmarks", icon: <BookmarksIcon /> },
];

const FILTER_UNITS: Record<keyof BackgroundFilters, string> = {
  blur: "px",
  brightness: "%",
  contrast: "%",
  saturation: "%",
};

export const LeftSidebar: React.FC = () => {
  const {
    widgets,
    toggleWidgetVisibility,
    resetAllWidgets,
    backgroundFilters,
    updateBackgroundFilters,
    appearance,
    updateAppearance,
    showWidgetEdits,
    toggleEditMode,
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<BackgroundFilters>(backgroundFilters);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Close sidebar when entering edit mode
  useEffect(() => {
    setIsOpen(false);
  }, [showWidgetEdits]);

  // Edge-hover open + outside close (mouse UX preserved)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const sidebarWidth = Math.min(SIDEBAR_WIDTH, window.innerWidth);
      if (e.clientX < SIDEBAR_EDGE_TRIGGER) setIsOpen(true);
      else if (isOpen && e.clientX > sidebarWidth) setIsOpen(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isOpen]);

  // Keyboard shortcuts: Cmd/Ctrl+K toggles the sidebar (keyboard-accessible
  // entry point now that the visible trigger button is gone). Escape closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Make the sidebar inert (untabbable + hidden from AT) while closed.
  // Done via ref because @types/react v18 doesn't yet type the `inert` prop.
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    if (isOpen) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [isOpen]);

  const selectedAvatar = widgets.avatar.settings.selectedAvatar;
  const avatarData = AVATAR_OPTIONS.find((a) => a.value === selectedAvatar);

  const handleEditToggle = () => {
    toggleEditMode();
    setIsOpen(false);
  };

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
    const defaultFilters: BackgroundFilters = {
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
    };
    setFilters(defaultFilters);
    updateBackgroundFilters(defaultFilters);
  };

  const renderFilter = (
    name: keyof BackgroundFilters,
    label: string,
    min: number,
    max: number
  ) => {
    const value = filters[name] ?? (name === "blur" ? 0 : 100);
    const unit = FILTER_UNITS[name];
    const sliderId = `filter-${name}`;
    return (
      <div className="filter-control" key={name}>
        <label htmlFor={sliderId}>
          <span>{label}</span>
          <span className="filter-value">
            {value}
            {unit}
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          value={value}
          aria-valuetext={`${value}${unit === "px" ? " pixels" : " percent"}`}
          onChange={(e) => handleFilterChange(name, parseInt(e.target.value))}
          className="filter-slider"
        />
      </div>
    );
  };

  return (
    <>
      <aside
        id="settings-sidebar"
        ref={sidebarRef}
        className={`left-sidebar ${isOpen ? "open" : ""}`}
        aria-label="Settings"
      >
        <div className="sidebar-content">
          <div className="sidebar-section button-group" role="group" aria-label="External links">
            <Button variant="dark" size="small" onClick={() => handleSiteClick(GITHUB_REPO_URL)}>
              Github Repo
            </Button>
            <Button variant="dark" size="small" onClick={() => handleSiteClick(BUYMEACOFFEE_URL)}>
              Buy me a Coffee
            </Button>
            <Button
              variant="dark"
              size="small"
              onClick={() => setShowGuide(true)}
              aria-label="Open the guide"
              aria-haspopup="dialog"
            >
              <HelpOutlineIcon style={{ fontSize: 14, marginRight: 4 }} />
              Guide
            </Button>
          </div>

          <section className="sidebar-section" aria-labelledby="widgets-heading">
            <h4 id="widgets-heading">Widgets</h4>
            <div
              className="widget-section"
              role="group"
              aria-labelledby="widgets-heading"
            >
              {WIDGET_TOGGLES.map(({ key, label, icon }) => {
                const visible = widgets[key].visible;
                return (
                  <Button
                    key={key}
                    className={`widget-icon${visible ? " active" : ""}`}
                    icon={icon}
                    size="medium"
                    variant="transparent"
                    onClick={() => toggleWidgetVisibility(key)}
                    aria-label={`${visible ? "Hide" : "Show"} ${label} widget`}
                    aria-pressed={visible}
                    data-tooltip={label}
                  />
                );
              })}
              <Button
                className={`widget-icon avatar-with-overlay${
                  widgets.avatar.visible ? " active" : ""
                }`}
                variant="transparent"
                icon={
                  avatarData ? (
                    <img src={avatarData.src} alt="" />
                  ) : (
                    <span style={{ width: 28, height: 28, display: "inline-block" }}>
                      A
                    </span>
                  )
                }
                size="medium"
                onClick={() => toggleWidgetVisibility("avatar")}
                aria-label={`${
                  widgets.avatar.visible ? "Hide" : "Show"
                } Avatar widget`}
                aria-pressed={widgets.avatar.visible}
                data-tooltip="Avatar"
              />
            </div>
            <div className="widget-edits">
              <Button variant="dark" size="medium" pill onClick={handleEditToggle}>
                <EditIcon style={{ fontSize: 14 }} />
                {showWidgetEdits ? "Done" : "Edit Widgets"}
              </Button>
              <Button variant="dark" size="medium" pill onClick={resetAllWidgets}>
                <RestoreIcon style={{ fontSize: 14 }} />
                Reset All Widgets
              </Button>
            </div>
          </section>

          <section className="sidebar-section" aria-labelledby="appearance-heading">
            <h4 id="appearance-heading">Appearance</h4>
            <div className="filter-group" role="group" aria-labelledby="appearance-heading">
              <div className="filter-control">
                <span className="filter-control-label">Palette</span>
                <div
                  className="theme-swatches"
                  role="radiogroup"
                  aria-label="Color palette"
                >
                  {THEMES.map((t) => {
                    const selected = appearance.theme === t.name;
                    return (
                      <button
                        key={t.name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={t.label}
                        data-tooltip={t.label}
                        className={`theme-swatch theme-${t.name}${
                          selected ? " is-selected" : ""
                        }`}
                        onClick={() => updateAppearance({ theme: t.name })}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="filter-control">
                <label className="contrast-toggle">
                  <span>High contrast</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={appearance.highContrast}
                    onChange={(e) =>
                      updateAppearance({ highContrast: e.target.checked })
                    }
                  />
                  <span className="contrast-switch" aria-hidden="true" />
                </label>
              </div>
            </div>
          </section>

          <section className="sidebar-section" aria-labelledby="background-heading">
            <h4 id="background-heading">Background</h4>
            <div className="filter-group" role="group" aria-labelledby="background-heading">
              {renderFilter("blur", "Blur", 0, 20)}
              {renderFilter("brightness", "Brightness", 0, 200)}
              {renderFilter("contrast", "Contrast", 0, 200)}
              {renderFilter("saturation", "Saturation", 0, 200)}
              <div className="filter-actions">
                <Button variant="dark" size="small" onClick={resetFilters}>
                  <RestoreIcon style={{ fontSize: 16, marginRight: 8 }} />
                  Reset Filters
                </Button>
              </div>
            </div>
            <Button
              variant="dark"
              fullWidth
              onClick={() => setShowBackgroundSettings((s) => !s)}
              aria-haspopup="dialog"
              aria-expanded={showBackgroundSettings}
            >
              Select Backgrounds
            </Button>
          </section>
        </div>
      </aside>
      {showBackgroundSettings && (
        <BackgroundSettingsModal
          showBackgroundSettings={showBackgroundSettings}
          setShowBackgroundSettings={setShowBackgroundSettings}
        />
      )}
      <WelcomeModal open={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
};
