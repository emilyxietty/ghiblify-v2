/**
 * Release notes shown by the version button at the bottom of the
 * left sidebar. Hand-curated — each release is a short list of
 * highlights, not an exhaustive commit log. Keep entries terse so
 * the modal stays scannable.
 *
 * Bump version: update both `package.json` and `public/manifest.json`,
 * then prepend an entry here. CHANGELOG.md at the repo root mirrors
 * this content for users browsing the source.
 */

export interface ChangelogEntry {
  /** Semver version. Surfaced as the entry heading + matched against
   *  manifest.version to read "what's new since I last opened?". */
  version: string;
  /** YYYY-MM-DD release date, used for sub-text on the heading. */
  date: string;
  /** Short bullet list of highlights. Markdown not parsed — these
   *  render as plain text so we don't pull in a markdown lib. */
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.1.0",
    date: "2026-04-29",
    highlights: [
      "Right sidebar dock — slide-in right rail that hosts widgets, mutually exclusive with the bookmarks panel.",
      "Per-widget half/full width, drag-to-reorder, optional glass-card background — managed from the dock's footer settings.",
      "Per-surface settings: weather / info / avatar can have separate config in the dock vs the canvas.",
      "Welcome guide always corners bottom-right with passthrough so the spotlight UI stays clickable.",
      "Frost palette Todo hover no longer washes white; Todo widget on canvas now grows with its container instead of capping at 5 rows.",
      "Shift-outline no longer gets stuck on after a click steals keyup.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-04-25",
    highlights: [
      "Fresh React 19 + TypeScript rewrite of the v1 (jQuery) extension.",
      "Hybrid storage layer — chrome.storage as source-of-truth + localStorage mirror for sync first paint.",
      "14 themed palettes including Frost, weather card with mood-aware backgrounds per WMO code, cursor whimsy presets.",
      "i18n in 7 languages (en, ja, es, fr, zh, pt, ko) including welcome guide and tooltips.",
      "Z-index tokens, offline support with random fallback images, full background gallery picker.",
    ],
  },
];
