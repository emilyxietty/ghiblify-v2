# Architecture

## State: a single Context, single source of truth

`src/contexts/AppContext.tsx` is the only state container. The widget state shape is uniform — every widget has `{ visible, position, settings }`:

```ts
type WidgetsState = {
  [K in WidgetKey]: {
    visible: boolean;
    position: { x: number; y: number }; // viewport-percent
    settings: WidgetSettingsMap[K]; // widget-specific
  };
};
```

Plus background filters/selection and the transient `isDragging` flag the `Background` reads to render the snap grid. No Redux, no Zustand.

Settings types (in `src/config/widgetConfig.ts`) deliberately do **not** include `position` or `visible` — those belong to the widget shell, not the widget content.

## API

```ts
const {
  widgets, // WidgetsState — read directly
  toggleWidgetVisibility, // (key) => void
  updateWidgetPosition, // (key, pos) => void
  updateWidgetSettings, // <K>(key: K, patch: Partial<settings[K]>) => void
  resetAllWidgets,
} = useAppContext();
```

`updateWidgetSettings` is generic — TypeScript narrows the patch type by the key you pass.

## Persistence: one key, diff-from-defaults

A single localStorage key `ghiblify_widgets` holds the state, encoded as a minimal blob: only fields that differ from `WIDGET_CONFIGS[key].settings` / `.position` are written. If everything is at defaults, the key is removed entirely.

A `useEffect` watches `widgets` and re-persists on every change. There is no per-setting `localStorage.setItem` scattered around the updaters.

## Migration

On context init, if `ghiblify_widgets` doesn't exist, the legacy layout is read once (`widgets_state` blob plus per-key entries: `time_x`, `time_y`, `time_switch`, `time_fontSize`, `info_selectedFields`, `quick_links`, …), built into the new shape, written as `ghiblify_widgets`, and the legacy keys are deleted. Migration runs once per browser profile; subsequent loads only touch the new key.

Anything outside the widgets state — `background_filters`, `background_selection`, `quick_links` user content (no, this is migrated into `widgets.quicklinks.settings.links`), `pomodoro_*` cross-tab keys — keeps its own storage.

## Widget rendering pipeline

```
App.tsx
  └── AppProvider (context)
        ├── Background          (reads filters + isDragging)
        ├── LeftSidebar         (toggles + filter sliders)
        └── for each visible widget:
              Widget (containers/Widget/Widget.tsx)
                ├── handles drag, resize, edit-mode overlay
                └── renders the inner widget (Time, Todo, …)
```

`Widget.tsx` is the universal wrapper. Individual widgets in `containers/Widgets/` should stay focused on their own logic — drag/resize/persistence is already handled.

## Drag and resize

In `containers/Widget/Widget.tsx`:

- **Drag**: requires `Shift + left-click` on a non-interactive element (inputs, buttons, etc. are excluded). Position updates on `mousemove`; on `mouseup` it snaps to the nearest grid line (2%, 50%, 98% of viewport). Final position is committed to AppContext, which persists it.
- **Resize**: handle is only visible in edit mode. Behavior depends on what the widget supports — `fontSize` (Time/Date/Info), `width`/`height` (Todo/QuickLinks/SearchBar), or a single `size` (Avatar). The relevant slider/handle dispatches updates to AppContext immediately so the widget reacts in real time.
- **Snap grid overlay**: `Background.tsx` shows the grid only when `isDragging === true`.

Holding Shift outside a drag still toggles a `body.shift-pressed` class so widget outlines appear. See lines ~77-94 of `Widget.tsx`.

## Edit mode

`App.tsx` owns the `editingWidget` state. Three exits:

1. Click outside the widget
2. Press Escape
3. Press Enter

The exit logic is centralized in `useEffect`s in `App.tsx` (lines ~39-62), not in individual widgets.

`EditWidget` (in `components/EditWidget/`) is rendered as an overlay by the `Widget` wrapper. It reads the widget's config entry and conditionally renders controls (font slider, dark mode switch, time-format toggle, avatar picker, field selector, grid-mode toggle). Widget-specific behavior is keyed off `customControls` in `widgetConfig.ts`.

## Cross-widget signaling

There isn't any. Widgets read settings from context (`widgets[key].settings`); when `EditWidget` calls `updateWidgetSettings(key, patch)`, the context updates and every consumer re-renders. The old `window.dispatchEvent` / `addEventListener` choreography (`timeSettingsChange`, `quicklinksGridChange`, `avatarSettingsChange`) is gone — it was a workaround for the parallel-state problem that no longer exists.

## Pomodoro: leader election

`containers/Widgets/Pomodoro/Pomodoro.tsx` runs across all open tabs. Naively, every tab would tick its own `setInterval` and they'd drift. Instead:

1. On mount, a tab tries to claim the `pomodoro_leader` key in `localStorage` (with its own random ID)
2. The leader runs the `setInterval`, decrements `pomodoro_seconds_left`, and writes state
3. Non-leaders listen for `storage` events and re-render on change
4. On `beforeunload`, the leader clears its claim
5. When a leader disappears, the next tab notices (via heartbeat / storage) and claims leadership

Implication: if you add timer-like multi-tab features, follow this pattern. Don't `setInterval` blindly.

## Background loading

`hooks/useBackground.ts`:

1. `chrome.runtime.getURL("background.json")` → fetched and parsed
2. Filter to films the user has enabled (`background_selection` in context)
3. Filter out URLs in `ghiblify_blacklist` (localStorage)
4. Pick a random link that isn't the current one
5. Return `{ currentBackground, filmTitle, loading }`

`useInfoConfig.ts` separately fetches `movie_metadata.json` and exposes title/year/quote/etc. for the Info widget.

Both files must be in `manifest.json` `web_accessible_resources` or the fetch will 404.

## File structure invariants

- `components/` = stateless, no context use, take props in and emit events out
- `containers/` = stateful, may use context, may know about layout
- `hooks/` = side effects and data fetching
- `config/` = static metadata only — no React, no JSX
- One folder per component, with co-located `.css`
- No `index.ts` barrel files — explicit imports only
