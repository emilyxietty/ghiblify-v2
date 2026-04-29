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
      "New right sidebar — slide it in from the right edge to keep your favourite widgets always within reach.",
      "Drag-and-drop to reorder, half or full widths, and a glass background option so the dock matches your vibe.",
      "Cursor animations — soot sprites, sparkles, falling petals, hearts, leaves, and a few more whimsical trails.",
      "Polish on the Welcome guide, palette dropdowns, and the Frost theme.",
      "Bug fixes — sticky shift outline, the todo list cap, scrollbar overlap, and a handful of smaller papercuts.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-04-25",
    highlights: [
      "Complete revamp of Ghiblify — fresh design, smoother animations, faster everything.",
      "Language support for 7 languages: English, 日本語, Español, Français, 中文, Português, 한국어.",
      "Faster loading and a more reliable saving layer so your settings come back instantly.",
      "Better edit and drag handling — Edit Mode, Drag Mode, and Shift-drag now coexist without stepping on each other.",
      "14 new themed palettes including a glassy Frost mode, plus high-contrast accessibility.",
      "Bookmarks panel slides in from the right edge with cross-folder drag and search.",
      "New widgets and refreshed designs — weather card with mood-aware backgrounds, sticky notes, pomodoro, and more.",
    ],
  },
];
