import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
// Lazy - these dialogs only render when the user clicks their trigger,
// so each becomes its own chunk fetched on first open. They eagerly
// shipped ~1700 LOC of JSX/logic with the initial bundle before this.
const BackgroundSettingsModal = lazy(() =>
  import("../../components/BackgroundSettingsModal/BackgroundSettingsModal").then(
    (m) => ({ default: m.BackgroundSettingsModal }),
  ),
);
const ChangelogModal = lazy(() =>
  import("../../components/ChangelogModal/ChangelogModal").then((m) => ({
    default: m.ChangelogModal,
  })),
);
const ReportModal = lazy(() => import("../../components/ReportModal/ReportModal"));
const SocialsModal = lazy(() => import("../../components/SocialsModal/SocialsModal"));
const SettingsModal = lazy(() =>
  import("../../components/SettingsModal/SettingsModal"),
);
import type { SettingsSection } from "../../components/SettingsModal/SettingsModal";
import { WeatherSettings } from "../../config/widgetConfig";
import { useWeather } from "../../hooks/useWeather";
import { isManualPlace } from "../../utils/geocoding";
import { DeleteOutlineIcon, FormatQuoteIcon, RefreshIcon, RestoreIcon, SearchIcon, StickyNote2Icon, WbSunnyIcon, AppsIcon } from "../../components/Icons/Icons";
import { AccessTimeFilledIcon, BookmarksIcon, BugReportIcon, CalendarTodayIcon, CheckBoxIcon, EmojiEmotionsIcon, ExpandMoreIcon, FavoriteBorderIcon, FavoriteIcon, HelpOutlineIcon, LinkIcon, LocalCafeIcon, PersonAddIcon, SettingsIcon, StarIcon, TimerIcon, VerticalSplitIcon } from "../../components/Icons/Icons";
import {
  codeToIconName,
  iconUrl as weatherIconUrl,
} from "../Widgets/Weather/weatherIcons";

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
  CORNER_STYLES,
  CornerStyle,
  CURSOR_NAMES,
  FONT_NAMES,
  FontName,
  normalizeCursor,
  ThemeName,
  useAppContext,
} from "../../contexts/AppContext";
import { LANGUAGES, getLocale, setLocale, useT } from "../../i18n/i18n";
import { isEditableTarget } from "../../utils/isEditableTarget";
import { ContextMenu } from "../../components/ContextMenu/ContextMenu";
import {
  hasPermission,
  removePermission,
  requestPermission,
} from "../../utils/chromePermissions";
import { clearWeatherLocation } from "../../hooks/useWeather";
import {
  readBlacklist,
  readFavorites,
  writeBlacklist,
  writeFavorites,
} from "../../storage/backgroundStorage";
import "./LeftSidebar.css";

// Font preview metadata. The label appears as the swatch text and is
// rendered IN that font so the picker doubles as a live preview.
// Keep keys in sync with FONT_NAMES (AppContext) + the @font-face
// rules in App.css. "Default" is the only label that needs i18n;
// the others are font brand names so they stay literal.
const FONT_PREVIEW: Record<FontName, { label: string; family: string }> = {
  default: { label: "Default", family: "var(--font-system)" },
  fredoka: { label: "Fredoka", family: "'Fredoka', var(--font-system)" },
  "space-mono": {
    label: "Space Mono",
    family: "'Space Mono', var(--font-system-mono)",
  },
};

// Theme keys - labels come from i18n at render time so they translate.
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
  { key: "weather", icon: <WbSunnyIcon /> },
  { key: "notes", icon: <StickyNote2Icon /> },
  { key: "googleApps", icon: <AppsIcon /> },
  // NOTE: bookmarks + rightSidebar are deliberately absent - they
  // share the right edge, so a single combined tile at the end of the
  // grid owns both (see EDGE_PANEL_KEYS below).
];

/** The two panels that compete for the right edge. Only one can be on
 *  at a time, but rather than showing two toggles and greying one out
 *  ("disable X first to enable Y" - the app asking the user to solve
 *  its own layout constraint), one tile represents the edge and a
 *  picker chooses which panel occupies it. */
