// Shared weather-icon helpers. Lives in its own module so consumers
// (LeftSidebar's live weather chip) don't pull the entire Weather
// widget into the main bundle just to resolve a glyph name.

// SVGs are the animated "fill" variant from the upstream
// `production/fill/svg/` directory; they self-animate via embedded
// SMIL when rendered as <img>. Day/night picks the matching glyph
// for codes 0-3; cloudier codes use the same icon either way.
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

// Inside a Chrome extension we'd want chrome.runtime.getURL, but the
// build pipeline already serves /public at the extension root, so a
// root-relative path resolves identically and works in dev preview
// too. Animated SVGs sit at the top level; their static counterparts
// are mirrored in the `still/` subfolder.
export const iconUrl = (
  name: string,
  style: "animated" | "still",
): string => {
  return style === "still"
    ? `/assets/weather/still/${name}.svg`
    : `/assets/weather/${name}.svg`;
};
