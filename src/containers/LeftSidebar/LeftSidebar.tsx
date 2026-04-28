import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import BookmarksIcon from "@mui/icons-material/Bookmarks";
import BugReportIcon from "@mui/icons-material/BugReport";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LinkIcon from "@mui/icons-material/Link";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import TimerIcon from "@mui/icons-material/Timer";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import React, { useEffect, useRef, useState } from "react";
import { BackgroundSettingsModal } from "../../components/BackgroundSettingsModal/BackgroundSettingsModal";
import ReportModal from "../../components/ReportModal/ReportModal";
import SocialsModal from "../../components/SocialsModal/SocialsModal";
import { WeatherSettings } from "../../config/widgetConfig";
import { useWeather } from "../../hooks/useWeather";
import {
  codeToIconName,
  iconUrl as weatherIconUrl,
} from "../Widgets/Weather/Weather";

import { Button } from "../../components/Button/Button";
import { Dropdown } from "../../components/Dropdown/Dropdown";
import {
  BUYMEACOFFEE_URL,
  CHROME_WEBSTORE_REVIEW_URL,
  SIDEBAR_EDGE_TRIGGER,
  SIDEBAR_WIDTH,
} from "../../config/appConfig";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import { WidgetKey } from "../../config/widgetConfig";
import {
  BackgroundFilters,
  CURSOR_NAMES,
  ThemeName,
  useAppContext,
} from "../../contexts/AppContext";
import { LANGUAGES, getLocale, setLocale, useT } from "../../i18n/i18n";
import {
  readBlacklist,
  readFavorites,
  writeBlacklist,
  writeFavorites,
} from "../../storage/backgroundStorage";
import "./LeftSidebar.css";

// Theme keys — labels come from i18n at render time so they translate.
const THEME_KEYS: ThemeName[] = [
  "ghibli",
  "spirited",
  "howls",
  "totoro",
  "ponyo",
  "sky",
  "butter",
  "mint",
  "spring",
  "peony",
  "light",
  "dark",
  "frost",
];

const WIDGET_TOGGLES: Array<{
  key: WidgetKey;
  icon: React.ReactElement;
}> = [
  { key: "time", icon: <AccessTimeFilledIcon /> },
  { key: "date", icon: <CalendarTodayIcon /> },
  { key: "greeting", icon: <EmojiEmotionsIcon /> },
  { key: "info", icon: <FormatQuoteIcon /> },
  { key: "todo", icon: <CheckBoxIcon /> },
  { key: "quicklinks", icon: <LinkIcon /> },
  { key: "searchbar", icon: <SearchIcon /> },
  { key: "pomodoro", icon: <TimerIcon /> },
  { key: "bookmarks", icon: <BookmarksIcon /> },
  { key: "weather", icon: <WbSunnyIcon /> },
  { key: "notes", icon: <StickyNote2Icon /> },
];

const FILTER_UNITS: Record<keyof BackgroundFilters, "px" | "percent"> = {
  blur: "px",
  brightness: "percent",
  contrast: "percent",
  saturation: "percent",
};

