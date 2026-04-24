# AGENTS.md

Guidance for AI assistants working in this repo. Read this first; consult `guide/` for deeper dives.

## What this is

**Ghiblify** is a Chrome extension (manifest v3) that replaces the new tab page with a Studio Ghibli-themed dashboard of draggable, resizable widgets (clock, todos, quick links, pomodoro, avatar, search, etc.) over a randomized Ghibli film background.

- Entry point: `newtab.html` → `src/index.tsx` → `src/App.tsx`
- Manifest: `public/manifest.json` (overrides `chrome_url_overrides.newtab`)
- All persistence is `localStorage` (no backend, no `chrome.storage`)

## Tech stack

- React 19 + TypeScript (strict) + Vite 6
- `@crxjs/vite-plugin` for Chrome extension bundling
- `vite-plugin-svgr` (named exports, `titleProp: true`)
- MUI is used **for icons only** (`@mui/icons-material`); no MUI layout components
- Plain CSS, co-located per-component (no CSS modules, no Tailwind, no styled-components)
- State: a single React Context (`src/contexts/AppContext.tsx`)

## Commands

```bash
npm run dev      # vite build --watch — rebuilds dist/ on change
npm run build    # one-shot production build
npm run preview  # serve dist/
```

There are no tests, no linter, and no formatter configured. Don't add CI tooling unless asked.

To load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Directory map

```
src/
├── index.tsx, App.tsx, App.css       # entry, root, global theme vars
├── contexts/AppContext.tsx            # THE state hub — read this before editing widgets
├── config/
│   ├── widgetConfig.ts                # widget registry: defaults, constraints, controls
│   ├── avatarConfig.ts                # Ghibli character avatars
│   └── appConfig.ts                   # sidebar width, trigger zones, etc.
├── hooks/
│   ├── useBackground.ts               # picks a random film background
│   └── useInfoConfig.ts               # film metadata for Info widget
├── components/                        # stateless, reusable UI (Button, Dropdown, EditWidget, …)
└── containers/
    ├── Background/, LeftSidebar/      # full-bleed layout pieces
    ├── Widget/Widget.tsx              # universal drag/resize/edit wrapper
    └── Widgets/                       # 8 widgets: Time, Date, Info, Todo,
                                       #   QuickLinks, Avatar, SearchBar, Pomodoro
```

`components/` = dumb. `containers/` = stateful, knows about layout/context.

## Adding/modifying a widget

You usually only touch three files:

1. `src/config/widgetConfig.ts` — define the settings type, add to `WIDGET_KEYS` and `WIDGET_CONFIGS` (defaults, position, sliders, custom controls)
2. `src/containers/Widgets/<Name>/<Name>.tsx` — the widget itself; reads `widgets[key].settings` from `useAppContext()`
3. `src/containers/LeftSidebar/LeftSidebar.tsx` — visibility toggle

`AppContext.tsx` does not need to change — the `WidgetsState` and `updateWidgetSettings<K>` generics pick up the new key. `App.tsx` needs the conditional render added (`widgets.<key>.visible && <Widget storageKey="<key>"><Foo /></Widget>`).

See `guide/widgets.md` for the full walkthrough.

## Critical conventions (don't violate without reason)

- **Positioning**: widgets use `left: Xvw; top: Yvh; transform: translate(-50%, 0)` — X is center-anchored, Y is top-anchored. Don't change this; it keeps the header stable when widget content resizes.
- **Edit-mode trigger**: hold Shift to see widget outlines; Shift+click+drag to move. Resize handles only appear in edit mode.
- **Persistence**: one localStorage key, `ghiblify_widgets`, holding only diffs from defaults. A one-time migration from the legacy per-key layout runs on first load (see `guide/architecture.md`).
- **State flow**: `EditWidget` and widgets read/write through `useAppContext()`. There's no `window.dispatchEvent` event bus — the context drives re-renders.
- **Pomodoro uses leader election** across tabs via `localStorage` + `storage` events. One tab owns the interval; others mirror. Don't naively `setInterval` in the widget.
- **No barrel files** (`index.ts` re-exports). Import the concrete file: `import Button from "../../components/Button/Button.tsx"`.
- **Background JSON** is loaded via `chrome.runtime.getURL(...)`, not `import`. Files must be listed in `manifest.json` `web_accessible_resources`.

## Code style

- Functional components only, `React.FC<Props>` with an explicit `Props` interface.
- Co-located CSS file per component, BEM-lite class names (`.widget`, `.widget-header`).
- TypeScript strict — fix types, don't `any` your way out.
- Default to no comments. The code already does the talking.
- No emojis in code or commits.

## Commit style

Conventional-commit prefixes are in use: `feat(scope):`, `fix(scope):`, `chore(scope):`. Keep subject lines short and lowercase after the prefix. Example from history: `feat(pomodoro): add pomodoro timer`.

## Testing changes

There's no test suite. Verification = run `npm run dev`, reload the unpacked extension, open a new tab, and click through:

1. Toggle the widget on from the left sidebar
2. Shift+drag to reposition — confirm snap behavior
3. Enter edit mode, exercise every control in `EditWidget`
4. Reload the tab — confirm state restored from localStorage
5. Open a second tab — confirm pomodoro stays in sync if relevant

If you can't verify in a browser, say so explicitly.

## Deeper reading

- `guide/architecture.md` — AppContext, dual persistence, leader election, custom events
- `guide/widgets.md` — anatomy of a widget; how to add a new one
- `guide/conventions.md` — file layout, naming, styling, CSS variables
- `guide/gotchas.md` — non-obvious behaviors and traps
