/**
 * Text highlight colours.
 *
 * Widgets that render bare text on the wallpaper (Time, Date, Greeting,
 * Info) can paint a highlighter bar behind that text. One setting
 * carries the whole feature: `highlightColor` is either a hex string
 * (on) or null (off), so there's no way to end up with "enabled but no
 * colour" or vice versa.
 *
 * The recents list is shared across widgets and lives in its own
 * localStorage key rather than in widget settings - it's a property of
 * the person, not of the widget.
 */

const RECENTS_KEY = "ghiblify_recent_colors";
const MAX_RECENTS = 5;

/** Fired after the recents list changes so open pickers re-render. */
export const RECENT_COLORS_EVENT = "ghiblify:recent-colors:change";

/** One swatch per colour a person would actually name - curated as a
 *  soft watercolor set that harmonizes with the Ghibli wallpapers
 *  (the old list mixed harsh saturated web-blue/red/orange with
 *  pastels and read as clashing). Anything between these lives behind
 *  the colour wheel. */
export const HIGHLIGHT_PRESETS = [
  "#ffffff", // paper white
  "#f7d774", // butter yellow (the classic highlighter)
  "#f2a7c3", // blossom pink
  "#9bc495", // sage green
  "#8ec5e8", // sky blue
  "#1a1a1a", // ink black (soft, not pure #000 - plays nicer with alpha)
] as const;

/** How the text on top of a highlight is coloured. "auto" derives it
 *  from the highlight's luminance; the other two are the user overruling
 *  that call (mid-tone colours are a genuine toss-up). */
export type HighlightTextColor = "auto" | "light" | "dark";

export const HIGHLIGHT_TEXT_LIGHT = "#ffffff";
export const HIGHLIGHT_TEXT_DARK = "#1f2620";

export const isHighlightTextColor = (v: unknown): v is HighlightTextColor =>
  v === "auto" || v === "light" || v === "dark";

/** Resolve the ink for a highlight, honouring an explicit override. */
export const resolveForeground = (
  hex: string,
  mode: HighlightTextColor
): string => {
  if (mode === "light") return HIGHLIGHT_TEXT_LIGHT;
  if (mode === "dark") return HIGHLIGHT_TEXT_DARK;
  return foregroundFor(hex);
};

/** Highlight alpha, as a percentage. Separate from the colour so a
 *  swatch pick doesn't reset how solid the bar is. */
export const HIGHLIGHT_OPACITY_PRESETS = [25, 50, 75, 100];

/** Blend a hex colour with an alpha percentage into an rgba() string. */
export const withAlpha = (hex: string, opacityPercent: number): string => {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  const a = Math.min(100, Math.max(0, opacityPercent)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Accepts #rgb / #rrggbb, with or without the hash. Returns the
 *  normalised `#rrggbb` form, or null when it isn't a colour. */
export const normalizeHex = (input: string): string | null => {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
};

/**
 * Pick a legible foreground for a highlight.
 *
 * Relative luminance (the WCAG formula, minus the gamma expansion - * close
 * enough for a binary light/dark decision) against a 0.6
 * threshold: pale highlighters get ink text, saturated or dark ones
 * keep the white the widgets already use.
 */
export const foregroundFor = (hex: string): string => {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? HIGHLIGHT_TEXT_DARK : HIGHLIGHT_TEXT_LIGHT;
};

/** Presets retired from HIGHLIGHT_PRESETS (Aug 2026 palette recut).
 *  Residue of these in a user's stored recents keeps the removed
 *  swatch alive in the strip - scrub them at read time. A colour
 *  freshly picked from the OS palette re-enters recents normally,
 *  because the scrub-and-rewrite below only runs against what's
 *  already stored. */
const RETIRED_PRESETS = ["#f08c3c", "#000000", "#3b82f6", "#e04b4b"];

export const readRecentColors = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .map((v) => (typeof v === "string" ? normalizeHex(v) : null))
      .filter((v): v is string => !!v && !RETIRED_PRESETS.includes(v))
      .slice(0, MAX_RECENTS);
    // One-time scrub: persist the cleaned list so the retired swatches
    // don't linger in storage (and future picks aren't filtered -
    // pushRecentColor writes fresh entries that bypass this).
    if (cleaned.length !== parsed.length) {
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(cleaned));
      } catch {
        /* ignore */
      }
    }
    return cleaned;
  } catch {
    return [];
  }
};

/** Push to the front, dedupe, cap at five. */
export const pushRecentColor = (hex: string): string[] => {
  const norm = normalizeHex(hex);
  if (!norm) return readRecentColors();
  const next = [norm, ...readRecentColors().filter((c) => c !== norm)].slice(
    0,
    MAX_RECENTS
  );
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(RECENT_COLORS_EVENT));
  return next;
};
