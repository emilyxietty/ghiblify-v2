# Conventions

## File and folder layout

- One folder per component, named PascalCase: `Button/Button.tsx` + `Button/Button.css`
- `containers/` for stateful + layout-aware code; `components/` for stateless UI
- `hooks/` for data fetching and side effects, camelCase filenames (`useBackground.ts`)
- `config/` for static data only - no React, no JSX
- No barrel `index.ts` files. Always import the concrete file.

## TypeScript

- `strict: true` (see `tsconfig.json`). Don't disable strict checks.
- Components: `const Foo: React.FC<FooProps> = (...) => { ... }`
- Define `Props` interfaces above the component, not inline.
- Don't reach for `any`. If you need it, use `unknown` and narrow.
- Chrome APIs are typed via `@types/chrome` (also see `src/chrome-types.d.ts`).

## React

- Functional components only.
- Hooks: `useState`, `useEffect`, `useContext`, `useRef`, plus the custom hooks in `hooks/`.
- Use `useAppContext()` for global state. Dock-capable widget content should use `hooks/useWidgetSettings.ts` so canvas and dock overrides resolve correctly.
- Effects that touch `localStorage`, `window`, or `document` are normal - this is a Chrome extension running in a browser-only context. No SSR concerns.

## Styling

- Plain CSS, co-located with the component.
- Classes are BEM-lite (`.widget`, `.widget-header`, `.widget-content`).
- Theme is set via CSS custom properties in `src/App.css` - Ghibli palette (warm reds, sky blues, soft yellows). Reference vars from there rather than hardcoding colors.
- Units:
  - Layout: percent
  - Widget positioning: `vw` for X, `vh` for Y
  - Type and detail spacing: `px` (often via the per-widget `fontSize` setting)
- Theme and palette mode are global appearance settings. Widget surface variants are settings-driven and should paint through CSS variables rather than hard-coded colors.

## Imports

- Relative paths only. Example:
  ```ts
  import Button from "../../components/Button/Button.tsx";
  import { useAppContext } from "../../contexts/AppContext.tsx";
  ```
- SVGs are imported as React components via `vite-plugin-svgr` with **named exports**:
  ```ts
  import { ReactComponent as Icon } from "./icon.svg";
  ```
  `titleProp` is enabled - pass `title="..."` for accessibility.
- Common icons come from `components/Icons/Icons.tsx`; do not add an icon framework for a single glyph.

## Storage keys

- Modern widget blob: `ghiblify_widgets` (single JSON value, only diffs from defaults).
- Registered persistent keys go through `storage/hybridStorage.ts`, which owns the `chrome.storage` source and `localStorage` mirror.
- Legacy per-key naming: `<widget>_<field>` - examples: `time_x`, `time_y`, `time_switch`, `todo_fontSize`, `quicklinks_data`.
- Do not dual-write legacy keys. Migrations read and delete them once.
- Keep plain-localStorage keys only when synchronous `storage` events or machine-local caches are part of the design.

## Custom events (cross-component signaling)

Ordinary settings flow through context, not events. When imperative coordination is necessary, use a namespaced event such as `ghiblify:weather:refresh`, dispatch/listen on `window`, and type the detail object explicitly.

## Comments and dead code

- Default to no comments. Add one only when the *why* is non-obvious.
- Don't leave commented-out code. Delete it; git remembers.
- Don't write multi-paragraph block comments or JSDoc unless the user asks.

## Commits

- Conventional-commit prefix: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`.
- Subject line is short, lowercase after the prefix, no trailing period.
- Examples from history:
  ```
  feat(pomodoro): add pomodoro timer
  feat(drag): make lists draggable in quicklinks
  fix(dragging): make dragging based on d key
  ```
