import { useEffect, useState } from "react";

/**
 * Weather hook backed by Open-Meteo (free, no API key, generous limits).
 *
 * Coordinates come from `navigator.geolocation`. The new tab page is a
 * regular HTML context — chrome.geolocation / offscreen documents are
 * only needed when calling from a service worker.
 *
 * Both the coords and the API response are cached in localStorage:
 *   - Coords for 24h, so we don't re-prompt on every tab open. (The
 *     Chrome permission itself only needs to be granted once.)
 *   - API response for 10 min, so opening 20 tabs in quick succession
 *     doesn't generate 20 API calls.
 *
 * The hook re-fetches when `unit` flips between °C/°F so display is
 * authoritative (no client-side conversion drift).
 */

// Single combined weather cache. One JSON blob holds:
//   place — coords (24h TTL) + reverse-geocoded label (7d TTL)
//   api   — Open-Meteo response (10min TTL)
// Each part keeps its own timestamp inside the blob so the TTLs
// stay independent.
const WEATHER_CACHE_KEY = "ghiblify_weather";
const COORDS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const LOCATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const API_TTL_MS = 10 * 60 * 1000; // 10 min

export interface WeatherCurrent {
  temperature: number;
  apparent: number;
  weatherCode: number;
  isDay: boolean;
}

export interface WeatherHourly {
  time: string; // ISO
  temperature: number;
  weatherCode: number;
}

export interface WeatherDaily {
  time: string; // ISO date YYYY-MM-DD
  high: number;
  low: number;
  weatherCode: number;
}

export type WeatherErrorCode =
  | "permission-denied"
  | "permission-unavailable"
  | "fetch-error";

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  fetchedAt: number;
  unit: "C" | "F";
  locationLabel: string;
}

// Combined coords + reverse-geocoded label cache.
// `coordsAt` and `labelAt` are tracked separately so each can expire
// on its own TTL — the label outlives the coords by a long way.
interface CachedPlace {
  lat: number;
  lon: number;
  coordsAt: number;
  label?: string;
  labelAt?: number;
}

interface CachedApi extends WeatherData {
  lat: number;
  lon: number;
}

interface WeatherBlob {
  place?: CachedPlace;
  api?: CachedApi;
}

const readJSON = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const readBlob = (): WeatherBlob =>
  readJSON<WeatherBlob>(WEATHER_CACHE_KEY) ?? {};

const writeBlob = (next: WeatherBlob) => writeJSON(WEATHER_CACHE_KEY, next);

const readPlace = (): CachedPlace | undefined => readBlob().place;
const writePlace = (place: CachedPlace) => writeBlob({ ...readBlob(), place });

const readApi = (): CachedApi | undefined => readBlob().api;
const writeApi = (api: CachedApi) => writeBlob({ ...readBlob(), api });

// One-time migration: fold prior split-key layouts into the combined
// `ghiblify_weather` blob. Two generations of legacy keys exist:
//   v1: ghiblify_weather_coords + ghiblify_weather_location
//   v2: ghiblify_weather_place  + ghiblify_weather_api
// Cheap, idempotent, no-op once cleaned.
const migrateLegacyCaches = () => {
  try {
    const existing = readBlob();
    let nextPlace: CachedPlace | undefined = existing.place;
    let nextApi: CachedApi | undefined = existing.api;

    if (!nextPlace) {
      const v2Place = readJSON<CachedPlace>("ghiblify_weather_place");
      if (v2Place) {
        nextPlace = v2Place;
      } else {
        const oldCoords = readJSON<{
          lat: number;
          lon: number;
          fetchedAt: number;
        }>("ghiblify_weather_coords");
        const oldLoc = readJSON<{
          lat: number;
          lon: number;
          label: string;
          fetchedAt: number;
        }>("ghiblify_weather_location");
        const lat = oldCoords?.lat ?? oldLoc?.lat;
        const lon = oldCoords?.lon ?? oldLoc?.lon;
        if (lat != null && lon != null) {
          nextPlace = {
            lat,
            lon,
            coordsAt: oldCoords?.fetchedAt ?? Date.now(),
            label: oldLoc?.label,
            labelAt: oldLoc?.fetchedAt,
          };
        }
      }
    }

    if (!nextApi) {
      const v2Api = readJSON<CachedApi>("ghiblify_weather_api");
      if (v2Api) nextApi = v2Api;
    }

    if (nextPlace !== existing.place || nextApi !== existing.api) {
      writeBlob({ place: nextPlace, api: nextApi });
    }
    localStorage.removeItem("ghiblify_weather_coords");
    localStorage.removeItem("ghiblify_weather_location");
    localStorage.removeItem("ghiblify_weather_place");
    localStorage.removeItem("ghiblify_weather_api");
  } catch {
    /* ignore */
  }
};
migrateLegacyCaches();

