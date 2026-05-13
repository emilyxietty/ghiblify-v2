# Changelog

Notable changes per release. The in-app "What's new" modal no longer
mirrors this file — it points users to the Discord for live release
notes — so this stays as a developer-facing changelog only.

When bumping the version: update `package.json` + `public/manifest.json`,
then prepend an entry here.

## 2.3.0 — 2026-05-10

- Imgur backgrounds moved to GitHub Pages
  (`https://emilyxietty.github.io/ghiblify/imgur/`). Extension `.zip`
  drops from ~16 MB back to ~3.2 MB — actually smaller than 2.1.0
  was. Offline behavior unchanged (the 6 bundled ghibli.jp fallbacks
  still ship locally).
- Black flash on new-tab fixed. `newtab.html` now has an inline
  script that paints the previous tab's wallpaper on `<body>` from
  `localStorage` BEFORE React mounts, plus a `<link rel="preload">`
  hint for faster decode. `body.background-color` softened from
  pure black to a Ghibli-dark tone (`#1f2620`) so the brief decode
  moment looks intentional. `.background-loading` is now transparent
  so the pre-paint shows through.
- Shift restored as an alternative drag-affordance key — works
  alongside `d` (either alone, or both held). Mitigations baked in
  for the original Shift gotchas (Cmd+Shift+4 keyup-swallow → next
  mousemove with no shift modifier clears state; typing capitals
  inside inputs is still safely ignored).
- Pomodoro play button no longer renders gigantic in focus mode.
  Root cause: the `PlayCircleFilledWhite` SVG path was authored
  against a 48×48 viewBox, but the Icons module renders all icons
  in `0 0 24 24` — the path drew at 2× scale and overflowed.
  Replaced with the standard 24×24 PlayCircle path.
- Todo widget: bigger, bolder checkmark — replaced the thin
  Material check (which had built-in viewBox padding making it
  read as ~10 px in an 18 px box) with an inline stroke-based
  polyline check. Also fixed a stuck-empty bug: emptying a todo's
  text and clicking away now auto-deletes the item instead of
  leaving an unclickable blank row.
- Discord invite URL updated across Report / Socials / Changelog
  modals (`8re4UaZ2fX`).
- Info widget joins Time / Date / Greeting in supporting text-shadow
  strength control. Slider + cascade preset submenu surface
  automatically since the EditWidget + context-menu logic auto-
  attach to any widget with `textShadow` in settings.
- Widget overflow auto-nudge added. Widgets that would clip past
  the viewport on a small screen auto-shift inward, returning to
  their original spot when the window grows. Stored position is
  untouched — only the rendered transform offset adjusts.
- Welcome-guide widget toggles readable on every theme. Inactive
  state was washing out on light-card themes (Spring, Peony, Light,
  Mint, Butter, Sky) because the color was a 65%-toward-transparent
  mix of `--light` — fine on dark themes, illegible on light ones.
  Now uses `--light` at full opacity.
- Font picker (Default / Fredoka / Space Mono) added in the left
  sidebar, with each option rendered IN its font as a live preview
  and an Aa chip in the collapsed section that tooltips the active
  font on hover.
- Sticky top + bottom button bands in the left sidebar — Guide /
  Socials / Coffee at top, Report / Rate / Language / version at
  bottom. Both flush against the sidebar edges with a soft inner-
  edge gradient fade so scrolling sections tuck under cleanly.
- Real TikTok brand mark in the Socials modal (was a music note);
  My Socials button now uses a person-add icon (was a heart).
- Weather widget loads with a layout-shaped skeleton (shimmery
  bars + circular icon placeholders with the spinner inside)
  instead of a single centered spinner.
- Text-shadow control cascade menu on right-click — submenu with
  preset 0/50/100/150/200% values for quick adjustment without
  opening the EditWidget overlay.
- Inline SVG icon factory bug fixed — `width`/`height` moved from
  inline style to SVG attributes so external CSS rules can size
  icons cleanly (consumer CSS like `.socials-icon svg { width: 24px }`
  was being beaten by the inline `1em` style).

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
