# Gotchas

Things that have bitten people or are easy to miss.

## Single-blob persistence with one-time migration

Widgets state lives at one localStorage key: `ghiblify_widgets`, written as a diff-from-defaults blob. The legacy dual-write pattern is gone. On first load after the refactor, `AppContext.tsx` reads the legacy keys (`widgets_state`, `time_x`, `time_switch`, `info_selectedFields`, `quick_links`, etc.), builds the new shape, writes the blob, and deletes the legacy keys. Migration runs once.

If you're adding a new persisted setting, just add it to the relevant `*Settings` interface in `widgetConfig.ts` — persistence is automatic via the `useEffect` on `widgets`.

## Position anchoring is asymmetric

Widgets are positioned with:

```css
left: <x>vw;
top: <y>vh;
transform: translate(-50%, 0);
```

X is **center-anchored**, Y is **top-anchored**. This is intentional — when a widget's content height changes (e.g. expanding a todo list), the header stays put rather than sliding up/down. If you change this for a single widget, expect the header to drift on resize.

## Drag requires Shift

Click-drag without Shift does nothing — that's by design so users can interact with widget contents (text inputs, buttons, todo checkboxes) without moving the widget. If a "drag isn't working" report comes in, first check whether Shift is held.

## Pomodoro across tabs

The pomodoro timer uses leader election via `localStorage` + the `storage` event. There is exactly one ticking interval across all open tabs. If you naïvely add a `setInterval` in the Pomodoro component, you'll re-introduce drift and double-decrement bugs.

If you add another time-sensitive widget (e.g. world clocks), follow the same leader pattern.

## EditWidget uses the context, not custom events

`EditWidget` calls `updateWidgetSettings(storageKey, patch)`. Widgets read settings from `widgets[key].settings`. React handles the re-render. The old `window.dispatchEvent("timeSettingsChange", ...)` pattern is gone — don't reintroduce it.

## `chrome.runtime.getURL`, not `import`, for runtime JSON

Background and movie metadata are loaded at runtime:

```ts
const url = chrome.runtime.getURL("background.json");
const data = await fetch(url).then((r) => r.json());
```

These files must be listed in `manifest.json` under `web_accessible_resources`. If you add a new runtime-fetched JSON, add it there too — otherwise the fetch returns 404 in the extension context.

## The build output is the extension

`npm run dev` writes to `dist/` continuously. To see your changes you must reload the unpacked extension at `chrome://extensions`. There's no hot-reload — Vite rebuilds, you reload.

The Vite config (`vite.config.ts`) deliberately disables hashing on output filenames (`[name].js`, `[name].[ext]`) so paths in `manifest.json` and `newtab.html` stay stable.

## MUI is icons-only

`@mui/material` and `@emotion/*` are present because `@mui/icons-material` requires them as peers. Don't pull in MUI layout components (`Box`, `Stack`, `Button`, etc.) — the project uses its own `components/Button` and plain CSS. Bringing in MUI components silently increases bundle size and introduces a styling system the project doesn't use.

## Background blacklist is event-driven

Users can implicitly reject backgrounds by dispatching `ghiblify:blacklist:add` (see `useBackground.ts`). The hook stores rejected URLs in `ghiblify_blacklist` in localStorage and skips them on next pick. This isn't currently exposed as UI in any widget — if you wire UI for it, dispatch the event rather than touching localStorage directly.

## No tests, no linter

There is no test runner, no ESLint, no Prettier. Verification is manual: rebuild, reload extension, exercise the UI. If you can't manually verify (e.g. running headless), say so — don't claim the change works.

## TypeScript target is ES5

`tsconfig.json` targets `es5`. Vite transpiles, so this rarely matters in practice, but be aware: very modern syntax (e.g. some new array methods) may need polyfills if you depend on them at runtime. The browser is always Chrome (extension context), so ES5 target is overly conservative — but don't change it without checking the build output still runs in the extension.

## React types are pinned to v18 even though React is v19

`package.json` pins `@types/react` and `@types/react-dom` to `^18.2.0` while runtime React is `^19.2.0`. This is a deliberate (or at least known) mismatch — most APIs are compatible. If you hit a typing error related to a React 19 feature, the type pin is the first place to look.