const getCoords = (): Promise<{ lat: number; lon: number }> =>
  new Promise((resolve, reject) => {
    const cached = readPlace();
    if (cached && Date.now() - cached.coordsAt < COORDS_TTL_MS) {
      resolve({ lat: cached.lat, lon: cached.lon });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: "permission-unavailable" as WeatherErrorCode });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // Preserve the existing label if the new coords are still close
        // to the cached ones — saves a reverse-geocode call.
        const existing = readPlace();
        const labelStillValid =
          existing &&
          existing.label &&
          existing.labelAt &&
          Math.abs(existing.lat - lat) < 0.05 &&
          Math.abs(existing.lon - lon) < 0.05 &&
          Date.now() - existing.labelAt < LOCATION_TTL_MS;
        const next: CachedPlace = {
          lat,
          lon,
          coordsAt: Date.now(),
          label: labelStillValid ? existing.label : undefined,
          labelAt: labelStillValid ? existing.labelAt : undefined,
        };
        writePlace(next);
        resolve({ lat, lon });
      },
      (err) => {
        reject({
          code:
            err.code === err.PERMISSION_DENIED
              ? ("permission-denied" as WeatherErrorCode)
              : ("permission-unavailable" as WeatherErrorCode),
        });
      },
      { maximumAge: COORDS_TTL_MS, timeout: 10_000 }
    );
  });

// Reverse geocode coords → human-readable city/region label.
// Uses BigDataCloud's free, no-key reverse-geocode-client endpoint.
// Falls back to coord string if the API call fails. The label lives
// inside the `place` slot of the combined weather blob.
const fetchLocationLabel = async (
  lat: number,
  lon: number
): Promise<string> => {
  const cached = readPlace();
  if (
    cached &&
    cached.label &&
    cached.labelAt &&
    Math.abs(cached.lat - lat) < 0.05 &&
    Math.abs(cached.lon - lon) < 0.05 &&
    Date.now() - cached.labelAt < LOCATION_TTL_MS
  ) {
    return cached.label;
  }
  try {
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client"
    );
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lon.toFixed(4));
    url.searchParams.set("localityLanguage", "en");
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const label =
      json.city ||
      json.locality ||
      json.principalSubdivision ||
      json.countryName ||
      `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    // Merge into the existing place entry rather than overwriting —
    // keeps the most recent coords + their `coordsAt` intact.
    writePlace({
      lat,
      lon,
      coordsAt: cached?.coordsAt ?? Date.now(),
      label,
      labelAt: Date.now(),
    });
    return label;
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
};

const fetchOpenMeteo = async (
  lat: number,
  lon: number,
  unit: "C" | "F"
): Promise<WeatherData> => {
  const tempUnit = unit === "F" ? "fahrenheit" : "celsius";
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day"
  );
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code"
  );
  url.searchParams.set("temperature_unit", tempUnit);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json = await res.json();

  const current: WeatherCurrent = {
    temperature: Math.round(json.current.temperature_2m),
    apparent: Math.round(json.current.apparent_temperature),
    weatherCode: json.current.weather_code,
    isDay: json.current.is_day === 1,
  };

  // Hourly: trim to the next 6 hours starting from the current hour.
  const nowIso = json.current.time as string;
  const hourlyTimes: string[] = json.hourly.time;
  const hourlyTemps: number[] = json.hourly.temperature_2m;
  const hourlyCodes: number[] = json.hourly.weather_code;
  const startIdx = Math.max(
    0,
    hourlyTimes.findIndex((t) => t >= nowIso)
  );
  const hourly: WeatherHourly[] = [];
  for (let i = startIdx; i < Math.min(hourlyTimes.length, startIdx + 6); i++) {
    hourly.push({
      time: hourlyTimes[i],
      temperature: Math.round(hourlyTemps[i]),
      weatherCode: hourlyCodes[i],
    });
  }

  const daily: WeatherDaily[] = json.daily.time.map((t: string, i: number) => ({
    time: t,
    high: Math.round(json.daily.temperature_2m_max[i]),
    low: Math.round(json.daily.temperature_2m_min[i]),
    weatherCode: json.daily.weather_code[i],
  }));

  const locationLabel = await fetchLocationLabel(lat, lon);

  return {
    current,
    hourly,
    daily,
    fetchedAt: Date.now(),
    unit,
    locationLabel,
  };
};

export const useWeather = (unit: "C" | "F") => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WeatherErrorCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const cachedApi = readApi();
    if (
      cachedApi &&
      cachedApi.unit === unit &&
      Date.now() - cachedApi.fetchedAt < API_TTL_MS
    ) {
      setData(cachedApi);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const { lat, lon } = await getCoords();
        if (cancelled) return;
        const fresh = await fetchOpenMeteo(lat, lon, unit);
        if (cancelled) return;
        writeApi({ ...fresh, lat, lon });
        setData(fresh);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code: WeatherErrorCode }).code
            : ("fetch-error" as WeatherErrorCode);
        setError(code);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unit]);

  return { data, loading, error };
};
