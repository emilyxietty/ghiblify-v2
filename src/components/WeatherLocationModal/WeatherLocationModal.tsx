import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WeatherSettings } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { clearWeatherLocation } from "../../hooks/useWeather";
import { useT } from "../../i18n/i18n";
import { GeoResult, isManualPlace, searchPlaces } from "../../utils/geocoding";
import {
  CloseIcon,
  MyLocationIcon,
  PlaceIcon,
  RefreshIcon,
} from "../Icons/Icons";
import "./WeatherLocationModal.css";

const DEBOUNCE_MS = 300;

interface WeatherLocationModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Where the weather comes from.
 *
 * A modal rather than a panel inside the widget: the widget is small,
 * often docked, and a search field with six results doesn't fit in it —
 * the old popover ended up scrolling inside a 200px card.
 *
 * Two ways to answer "where am I?":
 *   - Auto — `navigator.geolocation`, which needs the optional
 *     `geolocation` permission. The button here is what requests it.
 *   - A city typed by name, resolved through Open-Meteo's geocoder. That
 *     path needs no permission at all, which is the point: someone who
 *     never wants to share their location can still see their weather.
 */
export const WeatherLocationModal: React.FC<WeatherLocationModalProps> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const { widgets, updateWidgetSettings } = useAppContext();
  const settings = widgets.weather.settings as WeatherSettings;
  const manual = isManualPlace(settings.manualPlace)
    ? settings.manualPlace
    : null;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">(
    "idle"
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);


  // Debounced search. The AbortController matters more than the debounce:
  // a fast typist can otherwise have an early, slower response land after
  // a later one and overwrite the list with stale cities.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchPlaces(q, controller.signal);
        setResults(found);
        setStatus(found.length ? "idle" : "empty");
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setResults([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setStatus("idle");
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const refreshWeather = () =>
    window.dispatchEvent(new CustomEvent("ghiblify:weather:refresh"));

  const pick = (place: GeoResult) => {
    updateWidgetSettings("weather", {
      manualPlace: { name: place.name, lat: place.lat, lon: place.lon },
    });
    refreshWeather();
    onClose();
  };

  const useMyLocation = () => {
    // No permission request here: `geolocation` is on Chrome's list of
    // permissions that CANNOT be optional for extensions, so it's
    // granted at install and the user-facing switch is purely our own
    // setting.
    updateWidgetSettings("weather", {
      manualPlace: null,
      useDeviceLocation: true,
    });
    // The manual city's coordinates are cached under the same key the
    // device position uses; without clearing them the widget would keep
    // reporting the old city for the rest of the coords TTL.
    clearWeatherLocation();
    refreshWeather();
    onClose();
  };

  // Portalled to <body>: this renders from inside the Weather widget,
  // whose shell carries a `transform` — and a transformed ancestor makes
  // `position: fixed` resolve against that element instead of the
  // viewport, so the backdrop covered the widget rather than the page.
  return createPortal(
    <div className="weather-location-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="weather-location-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weather-location-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="weather-location-close"
          aria-label={t("modal.common.closeAria")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <h2 id="weather-location-title" className="weather-location-title">
          {t("widgets.contextMenu.weatherLocation")}
        </h2>
        <p className="weather-location-current">
          <PlaceIcon style={{ fontSize: 14 }} />
          {manual ? manual.name : t("widgets.edit.weatherLocationAuto")}
        </p>

        <div className="weather-location-actions">
          <button
            type="button"
            className="weather-location-action weather-location-action-primary"
            onClick={useMyLocation}
          >
            <MyLocationIcon style={{ fontSize: 15 }} />
            {t("widgets.edit.weatherLocationUseMine")}
          </button>
          <button
            type="button"
            className="weather-location-action"
            onClick={() => {
              refreshWeather();
              onClose();
            }}
          >
            <RefreshIcon style={{ fontSize: 14 }} />
            {t("widgets.edit.weatherLocationRefresh")}
          </button>
        </div>

        <p className="weather-location-hint">
          {t("widgets.edit.weatherLocationHint")}
        </p>

        <input
          ref={inputRef}
          type="search"
          className="weather-location-input"
          value={query}
          placeholder={t("widgets.edit.weatherLocationPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="weather-location-results" role="listbox">
          {status === "loading" && (
            <div className="weather-location-hint">
              {t("widgets.edit.weatherLocationSearching")}
            </div>
          )}
          {status === "empty" && (
            <div className="weather-location-hint">
              {t("widgets.edit.weatherLocationNoResults")}
            </div>
          )}
          {status === "error" && (
            <div className="weather-location-hint">
              {t("widgets.edit.weatherLocationError")}
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={manual?.name === r.name}
              className="weather-location-result"
              onClick={() => pick(r)}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WeatherLocationModal;