const EDGE_PANEL_KEYS = ["bookmarks", "rightSidebar"] as const;
type EdgePanelKey = (typeof EDGE_PANEL_KEYS)[number];

const FILTER_UNITS: Record<keyof BackgroundFilters, "px" | "percent"> = {
  blur: "px",
  brightness: "percent",
  contrast: "percent",
  saturation: "percent",
};

export const LeftSidebar: React.FC = () => {
  const t = useT();
  // Right-click dropdown on a widget toggle: Edit / Show-Hide /
  // permission switches where the widget has one. Anchored at the
  // cursor; permission state is fetched when the menu opens (checkbox
  // needs a concrete value, and the API is async).
  const [toggleMenu, setToggleMenu] = useState<{
    key: WidgetKey;
    x: number;
    y: number;
  } | null>(null);
  const [menuPermGranted, setMenuPermGranted] = useState<boolean | null>(
    null
  );
  // Anchor for the right-edge panel picker (bookmarks vs dock).
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const {
    widgets,
    toggleWidgetVisibility,
    setEditingWidgetKey,
    updateWidgetSettings,
    backgroundFilters,
    updateBackgroundFilters,
    backgroundParallax,
    setBackgroundParallax,
    appearance,
    updateAppearance,
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

  // Favorites - read on mount, refresh whenever any consumer broadcasts
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

  // Live weather icon for the toggle - mirrors whatever Meteocons
  // glyph is currently showing in the Weather widget. The hook is
  // already cached, so calling it from the sidebar doesn't trigger a
  // second API request.
  const weatherSettings = widgets.weather.settings as WeatherSettings;
  const { data: weatherData } = useWeather(
    weatherSettings.unit,
    isManualPlace(weatherSettings.manualPlace)
      ? weatherSettings.manualPlace
      : null,
    weatherSettings.useDeviceLocation !== false
  );
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
  // enough - going from one non-spotlit slide to another (e.g.
  // adjustTime → drag, both spotlight=null) didn't change the value,
  // so the open-on-spotlight effect didn't re-fire. Combined with the
  // mouse-move auto-close handler below, that left the sidebar shut
  // and unreachable when navigating back through the guide.
  // "welcome" is the opening slide: the guide is up but the sidebar
  // must stay shut so the landing screen is the only lit thing on
  // screen. It slides in from the next slide onward.
  const guideWantsSidebar =
    (showGuide || !!sidebarSpotlight) && sidebarSpotlight !== "welcome";
  useEffect(() => {
    if (guideWantsSidebar) setIsOpen(true);
    else if (sidebarSpotlight === "welcome") setIsOpen(false);
  }, [guideWantsSidebar, sidebarSpotlight]);
  const [filters, setFilters] = useState<BackgroundFilters>(backgroundFilters);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSocialsModal, setShowSocialsModal] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  // Which slice the settings dialog opens on. null = closed; "all" is
  // the footer button, the rest come from each section's heading cog.
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  // Force the palette collapsible open while the welcome guide is
  // spotlighting the "palette" step so swatches are visible without
  // the user having to expand it. We don't force it closed afterward
  // - once the user has it open, leave it open.
  // The Appearance slide talks about palette, font AND corners, so
  // open every collapsible in the section rather than just the
  // palette one - otherwise two of the three things the slide names
  // are still folded away behind a summary.
  // The guide demos this menu on the "Edit widgets" slide - it's one
  // of the three routes into editing a widget, and the least
  // discoverable, so the tour opens it for real rather than just
  // describing it. Positioned off the toggle's own rect since there's
  // no cursor to read coordinates from.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const key = (e as CustomEvent).detail?.key as WidgetKey | undefined;
      if (!key) return;
      const btn = sidebarRef.current?.querySelector<HTMLElement>(
        `[data-widget-toggle="${key}"]`,
      );
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setMenuPermGranted(null);
      setToggleMenu({ key, x: r.right + 6, y: r.bottom + 4 });
    };
    const onClose = () => setToggleMenu(null);
    window.addEventListener("ghiblify:open-toggle-menu", onOpen);
    window.addEventListener("ghiblify:close-toggle-menu", onClose);
    return () => {
      window.removeEventListener("ghiblify:open-toggle-menu", onOpen);
      window.removeEventListener("ghiblify:close-toggle-menu", onClose);
    };
  }, []);

  // Each guide slide gets a clean sidebar: the collapsibles belonging
  // to the spotlit section open, and every other one folds away.
  // Previously panels only ever opened, so by the time the tour
  // reached Backgrounds the palette, font, corner and cursor pickers
  // were all still expanded and the highlighted button was pushed off
  // screen behind them.
  const appearanceSectionRef = useRef<HTMLElement | null>(null);
  // Runs on every slide change for the whole tour, not just the
  // spotlit ones - otherwise stepping off Appearance onto a slide with
  // no spotlight left the palette / font / corner pickers hanging open
  // for the rest of the guide.
  useEffect(() => {
    if (!showGuide && !sidebarSpotlight) return;
    const section =
      sidebarSpotlight === "palette" ? appearanceSectionRef.current : null;
    sidebarRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details.filter-collapsible")
      .forEach((d) => {
        d.open = !!section && section.contains(d);
      });
  }, [showGuide, sidebarSpotlight]);

  // Mirror the spotlight state onto the body so the welcome modal's
  // CSS can push its dialog clear of the force-opened sidebar on
  // narrow viewports (otherwise the sidebar covers the dialog and
  // makes it unreachable).
  useEffect(() => {
    if (sidebarSpotlight) {
      document.body.classList.add("spotlight-active");
      return () => document.body.classList.remove("spotlight-active");
    }
  }, [sidebarSpotlight]);

  // Edge-hover open + outside close (mouse UX preserved). While the
  // welcome guide is open the auto-close branch is skipped so the
  // sidebar stays put for the spotlight tour - the user shouldn't
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
      // Same guard as the bookmarks Cmd+B - don't hijack combos from
      // an editable surface (Notes editor, search inputs).
      if (isEditableTarget(e.target)) return;
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
          guideWantsSidebar ? " sidebar-spotlight" : ""
        }${sidebarSpotlight ? ` spotlight-${sidebarSpotlight}` : ""}`}
        aria-label={t("sidebar.ariaLabel")}
        // Drive the visible width from the same SIDEBAR_WIDTH
        // constant used by the close-trigger logic, so the JS and
        // CSS sources of truth can't drift.
        style={{ ["--sidebar-width" as any]: `${SIDEBAR_WIDTH}px` }}
      >
        <div className="sidebar-content">
          {/* Pinned header - Guide / My Socials / Buy Me a Coffee
              stay visible at the top of the sidebar even when the
              sections below scroll on a short viewport. Same pattern
              as the .sidebar-footer at the bottom. */}
          <div className="sidebar-section button-group sidebar-header" role="group">
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
              <PersonAddIcon style={{ fontSize: 14 }} />
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

          {/* Scrolling middle - sections between the top button band and
              the bottom button band scroll independently. The header
              and footer divs sit outside this wrapper as flex
              siblings so they stay fixed at top/bottom of the
              sidebar regardless of how much content the user has. */}
          <div className="sidebar-scroll">
          <section
            className="sidebar-section"
            aria-labelledby="widgets-heading"
          >
            <div className="section-heading-row">
              <h4 id="widgets-heading">{t("sidebar.headings.widgets")}</h4>
              <button
                type="button"
                className="widgets-settings-btn"
                aria-label={t("settings.section.widgets")}
                data-tooltip={t("settings.section.widgets")}
                onClick={() => setSettingsSection("widgets")}
              >
                <SettingsIcon style={{ fontSize: 16 }} />
              </button>
            </div>
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
                    data-widget-toggle={key}
                    className={`widget-icon${visible ? " active" : ""}`}
                    icon={renderedIcon}
                    size="medium"
                    variant="transparent"
                    onClick={() => toggleWidgetVisibility(key)}
                    // Right-click = quick-actions dropdown for this
                    // widget (edit / show-hide / permissions).
                    onContextMenu={(e: React.MouseEvent) => {
                      e.preventDefault();
                      setMenuPermGranted(null);
                      const perm =
                        key === "searchbar" ? "audioCapture" : null;
                      if (perm) {
                        void hasPermission(perm).then(setMenuPermGranted);
                      }
                      setToggleMenu({ key, x: e.clientX, y: e.clientY });
                    }}
                    aria-label={t(
                      visible ? "widgets.tooltip.hide" : "widgets.tooltip.show",
                      { name },
                    )}
                    aria-pressed={visible}
                    data-tooltip={name}
                  />
                );
              })}
              {(() => {
                // One tile for the right edge. Reads as "on" whenever
                // EITHER panel is showing, and clicking it opens a
                // radio picker rather than blindly toggling, since
                // "on" is ambiguous between two panels.
                const active = EDGE_PANEL_KEYS.find(
                  (k) => widgets[k].visible,
                );
                const label = t("sidebar.edgePanel.label");
                return (
                  <Button
                    data-widget-toggle="rightSidebar"
                    className={`widget-icon${active ? " active" : ""}`}
                    icon={
                      active === "bookmarks" ? (
                        <BookmarksIcon />
                      ) : (
                        <VerticalSplitIcon />
                      )
                    }
                    size="medium"
                    variant="transparent"
                    onClick={(e: React.MouseEvent) => {
                      const r = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setEdgeMenu({ x: r.left, y: r.bottom + 4 });
                    }}
                    aria-haspopup="menu"
                    aria-expanded={!!edgeMenu}
                    aria-pressed={!!active}
                    aria-label={label}
                    data-tooltip={
                      active ? t(`widgets.names.${active}`) : label
                    }
                  />
                );
              })()}
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
          </section>

          <section
            ref={appearanceSectionRef}
            className="sidebar-section appearance-section"
            aria-labelledby="appearance-heading"
          >
            <div className="section-heading-row">
              <h4 id="appearance-heading">{t("sidebar.headings.appearance")}</h4>
              <button
                type="button"
                className="widgets-settings-btn"
                aria-label={t("settings.section.appearance")}
                data-tooltip={t("settings.section.appearance")}
                onClick={() => setSettingsSection("appearance")}
              >
                <SettingsIcon style={{ fontSize: 16 }} />
              </button>
            </div>
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
            {/* Font picker - each option is rendered IN that font so the
                swatch list doubles as a live preview. Sits below the
                palette as a sibling collapsible inside Appearance. */}
            {/* Font and Corners are full-width collapsibles like the
                palette and cursor pickers above them. The select-popup
                version squeezed both onto one row, which left each
                trigger too narrow to show anything but an icon and made
                the row read as denser than the sections around it. */}
            <details className="filter-collapsible">
              <summary className="filter-collapsible-summary">
                <span>{t("sidebar.fonts.heading")}</span>
                <span
                  className="collapsible-preview"
                  aria-hidden="true"
                  data-tooltip={
                    appearance.font === "default"
                      ? t("sidebar.fonts.default")
                      : FONT_PREVIEW[appearance.font].label
                  }
                  style={{ fontFamily: FONT_PREVIEW[appearance.font].family }}
                >
                  Aa
                </span>
                <ExpandMoreIcon
                  className="filter-collapsible-chevron"
                  fontSize="small"
                />
              </summary>
              <div
                className="filter-group"
                role="radiogroup"
                aria-label={t("sidebar.fonts.aria")}
              >
                <div className="font-swatches">
                  {FONT_NAMES.map((name) => {
                    const meta = FONT_PREVIEW[name];
                    const selected = appearance.font === name;
                    const label =
                      name === "default"
                        ? t("sidebar.fonts.default")
                        : meta.label;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`font-swatch${
                          selected ? " is-selected" : ""
                        }`}
                        style={{ fontFamily: meta.family }}
                        onClick={() => updateAppearance({ font: name })}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>

            <details className="filter-collapsible">
              <summary className="filter-collapsible-summary">
                <span>{t("settings.corners")}</span>
                {/* Preview reuses the swatch chip, so it always draws
                    the same shape as the option it stands for. */}
                <span
                  className={`collapsible-preview corner-swatch-${
                    appearance.corners ?? "rounded"
                  }`}
                  data-tooltip={t(
                    `settings.cornerStyle.${appearance.corners ?? "rounded"}`
                  )}
                >
                  <span className="corner-swatch-chip" aria-hidden="true" />
                </span>
                <ExpandMoreIcon
                  className="filter-collapsible-chevron"
                  fontSize="small"
                />
              </summary>
              <div
                className="filter-group"
                role="radiogroup"
                aria-label={t("settings.corners")}
              >
                <div className="corner-swatches">
                  {CORNER_STYLES.map((name) => {
                    const active = (appearance.corners ?? "rounded") === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`corner-swatch corner-swatch-${name}${
                          active ? " is-active" : ""
                        }`}
                        onClick={() => updateAppearance({ corners: name })}
                      >
                        <span className="corner-swatch-chip" aria-hidden="true" />
                        {t(`settings.cornerStyle.${name}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          </section>

          <section
            className="sidebar-section"
            aria-labelledby="background-heading"
          >
            <div className="section-heading-row">
              <h4 id="background-heading">{t("sidebar.headings.background")}</h4>
              <button
                type="button"
                className="widgets-settings-btn"
                aria-label={t("settings.section.background")}
                data-tooltip={t("settings.section.background")}
                onClick={() => setSettingsSection("background")}
              >
                <SettingsIcon style={{ fontSize: 16 }} />
              </button>
            </div>
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
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("ghiblify:background:refresh"),
                  )
                }
                aria-label={t("sidebar.buttons.refreshBackgroundAria")}
                data-tooltip={t("sidebar.buttons.refreshBackground")}
                disabled={!currentBackground}
                className="background-actions-refresh"
              >
                <RefreshIcon style={{ fontSize: 16 }} />
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
            <div className="section-heading-row">
              <h4 id="cursor-heading">{t("sidebar.headings.cursor")}</h4>
              <button
                type="button"
                className="widgets-settings-btn"
                aria-label={t("settings.section.cursor")}
                data-tooltip={t("settings.section.cursor")}
                onClick={() => setSettingsSection("cursor")}
              >
                <SettingsIcon style={{ fontSize: 16 }} />
              </button>
            </div>
            <details className="filter-collapsible">
              <summary className="filter-collapsible-summary">
                <span>{t("sidebar.filters.heading")}</span>
                {(() => {
                  const cur = normalizeCursor(appearance.cursor);
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
                const active = normalizeCursor(appearance.cursor) === name;
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
          </div>

          {/* Bottom button group - sits as a flex sibling of the
              scrolling middle so it stays fixed at the sidebar
              bottom regardless of scroll position. */}
          <div className="sidebar-footer">
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
              {/* Permissions, the storage inspector and the master
                  reset - everything that acts on saved data rather
                  than on a single widget. */}
              <Button
                variant="dark"
                size="small"
                onClick={() => setSettingsSection("all")}
                aria-label={t("settings.buttonAria")}
                aria-haspopup="dialog"
                data-tooltip={t("settings.title")}
              >
                <SettingsIcon style={{ fontSize: 14 }} />
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

            {/* Version chip - clickable, opens the changelog modal which
                now points users at the Discord for release notes. Pulls
                the version straight from the manifest at runtime so the
                chip can never drift from what actually shipped. */}
            <button
              type="button"
              className="sidebar-version"
              onClick={() => setShowChangelog(true)}
              aria-label={t("changelog.openAria", {
                version: chrome.runtime.getManifest().version,
              })}
              data-tooltip={t("changelog.openTooltip")}
            >
              v{chrome.runtime.getManifest().version}
            </button>
          </div>
        </div>
      </aside>
      {toggleMenu &&
        (() => {
          const key = toggleMenu.key;
          const isVisible = widgets[key].visible;
          const name = t(`widgets.names.${key}`);
          const items: React.ComponentProps<typeof ContextMenu>["items"] = [];
          // Edge panels have no canvas edit surface.
          if (key !== "bookmarks" && key !== "rightSidebar") {
            items.push({
              type: "action",
              label: t("widgets.contextMenu.edit", { name }),
              onClick: () => {
                if (!widgets[key].visible) toggleWidgetVisibility(key);
                setEditingWidgetKey(key);
                setIsOpen(false);
              },
            });
          }
          items.push({
            type: "action",
            label: t(
              isVisible ? "widgets.tooltip.hide" : "widgets.tooltip.show",
              { name }
            ),
            onClick: () => toggleWidgetVisibility(key),
          });
          // Chrome-grant switches, where the widget has one. The click
          // is a real user gesture, which permissions.request needs.
          if (key === "bookmarks" || key === "searchbar") {
            const permName =
              key === "bookmarks" ? ("bookmarks" as const) : ("audioCapture" as const);
            items.push({ type: "separator" });
            items.push({
              type: "checkbox",
              label: t(
                key === "bookmarks"
                  ? "settings.permissionBookmarks"
                  : "settings.permissionMicrophone"
              ),
              checked: menuPermGranted === true,
              onClick: () => {
                if (menuPermGranted) {
                  void removePermission(permName).then(
                    () => void setMenuPermGranted(false)
                  );
                } else {
                  void requestPermission(permName).then((ok) =>
                    setMenuPermGranted(ok)
                  );
                }
              },
            });
          }
          if (key === "weather") {
            const useDev =
              (widgets.weather.settings as WeatherSettings)
                .useDeviceLocation !== false;
            items.push({ type: "separator" });
            items.push({
              type: "checkbox",
              label: t("settings.permissionGeolocation"),
              checked: useDev,
              onClick: () => {
                updateWidgetSettings("weather", {
                  useDeviceLocation: !useDev,
                });
                if (useDev) {
                  // Off must forget the cached coords too.
                  clearWeatherLocation();
                  window.dispatchEvent(
                    new CustomEvent("ghiblify:weather:refresh")
                  );
                }
              },
            });
          }
          return (
            <ContextMenu
              position={{ x: toggleMenu.x, y: toggleMenu.y }}
              items={items}
              onClose={() => setToggleMenu(null)}
            />
          );
        })()}
      {edgeMenu && (
        <ContextMenu
          position={edgeMenu}
          onClose={() => setEdgeMenu(null)}
          items={[
            // Radio rows, so the either/or nature is visible rather
            // than implied by one option greying the other out.
            ...EDGE_PANEL_KEYS.map((k) => ({
              type: "radio" as const,
              label: t(`widgets.names.${k}`),
              selected: widgets[k].visible,
              onClick: () => {
                // Turning one on turns the other off - the whole point
                // of the tile. Re-picking the active one is a no-op;
                // "Off" below is how you clear the edge.
                EDGE_PANEL_KEYS.forEach((other) => {
                  if (widgets[other].visible !== (other === k))
                    toggleWidgetVisibility(other);
                });
                setEdgeMenu(null);
              },
            })),
            { type: "separator" as const },
            {
              type: "radio" as const,
              label: t("sidebar.edgePanel.off"),
              selected: !EDGE_PANEL_KEYS.some((k) => widgets[k].visible),
              onClick: () => {
                EDGE_PANEL_KEYS.forEach((k) => {
                  if (widgets[k].visible) toggleWidgetVisibility(k);
                });
                setEdgeMenu(null);
              },
            },
          ]}
        />
      )}
      <Suspense fallback={null}>
        {showBackgroundSettings && (
          <BackgroundSettingsModal
            showBackgroundSettings={showBackgroundSettings}
            setShowBackgroundSettings={setShowBackgroundSettings}
          />
        )}
        {showReportModal && (
          <ReportModal
            open={showReportModal}
            onClose={() => setShowReportModal(false)}
          />
        )}
        {showChangelog && (
          <ChangelogModal
            open={showChangelog}
            onClose={() => setShowChangelog(false)}
          />
        )}
        {showSocialsModal && (
          <SocialsModal
            open={showSocialsModal}
            onClose={() => setShowSocialsModal(false)}
          />
        )}
        {settingsSection && (
          <SettingsModal
            open
            section={settingsSection}
            onClose={() => setSettingsSection(null)}
          />
        )}
      </Suspense>
    </>
  );
};