export const LeftSidebar: React.FC = () => {
  const t = useT();
  const {
    widgets,
    toggleWidgetVisibility,
    resetAllWidgets,
    backgroundFilters,
    updateBackgroundFilters,
    backgroundParallax,
    setBackgroundParallax,
    appearance,
    updateAppearance,
    showWidgetEdits,
    toggleEditMode,
    setShowGuide,
    showGuide,
    sidebarSpotlight,
    currentBackground,
    isDragging,
  } = useAppContext();

  // Blacklist the currently displayed background. Writes to the
  // shared ghiblify_background blob + dispatches the same event the
  // BackgroundSettingsModal listens to, so any open modal updates
  // and `useBackground` immediately picks a new image.
  const deleteCurrentBackground = () => {
    if (!currentBackground) return;
    const set = new Set<string>(readBlacklist());
    if (set.has(currentBackground)) return;
    set.add(currentBackground);
    writeBlacklist(Array.from(set));
    window.dispatchEvent(
      new CustomEvent("ghiblify:blacklist:add", { detail: currentBackground }),
    );
  };

  // Favorites — read on mount, refresh whenever any consumer broadcasts
  // a change. Heart button toggles membership for the current
  // background and dispatches `ghiblify:favorites:change` so the
  // settings modal + useBackground stay in sync.
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(readFavorites()),
  );
  useEffect(() => {
    const refresh = () => setFavorites(new Set(readFavorites()));
    window.addEventListener("ghiblify:favorites:change", refresh);
    return () =>
      window.removeEventListener("ghiblify:favorites:change", refresh);
  }, []);
  const isFavorited = !!currentBackground && favorites.has(currentBackground);
  const toggleFavoriteCurrent = () => {
    if (!currentBackground) return;
    const next = new Set(favorites);
    if (next.has(currentBackground)) next.delete(currentBackground);
    else next.add(currentBackground);
    setFavorites(next);
    writeFavorites(Array.from(next));
    window.dispatchEvent(new CustomEvent("ghiblify:favorites:change"));
  };

  // Live weather icon for the toggle — mirrors whatever Meteocons
  // glyph is currently showing in the Weather widget. The hook is
  // already cached, so calling it from the sidebar doesn't trigger a
  // second API request.
  const weatherSettings = widgets.weather.settings as WeatherSettings;
  const { data: weatherData } = useWeather(weatherSettings.unit);
  const liveWeatherIcon = weatherData ? (
    <img
      src={weatherIconUrl(
        codeToIconName(
          weatherData.current.weatherCode,
          weatherData.current.isDay,
        ),
        weatherSettings.iconStyle ?? "animated",
      )}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ width: 22, height: 22 }}
    />
  ) : (
    <WbSunnyIcon />
  );

  const [isOpen, setIsOpen] = useState(false);

  // Welcome-modal tour: keep the sidebar force-open for the entire
  // duration of the guide. Tracking just `sidebarSpotlight` wasn't
  // enough — going from one non-spotlit slide to another (e.g.
  // adjustTime → drag, both spotlight=null) didn't change the value,
  // so the open-on-spotlight effect didn't re-fire. Combined with the
  // mouse-move auto-close handler below, that left the sidebar shut
  // and unreachable when navigating back through the guide.
  useEffect(() => {
    if (showGuide || sidebarSpotlight) setIsOpen(true);
  }, [showGuide, sidebarSpotlight]);
  const [filters, setFilters] = useState<BackgroundFilters>(backgroundFilters);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSocialsModal, setShowSocialsModal] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Close sidebar when entering edit mode
  useEffect(() => {
    setIsOpen(false);
  }, [showWidgetEdits]);

  // Edge-hover open + outside close (mouse UX preserved). While the
  // welcome guide is open the auto-close branch is skipped so the
  // sidebar stays put for the spotlight tour — the user shouldn't
  // have to chase it after every accidental mouse drift. While the
  // user is dragging a widget, both branches are skipped so the
  // sidebar can't pop open mid-drag (cursor swinging past the
  // viewport edge would otherwise hijack the drag with a sidebar
  // reveal) and a sidebar that's already open stays open.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) return;
      const sidebarWidth = Math.min(SIDEBAR_WIDTH, window.innerWidth);
      if (e.clientX < SIDEBAR_EDGE_TRIGGER) setIsOpen(true);
      else if (isOpen && !showGuide && e.clientX > sidebarWidth)
        setIsOpen(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isOpen, showGuide, isDragging]);

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
    value: number,
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
    // Also clear parallax so the "Reset background settings" button
    // truly resets the whole panel, not just the slider values.
    setBackgroundParallax(false);
  };

  const renderFilter = (
    name: keyof BackgroundFilters,
    label: string,
    min: number,
    max: number,
  ) => {
    const value = filters[name] ?? (name === "blur" ? 0 : 100);
    const unitKey = FILTER_UNITS[name];
    const unit = t(`sidebar.filterUnits.${unitKey}`);
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
          aria-valuetext={`${value}${unit}`}
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
        className={`left-sidebar ${isOpen ? "open" : ""}${
          showGuide || sidebarSpotlight ? " sidebar-spotlight" : ""
        }${sidebarSpotlight ? ` spotlight-${sidebarSpotlight}` : ""}`}
        aria-label={t("sidebar.ariaLabel")}
        // Drive the visible width from the same SIDEBAR_WIDTH
        // constant used by the close-trigger logic, so the JS and
        // CSS sources of truth can't drift.
        style={{ ["--sidebar-width" as any]: `${SIDEBAR_WIDTH}px` }}
      >
        <div className="sidebar-content">
          <div className="sidebar-section button-group" role="group">
            <Button
              className="sidebar-guide-btn"
              variant="dark"
              size="small"
              onClick={() => setShowGuide(true)}
              aria-label={t("sidebar.buttons.guideAria")}
              aria-haspopup="dialog"
            >
              <HelpOutlineIcon style={{ fontSize: 14 }} />
              {t("sidebar.buttons.guide")}
            </Button>
            <Button
              variant="dark"
              size="small"
              onClick={() => setShowSocialsModal(true)}
              aria-haspopup="dialog"
            >
              <FavoriteIcon style={{ fontSize: 14 }} />
              {t("socials.buttonLabel")}
            </Button>
            <Button
              variant="dark"
              size="small"
              onClick={() => handleSiteClick(BUYMEACOFFEE_URL)}
            >
              <LocalCafeIcon style={{ fontSize: 14 }} />
              {t("sidebar.buttons.buyCoffee")}
            </Button>
          </div>

          <section
            className="sidebar-section"
            aria-labelledby="widgets-heading"
          >
            <h4 id="widgets-heading">{t("sidebar.headings.widgets")}</h4>
            <div
              className="widget-section"
              role="group"
              aria-labelledby="widgets-heading"
            >
              {WIDGET_TOGGLES.map(({ key, icon }) => {
                const visible = widgets[key].visible;
                const name = t(`widgets.names.${key}`);
                // Weather toggle gets a live Meteocons icon matching
                // current conditions, instead of the static sun fallback.
                const renderedIcon = key === "weather" ? liveWeatherIcon : icon;
                return (
                  <Button
                    key={key}
                    className={`widget-icon${visible ? " active" : ""}`}
                    icon={renderedIcon}
                    size="medium"
                    variant="transparent"
                    onClick={() => toggleWidgetVisibility(key)}
                    aria-label={t(
                      visible ? "widgets.tooltip.hide" : "widgets.tooltip.show",
                      { name },
                    )}
                    aria-pressed={visible}
                    data-tooltip={name}
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
                    <span
                      style={{ width: 28, height: 28, display: "inline-block" }}
                    >
                      A
                    </span>
                  )
                }
                size="medium"
                onClick={() => toggleWidgetVisibility("avatar")}
                aria-label={t(
                  widgets.avatar.visible
                    ? "widgets.tooltip.hide"
                    : "widgets.tooltip.show",
                  {
                    name: t("widgets.names.avatar"),
                  },
                )}
                aria-pressed={widgets.avatar.visible}
                data-tooltip={t("widgets.names.avatar")}
              />
            </div>
            <div className="widget-edits">
              <Button
                variant="dark"
                size="medium"
                pill
                onClick={handleEditToggle}
              >
                <EditIcon style={{ fontSize: 14 }} />
                {showWidgetEdits
                  ? t("common.done")
                  : t("sidebar.buttons.editWidgets")}
              </Button>
              <Button
                variant="dark"
                size="medium"
                pill
                onClick={resetAllWidgets}
              >
                <RestoreIcon style={{ fontSize: 14 }} />
                {t("sidebar.buttons.resetAllWidgets")}
              </Button>
            </div>
          </section>

          <section
            className="sidebar-section"
            aria-labelledby="appearance-heading"
          >
            <h4 id="appearance-heading">{t("sidebar.headings.appearance")}</h4>
            <details className="filter-collapsible">
              <summary className="filter-collapsible-summary">
                <span>{t("sidebar.filters.heading")}</span>
                <span className="collapsible-preview" aria-hidden="true">
                  <span
                    className={`theme-swatch theme-${appearance.theme} preview-swatch`}
                    data-tooltip={t(`themes.${appearance.theme}`)}
                  />
                </span>
                <ExpandMoreIcon
                  className="filter-collapsible-chevron"
                  fontSize="small"
                />
              </summary>
              <div
                className="filter-group"
                role="group"
                aria-labelledby="appearance-heading"
              >
                <div
                  className="theme-swatches"
                  role="radiogroup"
                  aria-label={t("sidebar.appearance.paletteAria")}
                >
                  {THEME_KEYS.map((name) => {
                    const selected = appearance.theme === name;
                    const label = t(`themes.${name}`);
                    return (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={label}
                        data-tooltip={label}
                        className={`theme-swatch theme-${name}${
                          selected ? " is-selected" : ""
                        }`}
                        onClick={() => updateAppearance({ theme: name })}
                      />
                    );
                  })}
                </div>
                <div className="filter-control">
                  <label className="contrast-toggle">
                    <span>{t("sidebar.appearance.highContrast")}</span>
                    <input
                      id="appearance-high-contrast"
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
            </details>
          </section>

          <section
            className="sidebar-section"
            aria-labelledby="background-heading"
          >
            <h4 id="background-heading">{t("sidebar.headings.background")}</h4>
            <details className="filter-collapsible">
              <summary className="filter-collapsible-summary">
                <span>{t("sidebar.filters.heading")}</span>
                <ExpandMoreIcon
                  className="filter-collapsible-chevron"
                  fontSize="small"
                />
              </summary>
              <div className="filter-group" role="group">
                <div className="filter-control">
                  <label className="contrast-toggle">
                    <span className="filter-toggle-label">
                      {t("sidebar.filters.parallax")}
                      <span
                        className="filter-help"
                        role="img"
                        tabIndex={0}
                        aria-label={t("sidebar.filters.parallaxTooltip")}
                        data-tooltip={t("sidebar.filters.parallaxTooltip")}
                        onClick={(e) => {
                          // Don't toggle the switch when clicking the
                          // help icon (it's wrapped by the same <label>).
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <HelpOutlineIcon style={{ fontSize: 13 }} />
                      </span>
                    </span>
                    <input
                      id="background-parallax"
                      type="checkbox"
                      role="switch"
                      checked={backgroundParallax}
                      onChange={(e) => setBackgroundParallax(e.target.checked)}
                    />
                    <span className="contrast-switch" aria-hidden="true" />
                  </label>
                </div>
                {renderFilter("blur", t("sidebar.filters.blur"), 0, 20)}
                {renderFilter(
                  "brightness",
                  t("sidebar.filters.brightness"),
                  0,
                  200,
                )}
                {renderFilter(
                  "contrast",
                  t("sidebar.filters.contrast"),
                  0,
                  200,
                )}
                {renderFilter(
                  "saturation",
                  t("sidebar.filters.saturation"),
                  0,
                  200,
                )}
                <div className="filter-actions">
                  <Button variant="dark" size="small" onClick={resetFilters}>
                    <RestoreIcon style={{ fontSize: 16 }} />
                    {t("sidebar.buttons.resetFilters")}
                  </Button>
                </div>
              </div>
            </details>
            <div className="background-actions">
              <Button
                variant="dark"
                onClick={() => setShowBackgroundSettings((s) => !s)}
                aria-haspopup="dialog"
                aria-expanded={showBackgroundSettings}
                className="background-actions-select"
              >
                {t("sidebar.buttons.selectBackgrounds")}
              </Button>
              <Button
                variant="dark"
                onClick={toggleFavoriteCurrent}
                aria-label={
                  isFavorited
                    ? t("sidebar.buttons.unfavoriteBackgroundAria")
                    : t("sidebar.buttons.favoriteBackgroundAria")
                }
                data-tooltip={
                  isFavorited
                    ? t("sidebar.buttons.unfavoriteBackground")
                    : t("sidebar.buttons.favoriteBackground")
                }
                aria-pressed={isFavorited}
                disabled={!currentBackground}
                className={`background-actions-fav${
                  isFavorited ? " is-favorited" : ""
                }`}
              >
                {isFavorited ? (
                  <FavoriteIcon style={{ fontSize: 16 }} />
                ) : (
                  <FavoriteBorderIcon style={{ fontSize: 16 }} />
                )}
              </Button>
              <Button
                variant="dark"
                onClick={deleteCurrentBackground}
                aria-label={t("sidebar.buttons.deleteBackgroundAria")}
                data-tooltip={t("sidebar.buttons.deleteBackground")}
                disabled={!currentBackground}
                className="background-actions-delete"
              >
                <DeleteOutlineIcon style={{ fontSize: 16 }} />
              </Button>
            </div>
          </section>

          <section className="sidebar-section" aria-labelledby="cursor-heading">
            <h4 id="cursor-heading">{t("sidebar.headings.cursor")}</h4>
            <details className="filter-collapsible">
              <summary className="filter-collapsible-summary">
                <span>{t("sidebar.filters.heading")}</span>
                {(() => {
                  const cur = appearance.cursor ?? "default";
                  const label = t(`sidebar.cursor.${cur}`);
                  if (cur === "default") {
                    return (
                      <span
                        className="collapsible-preview"
                        data-tooltip={label}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          className="preview-cursor-svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M5 3 L5 19 L9 15.5 L11.5 21 L13.5 20 L11 14.5 L17 14.5 Z"
                            fill="currentColor"
                            stroke="rgba(0,0,0,0.45)"
                            strokeWidth="0.7"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    );
                  }
                  return (
                    <span
                      className="collapsible-preview"
                      data-tooltip={label}
                    >
                      <img
                        className="preview-cursor-img"
                        src={`/assets/cursors/${cur}.svg`}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                    </span>
                  );
                })()}
                <ExpandMoreIcon
                  className="filter-collapsible-chevron"
                  fontSize="small"
                />
              </summary>
              <div className="filter-group" role="group">
                <div
                  className="cursor-swatches"
                  role="group"
                  aria-label={t("sidebar.headings.cursor")}
                >
                  {CURSOR_NAMES.map((name) => {
                const active = (appearance.cursor ?? "default") === name;
                const label = t(`sidebar.cursor.${name}`);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`cursor-swatch cursor-swatch-${name}${
                      active ? " is-active" : ""
                    }`}
                    onClick={() => updateAppearance({ cursor: name })}
                    aria-label={label}
                    aria-pressed={active}
                    data-tooltip={label}
                  >
                    {name === "default" ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 3 L5 19 L9 15.5 L11.5 21 L13.5 20 L11 14.5 L17 14.5 Z"
                          fill="currentColor"
                          stroke="rgba(0,0,0,0.45)"
                          strokeWidth="0.7"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <img
                        src={`/assets/cursors/${name}.svg`}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                    )}
                  </button>
                );
              })}
                </div>
              </div>
            </details>
          </section>

          <div
            className="sidebar-section button-group sidebar-bottom"
            role="group"
            aria-label={t("sidebar.externalLinksLabel")}
          >
            <Button
              variant="dark"
              size="small"
              onClick={() => setShowReportModal(true)}
              aria-label={t("report.buttonAria")}
              aria-haspopup="dialog"
            >
              <BugReportIcon style={{ fontSize: 14 }} />
              {t("report.buttonLabel")}
            </Button>
            <Button
              variant="dark"
              size="small"
              onClick={() => handleSiteClick(CHROME_WEBSTORE_REVIEW_URL)}
              aria-label={t("sidebar.buttons.rateAria")}
            >
              <StarIcon style={{ fontSize: 14 }} />
              {t("sidebar.buttons.rate")}
            </Button>
            <Dropdown
              className="language-picker"
              size="small"
              variant="outline-light"
              portal
              direction="up"
              options={LANGUAGES.map((l) => ({
                value: l.code,
                label: l.label,
              }))}
              value={getLocale()}
              onChange={(code) => setLocale(code)}
            />
          </div>
        </div>
      </aside>
      {showBackgroundSettings && (
        <BackgroundSettingsModal
          showBackgroundSettings={showBackgroundSettings}
          setShowBackgroundSettings={setShowBackgroundSettings}
        />
      )}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
      <SocialsModal
        open={showSocialsModal}
        onClose={() => setShowSocialsModal(false)}
      />
    </>
  );
};
