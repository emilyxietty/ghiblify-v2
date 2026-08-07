# Architecture

## State: a single Context, single source of truth

`src/contexts/AppContext.tsx` is the primary state container. The widget state shape is uniform across the canvas and dock:

```ts
type WidgetsState = {
  [K in WidgetKey]: {
    visible: boolean;
    position: { x: number; y: number }; // viewport-percent
    settings: WidgetSettingsMap[K]; // widget-specific
    inRightSidebar: boolean;
    dockWidth: "half" | "full";
    dockOrder: number;
    dockSettings: Partial<WidgetSettingsMap[K]>;
  };
};
```

Plus appearance, background state, guide/edit state, and transient drag state. `DockSurfaceContext` is only a render-surface marker; it is not a second store. No Redux, no Zustand.

Settings types (in `src/config/widgetConfig.ts`) deliberately do **not** include `position` or `visible` - those belong to the widget shell, not the widget content.

## API

```ts
const {
  widgets, // WidgetsState - read directly
  toggleWidgetVisibility, // (key) => void
  updateWidgetPosition, // (key, pos) => void
  updateWidgetSettings, // <K>(key: K, patch: Partial<settings[K]>) => void
  resetAllWidgets,
} = useAppContext();
```

`updateWidgetSettings` is generic - TypeScript narrows the patch type by the key you pass.

## Persistence: hybrid storage, diff-from-defaults

A single `ghiblify_widgets` key holds the state as a minimal blob: only fields that differ from defaults are written. `storage/hybridStorage.ts` writes registered keys to `chrome.storage` and a synchronous `localStorage` mirror, which keeps first paint free of an async defaults flash.

Widget persistence is debounced in `AppContext`; settings updaters do not write storage individually. Pomodoro election and location-tied caches remain local-only because they need synchronous cross-tab events or are machine-specific.

## Migration

On initialization, the legacy layout is read once (`widgets_state` plus per-key entries), built into the current shape, written as `ghiblify_widgets`, and the legacy keys are deleted. The one-time setup also seeds `chrome.storage` from pre-hybrid local values. `index.tsx` restores a missing mirror from `chrome.storage` before the app can overwrite it with defaults.

Not all user content belongs in the widget blob. Todo items use `ghiblify_todo`, while Pomodoro and weather cache/election data keep dedicated keys.

## Widget rendering pipeline

```
App.tsx
  └── AppProvider (context)
        ├── LeftSidebar
        ├── RightSidebar (bookmarks)
        ├── RightDock
        │     └── DockWidget → WidgetRenderer
        └── Background (canvas)
              └── Widget → WidgetRenderer
```

`WidgetRenderer` maps a widget key to content once, so canvas and dock cannot drift into separate component lists. Placement arrays and dock width policy live in `widgetConfig.ts`. `Widget.tsx` owns canvas drag/resize/edit behavior; `DockWidget.tsx` owns the dock surface and opens the shared `EditWidget` panel with dock-scoped settings. That panel exposes Up/Down controls, while `AppContext` persists the resulting dock order.

## Drag and resize

In `containers/Widget/Widget.tsx`:

- **Drag**: hold `d` and drag, or drag a widget that is already in edit mode. Interactive controls are excluded outside edit mode. Position updates on `mousemove`; on `mouseup` it snaps to the nearest grid line (2%, 50%, 98% of viewport) and commits to AppContext.
- **Resize**: the handle is only visible in edit mode. Behavior depends on config bounds: `fontSize`, `width`/`height`, a single `size`, or square-locked width/height for Notes. Updates flow through AppContext immediately.
- **Snap grid overlay**: `Background.tsx` shows the grid only when `isDragging === true`.

Holding `d` toggles `body.show-widget-outline`, which reveals outlines and quick edit/hide controls.

## Edit mode

`AppContext` owns the canvas `editingWidgetKey`; each `DockWidget` owns its local editor-open state so opening a dock editor cannot also open the canvas copy. Both surfaces use the same `EditWidget` component and support three exits:

1. Click outside the widget
2. Press Escape
3. Press Enter

Canvas exit handling lives in `App.tsx`; the shared editor handles the same exits when a dock `onClose` callback is supplied.

`EditWidget` (in `components/RightClickEditModal/EditWidget/`, alongside the pickers that exist for it) is rendered as an overlay by either wrapper. It reads the widget's config entry and conditionally renders controls (font slider, dark mode switch, time-format toggle, avatar picker, field selector, grid-mode toggle). Widget-specific behavior is keyed off `customControls` in `widgetConfig.ts`; dock edits and previews write to `dockSettings`, while canvas edits write to `settings`.

## Cross-widget signaling

Ordinary settings never use an event bus: widgets read context and `EditWidget` writes context. Targeted custom events remain for genuinely imperative coordination such as guide demos, a dock peek, a weather refresh, or synchronizing two Todo instances mounted in the same tab. Keep those events namespaced as `ghiblify:*` and do not use them as parallel settings state.

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

Both files live in `public/` so Vite copies them into `dist/`. Because they are fetched by an extension page, they do not need `web_accessible_resources` unless a normal web page also needs access.

## File structure invariants

- `components/` = stateless, no context use, take props in and emit events out
- `containers/` = stateful, may use context, may know about layout
- `hooks/` = side effects and data fetching
- `config/` = static metadata only - no React, no JSX
- One folder per component, with co-located `.css`
- No `index.ts` barrel files - explicit imports only
