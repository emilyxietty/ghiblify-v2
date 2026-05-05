import React from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { useDockSurface } from "../../../contexts/DockSurfaceContext";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import {
  useWeather,
  WeatherDaily,
  WeatherHourly,
} from "../../../hooks/useWeather";
import { useT } from "../../../i18n/i18n";
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
  const { widgets, dockShowBackgrounds } = useAppContext();
  const { settings: rawSettings } = useWidgetSettings("weather");
  const inDock = useDockSurface();
  const isHalfInDock =
    inDock && widgets.weather.dockWidth === "half";
  // Per-surface render overrides on top of the merged settings.
  // Stored settings are never mutated here — these only affect the
  // current render so the canvas / full-width instance keeps its
  // own state untouched.
  //   - Half-width dock: forecast strips would wrap, so hide them.
  //   - Dock + global "Show backgrounds" on: force showCard so the
  //     card surface joins the rest of the dock chrome.
  const settings = {
    ...rawSettings,
    ...(isHalfInDock
      ? {
          sections: {
            ...rawSettings.sections,
            hourly: false,
            daily: false,
          },
        }
      : {}),
    ...(inDock && dockShowBackgrounds ? { showCard: true } : {}),
  };
  const { data, loading, error } = useWeather(settings.unit);

  const unitSuffix = `°${settings.unit}`;
  // Borrow the Time widget's 12/24-hour preference so the hourly
  // forecast labels match the user's clock format (no separate setting).
  const is24Hour = !!widgets.time.settings.is24Hour;
  const iconStyle = settings.iconStyle ?? "animated";
  const sections = settings.sections ?? {
    now: true,
    hourly: false,
    daily: false,
  };

  const renderHourly = (rows: WeatherHourly[]) => (
    <div className="weather-strip">
      {rows.map((h) => (
        <div className="weather-strip-cell" key={h.time}>
          <span className="weather-strip-label">{formatHour(h.time, is24Hour)}</span>
          <WeatherIcon
            code={h.weatherCode}
            isDay={true}
            style={iconStyle}
            className="weather-strip-icon"
          />
          <span className="weather-strip-temp">
            {h.temperature}
            {unitSuffix}
          </span>
        </div>
      ))}
    </div>
  );

  const renderDaily = (rows: WeatherDaily[]) => (
    <div className="weather-strip">
      {rows.map((d) => {
        const dow = new Date(d.time).getDay();
        return (
          <div className="weather-strip-cell" key={d.time}>
            <span className="weather-strip-label">
              {t(`weather.weekday.${dow}`)}
            </span>
            <WeatherIcon
              code={d.weatherCode}
              isDay={true}
              style={iconStyle}
              className="weather-strip-icon"
            />
            <span className="weather-strip-temp">
              {d.high}
              <span className="weather-strip-low">
                /{d.low}
                {unitSuffix}
              </span>
            </span>
          </div>
        );
      })}
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

  return (
    <div
      className={`weather-widget widget-header${
        settings.showCard ? " weather-card-on" : ""
      }`}
      data-weather-mood={mood}
      style={{
        ["--weather-cell-opacity" as any]:
          ((settings.opacity ?? 35) / 100).toString(),
      }}
    >
      {loading && (
        <div className="weather-loading" role="status" aria-live="polite">
          {sections.now && (
            <div className="weather-current weather-skeleton">
              <span className="weather-icon weather-icon-placeholder">
                <span className="weather-spinner" aria-hidden="true" />
              </span>
              <div className="weather-current-text">
                <div className="weather-skeleton-line weather-skeleton-temp" />
                <div className="weather-skeleton-line weather-skeleton-condition" />
                <div className="weather-skeleton-line weather-skeleton-feels" />
              </div>
            </div>
          )}
          {sections.hourly && (
            <div className="weather-strip">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="weather-strip-cell weather-skeleton" key={i}>
                  <span className="weather-skeleton-line weather-skeleton-cell-label" />
                  <span className="weather-strip-icon weather-icon-placeholder">
                    <span className="weather-spinner" aria-hidden="true" />
                  </span>
                  <span className="weather-skeleton-line weather-skeleton-cell-temp" />
                </div>
              ))}
            </div>
          )}
          {sections.daily && (
            <div className="weather-strip">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="weather-strip-cell weather-skeleton" key={i}>
                  <span className="weather-skeleton-line weather-skeleton-cell-label" />
                  <span className="weather-strip-icon weather-icon-placeholder">
                    <span className="weather-spinner" aria-hidden="true" />
                  </span>
                  <span className="weather-skeleton-line weather-skeleton-cell-temp" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!loading && error && error === "offline" && (
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
      )}
      {!loading && error && error !== "offline" && (
        <div className="weather-empty weather-error">
          {error === "permission-denied"
            ? t("weather.permissionDenied")
            : error === "permission-unavailable"
              ? t("weather.permissionUnavailable")
              : t("weather.fetchError")}
        </div>
      )}
      {!loading && !error && data && (
        <>
          {sections.now && (
            <div className="weather-current">
              <WeatherIcon
                code={data.current.weatherCode}
                isDay={data.current.isDay}
                style={iconStyle}
                className="weather-icon"
              />
              <div className="weather-current-text">
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
                </div>
              </div>
            </div>
          )}
          {sections.hourly &&
            data.hourly.length > 0 &&
            renderHourly(data.hourly)}
          {sections.daily &&
            data.daily.length > 0 &&
            renderDaily(data.daily)}
        </>
      )}
    </div>
  );
};

export default Weather;
