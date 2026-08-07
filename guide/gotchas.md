# Gotchas

Things that have bitten people or are easy to miss.

## Single-blob persistence with one-time migration

Widgets state lives at one hybrid key, `ghiblify_widgets`, written as a diff-from-defaults blob. `chrome.storage.local` is the durable source and localStorage is its synchronous first-paint mirror. The legacy dual-write pattern is gone. On first load after the refactor, `AppContext.tsx` reads legacy keys, builds the new shape, writes the blob, and deletes the legacy keys.

If you're adding a new persisted setting, just add it to the relevant `*Settings` interface in `widgetConfig.ts` - persistence is automatic via the `useEffect` on `widgets`.

## Position anchoring is asymmetric

Widgets are positioned with:

```css
left: <x>vw;
top: <y>vh;
transform: translate(-50%, 0);
```

X is **center-anchored**, Y is **top-anchored**. This is intentional - when a widget's content height changes (e.g. expanding a todo list), the header stays put rather than sliding up/down. If you change this for a single widget, expect the header to drift on resize.

## Drag requires an explicit affordance

Plain click-drag does nothing unless the widget is in edit mode. Outside edit mode, hold `d` first. This keeps text inputs, buttons, and todo rows interactive without accidental movement.

## Pomodoro across tabs

The pomodoro timer uses leader election via `localStorage` + the `storage` event. There is exactly one ticking interval across all open tabs. If you naïvely add a `setInterval` in the Pomodoro component, you'll re-introduce drift and double-decrement bugs.

If you add another time-sensitive widget (e.g. world clocks), follow the same leader pattern.

## EditWidget uses the context, not custom events

`EditWidget` calls `updateWidgetSettings(storageKey, patch)`. Canvas-only widgets read context directly; dock-capable widgets use the surface-aware `useWidgetSettings` hook. React handles the re-render. The old `window.dispatchEvent("timeSettingsChange", ...)` pattern is gone - don't reintroduce it.

## `chrome.runtime.getURL`, not `import`, for runtime JSON

Background and movie metadata are loaded at runtime:

```ts
const url = chrome.runtime.getURL("background.json");
const data = await fetch(url).then((r) => r.json());
```

Keep runtime-fetched JSON in `public/` so it is copied into `dist/`. An extension page can fetch its own packaged resources without `web_accessible_resources`; that manifest entry is only needed when a normal web page needs access.

## The build output is the extension

`pnpm build` writes the production extension to `dist/`; `npm run dev` can watch continuously. To see changes you must reload the unpacked extension at `chrome://extensions`. There is no hot-reload.

The Vite config (`vite.config.mts`) deliberately disables hashing on output filenames (`[name].js`, `[name].[ext]`) so paths in `manifest.json` and `newtab.html` stay stable.

## Icons are local components

Common glyphs live in `components/Icons/Icons.tsx` as inline SVG components. Reuse those or add a local glyph rather than introducing a component/styling framework.

## Background blacklist is event-driven

Background consumers coordinate blacklist changes by dispatching `ghiblify:blacklist:add` (see `useBackground.ts`). Persistence is owned by `backgroundStorage`; callers should dispatch the event rather than writing storage directly.

## No tests, no linter

There is no test runner, no ESLint, no Prettier. Verification is manual: rebuild, reload extension, exercise the UI. If you can't manually verify (e.g. running headless), say so - don't claim the change works.

## TypeScript target is ES2020

`tsconfig.json` targets `es2020`, which matches the modern Chrome-only extension runtime. Check browser support before depending on APIs newer than that target.

## React types are pinned to v18 even though React is v19

`package.json` pins `@types/react` and `@types/react-dom` to `^18.2.0` while runtime React is `^19.2.0`. This is a deliberate (or at least known) mismatch - most APIs are compatible. If you hit a typing error related to a React 19 feature, the type pin is the first place to look.
