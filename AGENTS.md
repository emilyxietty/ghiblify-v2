# AGENTS.md

Guidance for AI assistants working in this repo. Read this first; consult `guide/` for deeper dives.

## What this is

**Ghiblify** is a Chrome extension (manifest v3) that replaces the new tab page with a Studio Ghibli-themed dashboard of draggable, resizable widgets over a randomized film background, plus bookmark and widget side panels.

- Entry point: `newtab.html` → `src/index.tsx` → `src/App.tsx`
- Manifest: `public/manifest.json` (overrides `chrome_url_overrides.newtab`)
- Persistence uses `chrome.storage` with a synchronous `localStorage` mirror;
  timer/cache state that depends on the browser `storage` event stays local-only

## Tech stack

- React 19 + TypeScript (strict) + Vite 6
- `@crxjs/vite-plugin` for Chrome extension bundling
- `vite-plugin-svgr` (named exports, `titleProp: true`)
- Icons are dependency-free inline SVG components in `src/components/Icons/Icons.tsx`.
- Plain CSS, co-located per-component (no CSS modules, no Tailwind, no styled-components)
- State: a single React Context (`src/contexts/AppContext.tsx`)

## Commands

```bash
npm run dev      # vite build --watch - rebuilds dist/ on change
npm run build    # one-shot production build
npm run preview  # serve dist/
```

There are no tests, no linter, and no formatter configured. Don't add CI tooling unless asked.

**After making changes, always rebuild** (`pnpm build`) so `dist/` reflects
them - the unpacked extension loads from `dist/`, and a stale build means
the change is invisible in the browser.

To load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Directory map

```
src/
├── index.tsx, App.tsx, App.css       # entry, root, global theme vars
├── contexts/AppContext.tsx            # state hub - read this before editing widgets
├── config/
│   ├── widgetConfig.ts                # widget registry: defaults, constraints, controls
│   ├── avatarConfig.ts                # Ghibli character avatars
│   └── appConfig.ts                   # sidebar width, trigger zones, etc.
├── hooks/
│   ├── useBackground.ts               # picks a random film background
│   ├── useInfoConfig.ts               # film metadata for Info widget
│   └── useWeather.ts                  # Open-Meteo fetch + cache for Weather widget
├── storage/
│   ├── hybridStorage.ts               # chrome.storage source + local mirror
│   ├── backgroundStorage.ts           # filters + film selection persistence
│   └── legacyMigrations.ts            # one-shot read of v1 quickLinks blob
├── components/                        # stateless, reusable UI (Button, Dropdown, EditWidget, …)
└── containers/
    ├── Background/, LeftSidebar/      # full-bleed layout pieces
    ├── RightSidebar/                  # bookmarks slide-out panel
    ├── RightDock/                     # dock surface + dock widget wrapper
    ├── WidgetRenderer/                # one content renderer for canvas + dock
    ├── Widget/Widget.tsx              # universal drag/resize/edit wrapper
    └── Widgets/                       # 12 canvas widgets (+ Bookmarks and dock surfaces)
```

`components/` = dumb. `containers/` = stateful, knows about layout/context.

## Adding/modifying a widget

You usually touch three places:

1. `src/config/widgetConfig.ts` - define the settings type, add to `WidgetSettingsMap`, `WIDGET_KEYS`, `WIDGET_CONFIGS`, and the applicable placement lists (`CANVAS_WIDGET_KEYS`, `LEFT_SIDEBAR_WIDGET_KEYS`, `DOCK_WIDGET_KEYS`)
2. `src/containers/Widgets/<Name>/<Name>.tsx` - the widget itself; reads `widgets[key].settings` from `useAppContext()`
3. `src/containers/WidgetRenderer/WidgetRenderer.tsx` - map the key to its content once; the canvas and dock both reuse it

`App.tsx` and `LeftSidebar.tsx` do not need a new render branch. `AppContext.tsx` only changes if the widget should default to hidden (`HIDDEN_BY_DEFAULT`). Add a glyph to `WidgetIcon.tsx` if the widget appears in a picker.

Exceptions: `bookmarks` and `rightSidebar` live in `WIDGET_KEYS` for shared visibility plumbing but are not canvas widgets. Bookmarks renders in `RightSidebar`; `rightSidebar` controls the `RightDock`. Their positions are unused.

See `guide/widgets.md` for the full walkthrough.

## Critical conventions (don't violate without reason)

- **Positioning**: widgets use `left: Xvw; top: Yvh; transform: translate(-50%, 0)` - X is center-anchored, Y is top-anchored. Don't change this; it keeps the header stable when widget content resizes.
- **Drag trigger**: hold `d` to reveal widget outlines, then drag. A widget in edit mode can also be dragged directly. Resize handles only appear in edit mode.
- **Themes & palette**: 13 themes in `THEME_NAMES` plus a `highContrast` flag, all in `AppContext`. `<html>` gets `theme-<name>`, `palette-light`/`palette-dark`, and `high-contrast` classes. Style widget surfaces against CSS variables - don't hard-code colors. Legacy theme names are remapped via `LEGACY_THEME_RENAMES`.
- **Persistence**: one `ghiblify_widgets` blob holds only diffs from defaults. It is written through `hybridStorage` to `chrome.storage.local` plus the synchronous mirror. Visibility is diffed against each widget's real default. A one-time migration from legacy keys runs on first load.
- **Auto-sized / square widgets**: `weather` has no width/height bounds and auto-sizes to content. `notes` uses `squareLock: true`; its width and height resize together so `cardborder.svg` stays flush.
- **State flow**: visual widget settings read/write through `useAppContext()` or the surface-aware `hooks/useWidgetSettings.ts`. Custom events are reserved for imperative coordination (guide demos, dock peeks, refreshes, and same-tab duplicate instances), not ordinary settings flow.
- **Pomodoro uses leader election** across tabs via `localStorage` + `storage` events. One tab owns the interval; others mirror. Don't naively `setInterval` in the widget.
- **No barrel files** (`index.ts` re-exports). Import concrete files directly.
- **Runtime JSON** is loaded via `chrome.runtime.getURL(...)`, not imported. Keep those files in `public/` so Vite copies them into `dist/`. Resources only need `web_accessible_resources` when a non-extension page must fetch them.

## Code style

- Functional components only, `React.FC<Props>` with an explicit `Props` interface.
- Co-located CSS file per component, BEM-lite class names (`.widget`, `.widget-header`).
- TypeScript strict - fix types, don't `any` your way out.
- Default to no comments. The code already does the talking.
- No emojis in code or commits.

## Commit style

Conventional-commit prefixes are in use: `feat(scope):`, `fix(scope):`, `chore(scope):`. Keep subject lines short and lowercase after the prefix. Example from history: `feat(pomodoro): add pomodoro timer`.

## Testing changes

There's no test suite. Verification = run `pnpm build`, reload the unpacked extension, open a new tab, and click through:

1. Toggle the widget on from the left sidebar
2. Hold `d` and drag to reposition - confirm snap behavior
3. Enter edit mode, exercise every control in `EditWidget`
4. Reload the tab - confirm state restored from the hybrid storage mirror
5. Open a second tab - confirm pomodoro stays in sync if relevant

If you can't verify in a browser, say so explicitly.

## Deeper reading

- `guide/architecture.md` - AppContext, hybrid persistence, rendering surfaces, leader election
- `guide/widgets.md` - anatomy of a widget; how to add a new one
- `guide/conventions.md` - file layout, naming, styling, CSS variables
- `guide/gotchas.md` - non-obvious behaviors and traps
