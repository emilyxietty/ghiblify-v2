import React, { lazy, Suspense, useEffect, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { useDockSurface } from "../../../contexts/DockSurfaceContext";
import {
  resolveWeatherDetail,
  sectionsForDetail,
} from "../../../config/widgetConfig";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useWeather, WeatherDaily } from "../../../hooks/useWeather";
import { useT } from "../../../i18n/i18n";
import { isManualPlace } from "../../../utils/geocoding";
// Lazy — the picker is a dialog most sessions never open.
const WeatherLocationModal = lazy(
  () => import("../../../components/WeatherLocationModal/WeatherLocationModal")
);
import "./Weather.css";

// Map a WMO weather code → a Meteocons SVG filename (without extension).
// Meteocons by Bas Milius (https://bas.dev/work/meteocons) — MIT licensed.
// Helpers `codeToIconName` and `iconUrl` live in `./weatherIcons.ts`
// (separate file so LeftSidebar's live weather chip can use them
// without dragging the whole Weather widget body into the main
// bundle). Import them locally where needed.
import { codeToIconName, iconUrl } from "./weatherIcons";

interface WeatherIconProps {
  code: number;
  isDay: boolean;
  style: "animated" | "still";
  className?: string;
}

const WeatherIcon: React.FC<WeatherIconProps> = ({
  code,
  isDay,
  style,
  className,
}) => (
  <img
    src={iconUrl(codeToIconName(code, isDay), style)}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={className}
  />
);

const formatHour = (iso: string, is24Hour: boolean) => {
  const d = new Date(iso);
  const h = d.getHours();
  if (is24Hour) return String(h).padStart(2, "0");
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
};

