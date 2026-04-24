# Widgets

Every widget is registered in `src/config/widgetConfig.ts` and rendered through the universal wrapper at `src/containers/Widget/Widget.tsx`.

## Anatomy of a widget

```
src/containers/Widgets/<Name>/
├── <Name>.tsx     # render + widget-specific state/effects
└── <Name>.css     # co-located styles, BEM-lite class names
```

The widget receives no drag/resize props — `Widget.tsx` handles that. It does receive whatever settings come from AppContext (font size, dimensions, dark mode, etc.) so it can render at the right scale.

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

The map type `WidgetConfigsType` is `{ [K in WidgetKey]: WidgetConfig<K> }` — adding/removing a key from `WIDGET_KEYS` is a type-level change that ripples through the context.

## Adding a new widget

1. **Add the settings type and key** in `src/config/widgetConfig.ts`:
   - Define a `FooSettings` interface (no `position`, no `visible`).
   - Add `foo: FooSettings` to `WidgetSettingsMap` and `"foo"` to `WIDGET_KEYS`.
   - Add the `foo` entry to `WIDGET_CONFIGS` with `name`, `position`, `settings`, and any of `fontSize`/`width`/`height`/`size`/`customControls` you need.
2. **Build the component** in `src/containers/Widgets/Foo/Foo.tsx`:
   ```ts
   const { widgets } = useAppContext();
   const settings = widgets.foo.settings;  // typed as FooSettings
   ```
   Read-only widgets stop here. Widgets that need to mutate their own settings call `updateWidgetSettings("foo", patch)`.
3. **Render it** in `App.tsx`, gated by `widgets.foo.visible`, wrapped in `<Widget storageKey="foo">`.
4. **Add the sidebar toggle** in `src/containers/LeftSidebar/LeftSidebar.tsx` — one `<Button>` calling `toggleWidgetVisibility("foo")`.
5. **Verify**: load the unpacked extension, toggle on, drag, edit, reload, confirm persistence in the `ghiblify_widgets` localStorage entry.

No AppContext changes required — the generic `updateWidgetSettings` and the `WidgetsState` shape pick up the new key automatically.

User content (todo items, link lists) lives in widget settings now too (e.g. `widgets.quicklinks.settings.links`). If you have something that genuinely doesn't belong (cross-tab pomodoro state, etc.), use a separate localStorage key.

## Reusing controls in EditWidget

If your widget needs a toggle/picker that already exists (font size, dark mode, time format, infoFields, avatar selector, grid mode), set the corresponding `customControls` flag and you're done — `EditWidget` renders it automatically.

If you need a brand-new control type, add it to `EditWidget.tsx` behind a new `customControls` key. Use the **custom event pattern** to signal the widget rather than threading callbacks through `Widget`:

```ts
// In EditWidget on user action:
window.dispatchEvent(new CustomEvent("myWidgetSomethingChanged", { detail: ... }));

// In your widget:
useEffect(() => {
  const handler = (e: CustomEvent) => { /* react */ };
  window.addEventListener("myWidgetSomethingChanged", handler as EventListener);
  return () => window.removeEventListener("myWidgetSomethingChanged", handler as EventListener);
}, []);
```

## Modifying an existing widget

- Drag/resize/position behavior lives in `Widget.tsx` — touch carefully; it affects every widget.
- Widget-internal state (e.g. todo items, quick link entries) is local to the widget file plus its own localStorage key. AppContext does not own it.
- Snap points are defined in `Widget.tsx` (2%, 50%, 98%). Changing them changes layout for all widgets.

## Things to keep consistent

- Position is `{ x, y }` in viewport percent — never px.
- `transform: translate(-50%, 0)` on the widget root — center on X, top-anchor on Y.
- Widget headers should be deterministic in height regardless of content state, since position is anchored at the top.
- Storage keys are lowercase and short (`time`, `todo`, `quicklinks`).
