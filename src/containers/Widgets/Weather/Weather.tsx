import React from "react";
import { useAppContext } from "../../../contexts/AppContext";
import {
  useWeather,
  WeatherDaily,
  WeatherHourly,
} from "../../../hooks/useWeather";
import { useT } from "../../../i18n/i18n";
import "./Weather.css";

// Map a WMO weather code → a Meteocons SVG filename (without extension).
// Meteocons by Bas Milius (https://bas.dev/work/meteocons) — MIT licensed.
// SVGs are the animated "fill" variant from the upstream `production/fill/svg/`
// directory; they self-animate via embedded SMIL when rendered as <img>.
// Day/night picks the matching glyph for codes 0–3; cloudier codes use
// the same icon either way.
export const codeToIconName = (code: number, isDay: boolean): string => {
  if (code === 0) return isDay ? "clear-day" : "clear-night";
  if (code === 1) return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  if (code === 2) return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  if (code === 3) return isDay ? "overcast-day" : "overcast-night";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunderstorms";
  return "cloudy";
};

export const iconUrl = (name: string, style: "animated" | "still"): string => {
  // Inside a Chrome extension we'd want chrome.runtime.getURL, but the
  // build pipeline already serves /public at the extension root, so a
  // root-relative path resolves identically and works in dev preview too.
  // Animated SVGs sit at the top level; their static counterparts are
  // mirrored in the `still/` subfolder.
  return style === "still"
    ? `/assets/weather/still/${name}.svg`
    : `/assets/weather/${name}.svg`;
};

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
  const { widgets } = useAppContext();
  const settings = widgets.weather.settings;
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

  return (
    <div
      className="weather-widget widget-header"
      style={{
        ["--weather-cell-opacity" as any]:
          ((settings.opacity ?? 35) / 100).toString(),
      }}
    >
      {loading && (
        <div className="weather-loading" role="status" aria-live="polite">
          <span className="weather-spinner" aria-hidden="true" />
        </div>
      )}
      {!loading && error && error === "offline" && (
        <div className="weather-current weather-na">
          <div className="weather-current-text">
            <div className="weather-temp">{t("weather.unavailable")}</div>
            <div className="weather-condition">{t("weather.offline")}</div>
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
