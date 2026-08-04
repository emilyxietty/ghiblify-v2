/**
 * City lookup for the Weather widget's manual location.
 *
 * Open-Meteo's geocoding API is the natural pairing with the forecast
 * API already in use: same provider, no key, and it returns the exact
 * lat/lon the forecast endpoint wants — no second reverse-geocode hop
 * to name the place, because the search result *is* the name.
 */

/** A place the user picked by name. Stored in the Weather widget's
 *  settings; when set, the widget skips geolocation entirely. */
export interface ManualPlace {
  /** Display label, already disambiguated ("Vancouver, BC, Canada"). */
  name: string;
  lat: number;
  lon: number;
}

export interface GeoResult extends ManualPlace {
  /** Stable id for React keys — Open-Meteo's own record id. */
  id: number;
}

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** Build the disambiguated label. Two Springfields in the list are
 *  useless without the state and country next to them. */
const labelFor = (r: {
  name: string;
  admin1?: string;
  country?: string;
}): string => [r.name, r.admin1, r.country].filter(Boolean).join(", ");

/**
 * Search cities by name.
 *
 * @param query  Free text — at least 2 characters, else no request.
 * @param signal Abort signal so a fast typist doesn't race stale results.
 */
export const searchPlaces = async (
  query: string,
  signal?: AbortSignal
): Promise<GeoResult[]> => {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", q);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const json = await res.json();
  const results: unknown[] = json?.results ?? [];
  return results.map((raw) => {
    const r = raw as {
      id: number;
      name: string;
      latitude: number;
      longitude: number;
      admin1?: string;
      country?: string;
    };
    return {
      id: r.id,
      name: labelFor(r),
      lat: r.latitude,
      lon: r.longitude,
    };
  });
};

export const isManualPlace = (v: unknown): v is ManualPlace =>
  !!v &&
  typeof v === "object" &&
  typeof (v as ManualPlace).name === "string" &&
  typeof (v as ManualPlace).lat === "number" &&
  typeof (v as ManualPlace).lon === "number";
