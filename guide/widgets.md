# Widgets

Every widget is registered in `src/config/widgetConfig.ts`. `WidgetRenderer.tsx` supplies its content to either the canvas `Widget` shell or the dock `DockWidget` shell.

## Anatomy of a widget

```
src/containers/Widgets/<Name>/
├── <Name>.tsx     # render + widget-specific state/effects
└── <Name>.css     # co-located styles, BEM-lite class names
```

The widget receives no drag/resize props. Canvas-only widgets can read AppContext directly. A widget that can appear in the dock should use `hooks/useWidgetSettings.ts`, which merges dock overrides on the dock surface and writes back to the correct settings layer.

## Widget config entry

In `widgetConfig.ts`, each widget has the shape:

```ts
{
  name: "Time",
  position: { x: 50, y: 9.6 },                // default viewport-percent position
  settings: { fontSize: 200, is24Hour: false }, // default settings (widget-specific)
  fontSize: { min: 20, max: 250, step: 20 },  // omit if not adjustable
  width:    { min: 100, max: 600, step: 10 }, // optional
  height:   { ... },                          // optional
  size:     { ... },                          // single dimension, e.g. Avatar
  customControls: {
    timeFormat: true,            // 12/24h toggle
    darkMode: true,              // dark/light toggle
    infoFields: true,            // multi-select of fields to show
    avatarSelector: true,
    gridMode: true,              // grid vs list view (QuickLinks)
  },
}
```

- `position` is the default; user-set position lives in `widgets[key].position`.
- `settings` is the default; user-set settings live in `widgets[key].settings`.
- Presence of `fontSize`/`width`/`height`/`size` on the config = the widget is resizable along that axis (the resize handle picks the right one).
- Presence of a `customControls` key = the corresponding `EditWidget` control appears. Don't add a control the widget doesn't actually consume.

The map type `WidgetConfigsType` is `{ [K in WidgetKey]: WidgetConfig<K> }` - adding/removing a key from `WIDGET_KEYS` is a type-level change that ripples through the context.

## Adding a new widget

1. **Add the settings type and key** in `src/config/widgetConfig.ts`:
   - Define a `FooSettings` interface (no `position`, no `visible`).
   - Add `foo: FooSettings` to `WidgetSettingsMap` and `"foo"` to `WIDGET_KEYS`.
   - Add the `foo` entry to `WIDGET_CONFIGS` with `name`, `position`, `settings`, and any of `fontSize`/`width`/`height`/`size`/`customControls` you need.
   - Add the key to `CANVAS_WIDGET_KEYS` and, when applicable, `LEFT_SIDEBAR_WIDGET_KEYS` or `DOCK_WIDGET_KEYS`. Dockable widgets also need a `DOCK_WIDTH_POLICIES` entry.
2. **Build the component** in `src/containers/Widgets/Foo/Foo.tsx`:
   ```ts
   const { widgets } = useAppContext();
   const settings = widgets.foo.settings;  // typed as FooSettings
   ```
   Read-only widgets stop here. Widgets that need to mutate their own settings call `updateWidgetSettings("foo", patch)`.
3. **Register its content** in `WidgetRenderer.tsx`. Add its picker glyph to `WidgetIcon.tsx` when it appears in the sidebar or dock.
4. **Verify**: load the unpacked extension, toggle on, drag, edit, reload, and confirm persistence in `ghiblify_widgets` (both the local mirror and `chrome.storage.local`).

No `App.tsx` or `LeftSidebar.tsx` render branch is required. The generic `updateWidgetSettings` and `WidgetsState` shape pick up the new key automatically. Add the key to `HIDDEN_BY_DEFAULT` only when it should start off.

Small widget-owned content can live in settings (Quick Links does). Larger, independently synchronized content can use a dedicated hybrid key (Todo does). Cross-tab coordination that relies on the browser `storage` event, such as Pomodoro leader election, stays in plain localStorage.

## Reusing controls in EditWidget

If your widget needs a toggle/picker that already exists (font size, dark mode, time format, infoFields, avatar selector, grid mode), set the corresponding `customControls` flag and you're done - `EditWidget` renders it automatically.

If you need a brand-new control type, add it to `EditWidget.tsx` behind a new `customControls` key and update settings through `updateWidgetSettings`:

```ts
updateWidgetSettings("foo", { mySetting: nextValue });
```

## Modifying an existing widget

- Drag/resize/position behavior lives in `Widget.tsx` - touch carefully; it affects every widget.
- Decide content ownership deliberately: Quick Links lives in widget settings; Todo uses a dedicated hybrid key; Pomodoro uses dedicated local-only coordination state.
- Snap points are defined in `Widget.tsx` (2%, 50%, 98%). Changing them changes layout for all widgets.

## Things to keep consistent

- Position is `{ x, y }` in viewport percent - never px.
- `transform: translate(-50%, 0)` on the widget root - center on X, top-anchor on Y.
- Widget headers should be deterministic in height regardless of content state, since position is anchored at the top.
- Storage keys are lowercase and short (`time`, `todo`, `quicklinks`).