const Weather: React.FC = () => {
  const t = useT();
  const { widgets, dockShowBackgrounds, updateWidgetSettings } =
    useAppContext();
  const { settings: rawSettings } = useWidgetSettings("weather");
  const inDock = useDockSurface();
  const isHalfInDock =
    inDock && widgets.weather.dockWidth === "half";
  // Per-surface render overrides on top of the merged settings.
  // Stored settings are never mutated here — these only affect the
  // current render so the canvas / full-width instance keeps its
  // own state untouched.
  //   - Half-width dock: forecast strips would wrap, so the detail
  //     level is capped at "now" (an icon-only user keeps their icon).
  //   - Dock + global "Show backgrounds" on: force showCard so the
  //     card surface joins the rest of the dock chrome.
  const storedDetail = resolveWeatherDetail(rawSettings);
  const detail =
    isHalfInDock && storedDetail !== "icon" ? "now" : storedDetail;
  const settings = {
    ...rawSettings,
    ...(inDock && dockShowBackgrounds ? { showCard: true } : {}),
  };
  const manualPlace = isManualPlace(settings.manualPlace)
    ? settings.manualPlace
    : null;
  const useDeviceLocation = settings.useDeviceLocation !== false;
  const { data, loading, error, refresh } = useWeather(
    settings.unit,
    manualPlace,
    useDeviceLocation
  );

  // "Refresh weather" in the right-click menu can't reach this hook
  // directly (Widget.tsx renders the menu, not the widget body), so it
  // dispatches an event the same way the Pomodoro focus toggle does.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("ghiblify:weather:refresh", handler);
    return () =>
      window.removeEventListener("ghiblify:weather:refresh", handler);
  }, [refresh]);

  // "Choose a city" opens the modal. Only the canvas instance listens —
  // the dock renders a second Weather, and both answering would stack
  // two identical dialogs.
  const [locationOpen, setLocationOpen] = useState(false);
  useEffect(() => {
    if (inDock) return;
    const handler = () => setLocationOpen(true);
    window.addEventListener("ghiblify:weather:choose-city", handler);
    return () =>
      window.removeEventListener("ghiblify:weather:choose-city", handler);
  }, [inDock]);

  const unitSuffix = `°${settings.unit}`;
  // Borrow the Time widget's 12/24-hour preference so the hourly
  // forecast labels match the user's clock format (no separate setting).
  const is24Hour = !!widgets.time.settings.is24Hour;
  const iconStyle = settings.iconStyle ?? "animated";
  const sections = sectionsForDetail(detail);
  const iconsOnly = detail === "icon";

  // Both forecast strips are the same three-row cell — label, icon,
  // temperature — so they share one renderer instead of two near-copies.
  // A row without a `code` renders the placeholder icon, which is what
  // lets the loading state reuse this shape rather than duplicate it.
  interface StripRow {
    key: string;
    label: React.ReactNode;
    code?: number;
    value: React.ReactNode;
  }

  const strip = (rows: StripRow[], skeleton = false) => (
    <div className="weather-strip">
      {rows.map((row) => (
        <div
          className={`weather-strip-cell${skeleton ? " weather-skeleton" : ""}`}
          key={row.key}
        >
          <span className="weather-strip-label">{row.label}</span>
          {row.code === undefined ? (
            <span className="weather-strip-icon weather-icon-placeholder">
              <span className="weather-spinner" aria-hidden="true" />
            </span>
          ) : (
            <WeatherIcon
              code={row.code}
              isDay
              style={iconStyle}
              className="weather-strip-icon"
            />
          )}
          <span className="weather-strip-temp">{row.value}</span>
        </div>
      ))}
    </div>
  );

  const skeletonRows = (prefix: string): StripRow[] =>
    Array.from({ length: 5 }, (_, i) => ({
      key: `${prefix}-${i}`,
      label: (
        <span className="weather-skeleton-line weather-skeleton-cell-label" />
      ),
      value: (
        <span className="weather-skeleton-line weather-skeleton-cell-temp" />
      ),
    }));

  /**
   * Daily forecast, as rows with a temperature range bar.
   *
   * Both Apple's Weather and Google's forecast card render days this
   * way rather than as another strip of columns: a week of columns
   * identical to the hourly strip makes the two read as the same
   * information, and it gives you no sense of how the days compare.
   * A bar per day, scaled against the week's own min and max, makes
   * "Thursday is the cold one" visible without reading a single number.
   */
  const dailyRows = (rows: WeatherDaily[]) => {
    const min = Math.min(...rows.map((d) => d.low));
    const max = Math.max(...rows.map((d) => d.high));
    // Guard the degenerate case: a flat week would divide by zero.
    const span = max - min || 1;
    return (
      <div className="weather-days">
        {rows.map((d, i) => (
          <div className="weather-day-row" key={d.time}>
            <span className="weather-day-label">
              {i === 0
                ? t("weather.today")
                : t(`weather.weekday.${new Date(d.time).getDay()}`)}
            </span>
            <WeatherIcon
              code={d.weatherCode}
              isDay
              style={iconStyle}
              className="weather-day-icon"
            />
            <span className="weather-day-temp weather-day-low">
              {d.low}
              {unitSuffix}
            </span>
            <span className="weather-range" aria-hidden="true">
              <span
                className="weather-range-fill"
                style={{
                  left: `${((d.low - min) / span) * 100}%`,
                  right: `${((max - d.high) / span) * 100}%`,
                }}
              />
              {/* Today also carries a dot for the temperature right
                  now — the one day where "where in the range are we?"
                  has an answer. */}
              {i === 0 && data && (
                <span
                  className="weather-range-now"
                  style={{
                    left: `${
                      ((Math.min(Math.max(data.current.temperature, min), max) -
                        min) /
                        span) *
                      100
                    }%`,
                  }}
                />
              )}
            </span>
            <span className="weather-day-temp weather-day-high">
              {d.high}
              {unitSuffix}
            </span>
          </div>
        ))}
      </div>
    );
  };

  /** Current conditions. Every detail level shows this block; "icon
   *  only" is the same markup with the text hidden by CSS. */
  const conditions = (
    <div className="weather-current">
      {data ? (
        <WeatherIcon
          code={data.current.weatherCode}
          isDay={data.current.isDay}
          style={iconStyle}
          className="weather-icon"
        />
      ) : (
        <span className="weather-icon weather-icon-placeholder">
          <span className="weather-spinner" aria-hidden="true" />
        </span>
      )}
      <div className="weather-current-text">
        {data ? (
          <>
            <div className="weather-temp">
              {data.current.temperature}
              {unitSuffix}
            </div>
            <div className="weather-condition">
              {t(`weather.wmo.${data.current.weatherCode}`)}
            </div>
            <div className="weather-feels">
              {t("weather.feelsLike", {
                temp: `${data.current.apparent}${unitSuffix}`,
              })}
              {/* Today's range next to the current reading — the first
                  thing both Apple and Google put under the condition,
                  and it answers "is it going to get colder?" without
                  opening the daily list. */}
              {data.daily[0] && (
                <span className="weather-today-range">
                  {t("weather.hi", {
                    temp: `${data.daily[0].high}${unitSuffix}`,
                  })}
                  {" · "}
                  {t("weather.lo", {
                    temp: `${data.daily[0].low}${unitSuffix}`,
                  })}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="weather-skeleton-line weather-skeleton-temp" />
            <div className="weather-skeleton-line weather-skeleton-condition" />
            <div className="weather-skeleton-line weather-skeleton-feels" />
          </>
        )}
      </div>
    </div>
  );

  // Bucket the active WMO weather code (+ day/night) into a "mood"
  // tag the CSS uses to swap the card background. Keeping this in
  // JS rather than CSS attribute selectors with ranges so each
  // bucket is documented and easy to tweak.
  const moodFor = (code?: number, isDay?: boolean): string => {
    if (code == null) return "default";
    const day = isDay ?? true;
    if (code <= 1) return day ? "clear-day" : "clear-night";
    if (code === 2) return day ? "p-cloudy-day" : "p-cloudy-night";
    if (code === 3) return day ? "cloudy-day" : "cloudy-night";
    if (code >= 45 && code <= 48) return "fog";
    if (code >= 51 && code <= 67) return day ? "rain-day" : "rain-night";
    if (code >= 71 && code <= 77) return day ? "snow-day" : "snow-night";
    if (code >= 80 && code <= 82) return day ? "rain-day" : "rain-night";
    if (code >= 85 && code <= 86) return day ? "snow-day" : "snow-night";
    if (code >= 95) return "thunder";
    return "default";
  };
  const mood =
    settings.showCard && data
      ? moodFor(data.current.weatherCode, data.current.isDay)
      : undefined;

  // One body per state, chosen once — rather than four sibling blocks
  // each re-testing `!loading && error && …` and each opening its own
  // wrapper.
  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="weather-loading" role="status" aria-live="polite">
        {conditions}
        {sections.hourly && strip(skeletonRows("h"), true)}
        {/* The daily placeholder mirrors the row layout, not the strip:
            a skeleton in one shape that resolves into another reads as
            the widget jumping. */}
        {sections.daily && (
          <div className="weather-days">
            {Array.from({ length: 5 }, (_, i) => (
              <div className="weather-day-row weather-skeleton" key={i}>
                <span className="weather-skeleton-line weather-skeleton-cell-label" />
                <span className="weather-day-icon weather-icon-placeholder">
                  <span className="weather-spinner" aria-hidden="true" />
                </span>
                <span className="weather-skeleton-line weather-skeleton-cell-temp" />
                <span className="weather-range" />
                <span className="weather-skeleton-line weather-skeleton-cell-temp" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } else if (error === "offline") {
    body = (
      <div className="weather-current weather-na">
        <img
          src={chrome.runtime.getURL("assets/weather/Loading.gif")}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="weather-icon weather-offline-icon"
        />
        <div className="weather-current-text">
          <div className="weather-temp">{t("weather.unavailable")}</div>
        </div>
      </div>
    );
  } else if (error) {
    // Location-off is a normal state, not a failure — greet it with an
    // invitation (turn location on, or pick a city) rather than error
    // language. Both actions recover in place.
    const isPermission =
      error === "permission-denied" || error === "permission-unavailable";
    body = (
      <div className="weather-empty weather-error">
        <span className="weather-error-text">
          {isPermission ? t("weather.locationOff") : t("weather.fetchError")}
        </span>
        <div className="weather-error-actions">
          <button
            type="button"
            className="weather-error-action weather-error-action-primary"
            onClick={() => {
              if (isPermission) {
                updateWidgetSettings("weather", { useDeviceLocation: true });
              }
              refresh();
            }}
          >
            {isPermission ? t("weather.enableLocation") : t("weather.retry")}
          </button>
          {isPermission && (
            <button
              type="button"
              className="weather-error-action"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("ghiblify:weather:choose-city")
                )
              }
            >
              {t("weather.chooseCity")}
            </button>
          )}
        </div>
      </div>
    );
  } else if (data) {
    body = (
      <>
        {conditions}
        {sections.hourly &&
          strip(
            data.hourly.map((h, i) => ({
              key: h.time,
              // The leading cell is the current hour, so it reads as
              // "Now" rather than repeating the clock.
              label: i === 0 ? t("weather.now") : formatHour(h.time, is24Hour),
              code: h.weatherCode,
              value: (
                <>
                  {h.temperature}
                  {unitSuffix}
                </>
              ),
            }))
          )}
        {sections.daily && data.daily.length > 0 && dailyRows(data.daily)}
      </>
    );
  }

  return (
    <div
      className={`weather-widget widget-header${
        settings.showCard ? " weather-card-on" : ""
      }${iconsOnly ? " weather-icons-only" : ""}`}
      data-weather-mood={mood}
      style={{
        // Frosted: the .widget shell blurs the wallpaper (see
        // .widget-surface-frost) and the cell tint drops to a whisper
        // so the glass reads through.
        ["--weather-cell-opacity" as any]: (settings.frosted === true
          ? 0.14
          : (settings.opacity ?? 35) / 100
        ).toString(),
      }}
    >
      {body}
      {locationOpen && (
        <Suspense fallback={null}>
          <WeatherLocationModal
            open={locationOpen}
            onClose={() => setLocationOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Weather;
