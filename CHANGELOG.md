# Changelog

Notable changes per release. Mirrors `src/changelog.ts`, which is what
the in-app version button at the bottom of the left sidebar reads.

When bumping the version: update `package.json` + `public/manifest.json`,
then prepend an entry here AND in `src/changelog.ts`.

## 2.1.0 — 2026-04-29

- Right sidebar dock — slide-in right rail that hosts widgets, mutually
  exclusive with the bookmarks panel.
- Per-widget half/full width, drag-to-reorder, optional glass-card
  background — managed from the dock's footer settings.
- Per-surface settings: weather / info / avatar can have separate
  config in the dock vs the canvas.
- Welcome guide always corners bottom-right with passthrough so the
  spotlight UI stays clickable.
- Frost palette Todo hover no longer washes white; Todo widget on
  canvas now grows with its container instead of capping at 5 rows.
- Shift-outline no longer gets stuck on after a click steals keyup.

## 2.0.0 — 2026-04-25

- Fresh React 19 + TypeScript rewrite of the v1 (jQuery) extension.
- Hybrid storage layer — chrome.storage as source-of-truth +
  localStorage mirror for sync first paint.
- 14 themed palettes including Frost, weather card with mood-aware
  backgrounds per WMO code, cursor whimsy presets.
- i18n in 7 languages (en, ja, es, fr, zh, pt, ko) including welcome
  guide and tooltips.
- Z-index tokens, offline support with random fallback images, full
  background gallery picker.
