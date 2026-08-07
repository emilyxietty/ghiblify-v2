import React, { useEffect, useRef, useState } from "react";
import { WeatherSettings } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import {
  clearWeatherLocation,
  getDeviceLocationLabel,
} from "../../hooks/useWeather";
import { useT } from "../../i18n/i18n";
import { GeoResult, isManualPlace, searchPlaces } from "../../utils/geocoding";
import { DialogShell } from "../DialogShell/DialogShell";
import { MyLocationIcon, PlaceIcon, RefreshIcon } from "../Icons/Icons";
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
 * often docked, and a search field with six results doesn't fit in it -
 * the old popover ended up scrolling inside a 200px card.
 *
 * Two ways to answer "where am I?":
 *   - This device's location, resolved from the caller's IP (no
 *     permission prompt - see getGeolocationCoords in useWeather).
 *   - A city typed by name, resolved through Open-Meteo's geocoder. That
 *     path needs no network identity at all, which is the point: someone
 *     who never wants to share their location can still see their
 *     weather.
 *
 * One screen, both offers visible: the state line says where the
 * forecast is coming from now, the button does the one thing worth
 * doing to that state (switch it on, switch back to it, or refresh it),
 * and the search field below is always ready for a city. A step-by-step
 * version of this made you navigate to reach either answer, which is a
 * lot of ceremony for a two-option question.
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
  const deviceOn = settings.useDeviceLocation !== false;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">(
    "idle",
  );
  // Read on open rather than on every render: it comes from
  // localStorage, and re-reading mid-render would make the label
  // flicker as the widget's own lookup writes to the same cache.
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
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
    setDeviceLabel(getDeviceLocationLabel());
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const refreshWeather = () =>
    window.dispatchEvent(new CustomEvent("ghiblify:weather:refresh"));

  const pick = (place: GeoResult) => {
    updateWidgetSettings("weather", {
      manualPlace: { name: place.name, lat: place.lat, lon: place.lon },
    });
    refreshWeather();
    onClose();
  };

  const useDeviceLocation = () => {
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

  // What the forecast is following right now.
  const current = manual
    ? manual.name
    : deviceOn
      ? (deviceLabel ?? t("widgets.edit.weatherLocationLocating"))
      : t("widgets.edit.weatherLocationDeviceOff");

  // The one action worth offering that state. Off: switch it on. On but
  // following a typed city: switch back to the device. On and already
  // following the device: there's nothing to change, so re-fetch.
  const primary = !deviceOn
    ? {
        label: t("widgets.edit.weatherLocationEnable"),
        icon: <MyLocationIcon style={{ fontSize: 15 }} />,
        run: useDeviceLocation,
      }
    : manual
      ? {
          label: t("widgets.edit.weatherLocationUseMine"),
          icon: <MyLocationIcon style={{ fontSize: 15 }} />,
          run: useDeviceLocation,
        }
      : {
          label: t("widgets.edit.weatherLocationRefresh"),
          icon: <RefreshIcon style={{ fontSize: 14 }} />,
          run: () => {
            refreshWeather();
            onClose();
          },
        };

  // Portalled to <body>: this renders from inside the Weather widget,
  // whose shell carries a `transform` - and a transformed ancestor makes
  // `position: fixed` resolve against that element instead of the
  // viewport, so the backdrop covered the widget rather than the page.
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      backdropClassName="weather-location-backdrop"
      dialogClassName="weather-location-dialog"
      labelledBy="weather-location-title"
      closeClassName="weather-location-close"
      closeLabel={t("modal.common.closeAria")}
      portal
    >
      <h2 id="weather-location-title" className="weather-location-title">
        {t("widgets.contextMenu.weatherLocation")}
      </h2>

      <p className="weather-location-current">
        <PlaceIcon style={{ fontSize: 14 }} />
        {current}
      </p>

      <div className="weather-location-actions">
        <button
          type="button"
          className="weather-location-action weather-location-action-primary"
          onClick={primary.run}
        >
          {primary.icon}
          {primary.label}
        </button>
        {/* A second button only when it would do something the primary
            doesn't: with the device already followed, "refresh" IS the
            primary and a duplicate would just be noise. */}
        {(manual || !deviceOn) && deviceOn && (
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
        )}
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
          <div className="weather-location-result-hint">
            {t("widgets.edit.weatherLocationSearching")}
          </div>
        )}
        {status === "empty" && (
          <div className="weather-location-result-hint">
            {t("widgets.edit.weatherLocationNoResults")}
          </div>
        )}
        {status === "error" && (
          <div className="weather-location-result-hint">
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
    </DialogShell>
  );
};

export default WeatherLocationModal;
