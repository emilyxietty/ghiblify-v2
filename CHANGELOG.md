# Changelog

Notable changes per release. The in-app "What's new" modal no longer
mirrors this file — it points users to the Discord for live release
notes — so this stays as a developer-facing changelog only.

When bumping the version: update `package.json` + `public/manifest.json`,
then prepend an entry here.

## 2.2.0 — 2026-05-03

- Background images now reliably load worldwide. The kiki gallery and a
  handful of other wallpapers used to break in the UK and a few other
  regions because their imgur host is unreachable there; all 45 are now
  bundled with the extension as compressed WebPs and load from local
  disk. Adds ~13 MB to the extension package.
- Real Discord brand mark in the Socials and Report modals (replaces
  the generic chat-bubble icon).
- "Report a bug" Discord card subtitle updated across all 7 locales to
  match its purpose.
- Chrome Web Store listing now localizes for the user's Chrome UI
  language (description + toolbar tooltip), via the manifest's
  `default_locale` + `_locales/<lang>/messages.json`. Hybrid setup —
  the in-app Language switcher still works exactly as before.
- "What's new" modal points users to Discord for live release notes
  instead of carrying release notes in code (no more code-bundled
  changelog → no more rebuild-per-tweak loop). The version chip in the
  sidebar now reads straight from the manifest at runtime so it can
  never drift from what actually shipped. Removed `src/changelog.ts`.

## 2.1.0 — 2026-04-29

- New right sidebar — slide it in from the right edge to keep your
  favourite widgets always within reach.
- Drag-and-drop to reorder, half or full widths, and a glass background
  option so the dock matches your vibe.
- Cursor animations — soot sprites, sparkles, falling petals, hearts,
  leaves, and a few more whimsical trails.
- Polish on the Welcome guide, palette dropdowns, and the Frost theme.
- Bug fixes — sticky shift outline, the todo list cap, scrollbar
  overlap, and a handful of smaller papercuts.

## 2.0.0 — 2026-04-25

- Complete revamp of Ghiblify — fresh design, smoother animations,
  faster everything.
- Language support for 7 languages: English, 日本語, Español, Français,
  中文, Português, 한국어.
- Faster loading and a more reliable saving layer so your settings
  come back instantly.
- Better edit and drag handling — Edit Mode, Drag Mode, and Shift-drag
  now coexist without stepping on each other.
- 14 new themed palettes including a glassy Frost mode, plus
  high-contrast accessibility.
- Bookmarks panel slides in from the right edge with cross-folder drag
  and search.
- New widgets and refreshed designs — weather card with mood-aware
  backgrounds, sticky notes, pomodoro, and more.
