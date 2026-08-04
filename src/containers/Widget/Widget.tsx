import React, { ReactNode, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditIcon, OpenWithIcon } from "../../components/Icons/Icons";
import { AccessTimeFilledIcon, CenterFocusStrongIcon, FaceIcon, FormatColorFillIcon, MusicNoteIcon, MyLocationIcon, PhotoSizeSelectSmallIcon, PlaceIcon, RefreshIcon, RemoveIcon, VisibilityOffIcon, VolumeUpIcon } from "../../components/Icons/Icons";
import {
  ContextMenu,
  ContextMenuItem,
} from "../../components/ContextMenu/ContextMenu";
// Lazy — every widget mounts an EditWidget but only the one currently
// being edited actually renders content. Gating on `isEditingThis`
// below means the chunk only fetches the first time any widget enters
// edit mode.
const EditWidget = lazy(() => import("../../components/EditWidget/EditWidget"));
// Lazy for the same reason: only the widget being styled ever needs it.
const ColorPickerPopover = lazy(() =>
  import("../../components/ColorPicker/ColorPicker").then((m) => ({
    default: m.ColorPickerPopover,
  }))
);
import { AddIcon, BlurOnIcon, KeyboardIcon, ListIcon, OpacityIcon, PaletteIcon, TextFieldsIcon, ThermostatIcon, ViewModuleIcon, VisibilityIcon } from "../../components/Icons/Icons";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import {
  WEATHER_DETAILS,
  resolveWeatherDetail,
} from "../../config/widgetConfig";
import {
  AvatarSettings,
  getWidgetConfig,
  InfoSettings,
  NotesSettings,
  QuicklinksSettings,
  TimeSettings,
  WeatherSettings,
  WidgetKey,
} from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { isManualPlace } from "../../utils/geocoding";
import { clearWeatherLocation } from "../../hooks/useWeather";
import {
  HIGHLIGHT_OPACITY_PRESETS,
  HIGHLIGHT_PRESETS,
  isHighlightTextColor,
  normalizeHex,
  pushRecentColor,
  readRecentColors,
  resolveForeground,
  withAlpha,
} from "../../utils/textHighlight";
import {
  POMODORO_SOUND_KEYS,
  isPomodoroSoundKey,
  playPomodoroChime,
  primePomodoroAudio,
  type PomodoroSoundKey,
} from "../../utils/pomodoroChime";
import { toReferencePx, toScreenPx } from "../../utils/viewportScale";
import { useT } from "../../i18n/i18n";
import "./Widget.css";

interface WidgetProps {
  children: ReactNode;
  storageKey: WidgetKey;
  /** When false, the widget plays a fade-out then unmounts. */
  visible?: boolean;
}

const FADE_DURATION_MS = 220;

export const Widget: React.FC<WidgetProps> = ({
  children,
  storageKey,
  visible = true,
}) => {
  // Delayed-unmount state so a hidden widget can play its fade-out before
  // disappearing from the DOM. shouldRender follows `visible` with a
  // FADE_DURATION_MS lag on the way down.
  const [shouldRender, setShouldRender] = useState(visible);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setIsFadingOut(false);
      return;
    }
    if (!shouldRender) return;
    setIsFadingOut(true);
    const t = window.setTimeout(() => {
      setShouldRender(false);
      setIsFadingOut(false);
    }, FADE_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [visible, shouldRender]);

  // NOTE: do NOT early-return here. All hooks below must run on every
  // render (Rules of Hooks) — otherwise toggling visibility off (which
  // flips `shouldRender` to false 220ms later) changes the hook count
  // mid-mount, React throws, the whole tree unmounts, and the user is
  // left staring at body's #000 background until they refresh.

  const {
    showWidgetEdits,
    widgets,
    updateWidgetPosition,
    updateWidgetSettings,
    isDragging,
    setIsDragging,
    editingWidgetKey,
    setEditingWidgetKey,
    toggleWidgetVisibility,
    setWidgetInRightSidebar,
    setWidgetDockWidth,
    setWidgetShowBackground,
    dragMode,
    setDragMode,
    appearance,
    widgetsCommitted,
    previewWidgetSettings,
  } = useAppContext();
  const t = useT();
  // The widget is "in edit mode" if either the global edit toggle is on,
  // or this specific widget was singled out via the Shift+pencil button.
  const isEditingThis = showWidgetEdits || editingWidgetKey === storageKey;
  const widgetConfig = getWidgetConfig(storageKey);
  const widgetSettings = widgets[storageKey].settings as Record<string, unknown>;
  // The saved values, without any hover preview — what the picker and
  // the context menu should reflect.
  const committedSettings = widgetsCommitted[storageKey].settings as Record<
    string,
    unknown
  >;

  const [position, setPosition] = useState(() => widgets[storageKey].position);

  useLayoutEffect(() => {
    if (widgetSettings.typeIn !== true) return;
    const text = widgetRef.current?.textContent?.trim() ?? "";
    if (text.length) setTypeSteps(Math.min(60, Math.max(6, text.length)));
    // Only when the toggle flips: the effect deliberately doesn't watch
    // the text, so a ticking clock doesn't retype itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetSettings.typeIn, storageKey]);

  // Track context position changes (e.g. from a reset) so the local
  // drag-state doesn't get stuck on a stale value.
  useEffect(() => {
    setPosition(widgets[storageKey].position);
  }, [widgets, storageKey]);

  // Right-click context menu — viewport-relative position (clientX/Y),
  // null = closed. ContextMenu handles its own outside-click / Escape /
  // scroll dismissal.
  const [contextMenuPos, setContextMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Character count for the type-in reveal. Measured from the rendered
  // text rather than guessed: `steps()` has to match the number of
  // characters or the reveal lands mid-glyph and reads as a wipe
  // instead of typing. Measured once — re-measuring as the clock ticks
  // would restart the animation every second.
  const [typeSteps, setTypeSteps] = useState(24);

  // Where to float the highlight picker, opened from the context menu.
  const [highlightPickerAt, setHighlightPickerAt] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Listen for programmatic open/close (used by the welcome guide's
  // "right-click for quick actions" slide so the Time widget's menu
  // appears as a live demo). Detail shape:
  //   { key: WidgetKey, x?: number, y?: number }
  // If x/y are omitted on open, position over the widget itself.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { key: string; x?: number; y?: number }
        | undefined;
      if (!detail || detail.key !== storageKey) return;
      let { x, y } = detail;
      if ((x == null || y == null) && widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        x = rect.right + 8;
        y = rect.top + 8;
      }
      if (x != null && y != null) setContextMenuPos({ x, y });
    };
    const onClose = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { key: string }
        | undefined;
      if (!detail || detail.key !== storageKey) return;
      setContextMenuPos(null);
    };
    window.addEventListener("ghiblify:open-context-menu", onOpen);
    window.addEventListener("ghiblify:close-context-menu", onClose);
    return () => {
      window.removeEventListener("ghiblify:open-context-menu", onOpen);
      window.removeEventListener("ghiblify:close-context-menu", onClose);
    };
  }, [storageKey]);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragButton, setDragButton] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMovedWhileMouseDown, setHasMovedWhileMouseDown] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartSize, setResizeStartSize] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [hasChildHeader, setHasChildHeader] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const isQuicklinks = storageKey === "quicklinks";

  useEffect(() => {
    setIsDragging(isResizing);
  }, [isResizing, setIsDragging]);

  // Held-to-drag affordance — press and hold 'd' OR Shift to make
  // widgets draggable, release either to stop. Shift was the
  // original behavior; users coming from earlier versions tried it
  // out of muscle memory, so it's back as an alternative to 'd'.
  // 'd' stays the recommended key because Shift has two known
  // gotchas: (1) Cmd+Shift+4 (macOS screenshot) can swallow the
  // keyup → outline gets stuck on; (2) Shift held during typing
  // capitals could trigger the affordance in non-input contexts.
  // Both are mitigated below — see mousemove + blur + visibility
  // handlers.
  //
  // Skipped when an <input>, <textarea>, <select>, or contentEditable
  // is focused so typing in todos / notes / search doesn't
  // accidentally enable drag.
  useEffect(() => {
    // Track both keys independently — outline stays on while EITHER
    // is held. Refs (not state) so the listeners read the latest
    // values without re-binding on every change.
    const held = { d: false, shift: false };
    const apply = () => {
      document.body.classList.toggle(
        "show-widget-outline",
        held.d || held.shift,
      );
    };
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const tag = el?.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        !!el?.isContentEditable
      );
    };
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "d" || e.key === "D") {
        // Plain 'd' only — combos (Cmd+D bookmark, etc.) shouldn't
        // trigger drag.
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        held.d = true;
        apply();
      } else if (e.key === "Shift") {
        held.shift = true;
        apply();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "d" || e.key === "D") {
        held.d = false;
        apply();
      } else if (e.key === "Shift") {
        held.shift = false;
        apply();
      }
    }
    // Cmd+Shift+4 on macOS swallows the Shift keyup. The next
    // mousemove that arrives with no shift-modifier pressed clears
    // the stranded "shift held" state. Cheap, no observable cost.
    function handleMouseMove(e: MouseEvent) {
      if (held.shift && !e.shiftKey) {
        held.shift = false;
        apply();
      }
    }
    // Window-focus loss / tab switch clear unconditionally so neither
    // key can stay stuck.
    function clearAll() {
      held.d = false;
      held.shift = false;
      apply();
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("blur", clearAll);
    document.addEventListener("visibilitychange", clearAll);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("blur", clearAll);
      document.removeEventListener("visibilitychange", clearAll);
    };
  }, []);

  // Determine alignment based on position
  const getAlignment = () => {
    if (position.x <= 30) {
      return "left";
    } else if (position.x >= 70) {
      return "right";
    }
    return "center";
  };

  const snapToGrid = (centerX: number, centerY: number) => {
    const snapThreshold = 2;
    const snapLines = [2, 50, 98];

    if (!widgetRef.current) {
      return { x: centerX, y: centerY };
    }

    const rect = widgetRef.current.getBoundingClientRect();
    const widthVw = (rect.width / window.innerWidth) * 100;
    const heightVh = (rect.height / window.innerHeight) * 100;

    const snapX = (cx: number) => {
      const leftEdge = cx - widthVw / 2;
      const rightEdge = cx + widthVw / 2;

      for (const snapLine of snapLines) {
        if (Math.abs(leftEdge - snapLine) < snapThreshold) {
          return snapLine + widthVw / 2;
        }
        if (Math.abs(cx - snapLine) < snapThreshold) {
          return snapLine;
        }
        if (Math.abs(rightEdge - snapLine) < snapThreshold) {
          return snapLine - widthVw / 2;
        }
      }

      return cx;
    };

    const snapY = (cy: number) => {
      const topEdge = cy - heightVh / 2;
      const bottomEdge = cy + heightVh / 2;

      for (const snapLine of snapLines) {
        if (Math.abs(topEdge - snapLine) < snapThreshold) {
          return snapLine + heightVh / 2;
        }
        if (Math.abs(cy - snapLine) < snapThreshold) {
          return snapLine;
        }
        if (Math.abs(bottomEdge - snapLine) < snapThreshold) {
          return snapLine - heightVh / 2;
        }
      }

      return cy;
    };

    // Apply snapping
    let constrainedX = snapX(centerX);
    let constrainedY = snapY(centerY);

    // Hard constraints: widget must always be fully visible
    const minX = widthVw / 2;
    const maxX = 100 - widthVw / 2;
    const minY = heightVh / 2;
    const maxY = 100 - heightVh / 2;

    constrainedX = Math.max(minX, Math.min(maxX, constrainedX));
    constrainedY = Math.max(minY, Math.min(maxY, constrainedY));

    return {
      x: constrainedX,
      y: constrainedY,
    };
  };

  // Runtime overflow nudge — measures the widget's actual rendered
  // bounds and computes a corrective offset that keeps it inside the
  // viewport. Storage position is left alone (the user's intent is
  // preserved); only the rendered offset adjusts. The offset is
  // recomputed from the widget's NATURAL position (rect minus the
  // current offset) every measurement, so it shrinks back to zero
  // when the viewport expands and the widget no longer overflows —
  // not just grows when it does. A ref mirrors the state value so
  // the closure inside ResizeObserver always reads the current
  // offset without re-creating the observer on every state change.
  const [overflowOffset, setOverflowOffset] = useState({ x: 0, y: 0 });
  const overflowOffsetRef = useRef(overflowOffset);
  overflowOffsetRef.current = overflowOffset;

  useLayoutEffect(() => {
    const el = widgetRef.current;
    if (!el) return;
    const measureAndAdjust = () => {
      const rect = el.getBoundingClientRect();
      const cur = overflowOffsetRef.current;
      // Natural rect = rendered rect with our offset subtracted out.
      const naturalLeft = rect.left - cur.x;
      const naturalRight = rect.right - cur.x;
      const naturalTop = rect.top - cur.y;
      const naturalBottom = rect.bottom - cur.y;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let dx = 0;
      let dy = 0;
      if (naturalLeft < margin) {
        dx = margin - naturalLeft;
      } else if (naturalRight > vw - margin) {
        dx = vw - margin - naturalRight;
      }
      if (naturalTop < margin) {
        dy = margin - naturalTop;
      } else if (naturalBottom > vh - margin) {
        dy = vh - margin - naturalBottom;
      }
      // Direct set, not additive — converges in one render and
      // shrinks back to {0,0} when the widget would naturally fit.
      if (dx !== cur.x || dy !== cur.y) {
        setOverflowOffset({ x: dx, y: dy });
      }
    };
    measureAndAdjust();
    const ro = new ResizeObserver(measureAndAdjust);
    ro.observe(el);
    window.addEventListener("resize", measureAndAdjust);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureAndAdjust);
    };
  }, [position.x, position.y]);

  const getTransform = () => {
    // Anchor horizontally centered but vertically anchored to the top
    // so changes in child height (collapse/expand) don't shift the
    // widget's top edge / header position. Overflow-nudge offset is
    // baked in via calc() — keeps the widget inside the viewport on
    // small screens without rewriting the user's stored position.
    return `translate(calc(-50% + ${overflowOffset.x}px), ${overflowOffset.y}px)`;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only track drag if mouse is down and dragButton is 0 (left-click, with Shift)
      if (isMouseDown && dragButton === 0 && widgetRef.current) {
        if (!hasMovedWhileMouseDown) {
          setHasMovedWhileMouseDown(true);
          setIsDragging(true);
        }

        const rect = widgetRef.current.getBoundingClientRect();
        const newTopPx = e.clientY + dragOffset.y;
        const newCenterX = e.clientX + dragOffset.x;
        const centerXPercent = (newCenterX / window.innerWidth) * 100;
        const centerYPercent =
          ((newTopPx + rect.height / 2) / window.innerHeight) * 100;
        const snappedCenter = snapToGrid(centerXPercent, centerYPercent);
        const heightVh = (rect.height / window.innerHeight) * 100;
        const topPercent = snappedCenter.y - heightVh / 2;
        setPosition({ x: snappedCenter.x, y: topPercent });
        return;
      }

      // Resize logic — translate the bound that's enabled into a settings patch.
      if (isResizing && storageKey) {
        // Snap operates in screen-px (start / delta / bounds all in
        // current-viewport pixels) so the drag feel stays uniform
        // across viewports. We convert the widget config's
        // reference-px bounds to screen-px here, snap, then convert
        // the result back to reference-px before persisting.
        const screenBound = (b: { min: number; max: number; step: number }) => ({
          min: toScreenPx(b.min),
          max: toScreenPx(b.max),
          // Step in screen-px is the reference step scaled — but we
          // ALSO want the visible step to feel reasonable. Floor at
          // 1 px so very small viewports don't get a 0-step snap.
          step: Math.max(1, toScreenPx(b.step)),
        });
        const snap = (
          start: number,
          delta: number,
          b: { min: number; max: number; step: number },
        ) => {
          const sb = screenBound(b);
          const stepsMoved = Math.round(delta / 20);
          const target = start + stepsMoved * sb.step;
          const snapped = Math.round(target / sb.step) * sb.step;
          return Math.max(sb.min, Math.min(sb.max, snapped));
        };

        if (widgetConfig.size) {
          const newScreen = snap(resizeStartSize, e.clientY - resizeStartY, widgetConfig.size);
          updateWidgetSettings(storageKey, { size: toReferencePx(newScreen) } as never);
        } else if (widgetConfig.width || widgetConfig.height) {
          const patch: Record<string, number> = {};
          if (widgetConfig.width) {
            patch.width = toReferencePx(
              snap(
                resizeStartWidth,
                e.clientX - resizeStartX,
                widgetConfig.width,
              ),
            );
          }
          if (widgetConfig.height) {
            patch.height = toReferencePx(
              snap(
                resizeStartHeight,
                e.clientY - resizeStartY,
                widgetConfig.height,
              ),
            );
          }
          // squareLock — width and height stay tied. Take the larger
          // of the two so the user can drag in either direction and
          // the widget always grows / shrinks as a square.
          if (
            widgetConfig.squareLock &&
            patch.width != null &&
            patch.height != null
          ) {
            const larger = Math.max(patch.width, patch.height);
            patch.width = larger;
            patch.height = larger;
          }
          updateWidgetSettings(storageKey, patch as never);
        } else if (widgetConfig.fontSize) {
          const newScreen = snap(resizeStartSize, e.clientY - resizeStartY, widgetConfig.fontSize);
          updateWidgetSettings(storageKey, { fontSize: toReferencePx(newScreen) } as never);
        }
      } else if (isMouseDown && widgetRef.current) {
        if (!hasMovedWhileMouseDown) {
          setHasMovedWhileMouseDown(true);
          setIsDragging(true);
        }

        // For horizontal positioning we keep center-based coordinates
        // (left + 50% via translateX). For vertical positioning the
        // widget is top-anchored (translateY = 0), so we compute and
        // persist the top edge as `position.y` (percent of viewport
        // height). To keep snapping behavior consistent (which works in
        // center coordinates), we compute a candidate center Y from the
        // new top and run snapToGrid, then convert the snapped center
        // back to a top percentage.
        const rect = widgetRef.current.getBoundingClientRect();

        const newTopPx = e.clientY + dragOffset.y; // dragOffset.y stores top - mouseY
        const newCenterX = e.clientX + dragOffset.x; // center X in px

        const centerXPercent = (newCenterX / window.innerWidth) * 100;
        const centerYPercent =
          ((newTopPx + rect.height / 2) / window.innerHeight) * 100;

        const snappedCenter = snapToGrid(centerXPercent, centerYPercent);

        const heightVh = (rect.height / window.innerHeight) * 100;
        const topPercent = snappedCenter.y - heightVh / 2;

        setPosition({ x: snappedCenter.x, y: topPercent });
      }
    };

    const handleMouseUp = (e?: MouseEvent) => {
      if (isResizing) {
        setIsResizing(false);
        setIsDragging(false);
      }
      if (isMouseDown) {
        setIsMouseDown(false);
        setHasMovedWhileMouseDown(false);
        setIsDragging(false);
        setDragButton(null);

        // If the user moved the widget while the mouse was down, persist
        // the new position and mark this widget as "just dragged" so child
        // header click handlers can ignore the immediate click that follows
        // the drag end (prevents accidental toggles).
        if (storageKey && hasMovedWhileMouseDown && updateWidgetPosition) {
          updateWidgetPosition(storageKey, position);
        }

        if (hasMovedWhileMouseDown && widgetRef.current) {
          try {
            widgetRef.current.dataset.justDragged = "true";
            window.setTimeout(() => {
              if (widgetRef.current)
                delete widgetRef.current.dataset.justDragged;
            }, 200);
          } catch (err) {
            // ignore
          }
          // Suppress the next click event that follows a drag so child
          // header click handlers don't receive the synthetic click that
          // browsers typically fire after mouseup. Use capture-phase
          // listener so we can stop the event before React handlers run.
          try {
            const suppressClick = (ev: MouseEvent) => {
              try {
                const target = ev.target as Node | null;
                if (!target || !widgetRef.current) return;
                // If the click landed inside this widget, prevent it.
                if (widgetRef.current.contains(target)) {
                  ev.stopImmediatePropagation();
                  ev.preventDefault();
                }
              } finally {
                document.removeEventListener("click", suppressClick, true);
              }
            };
            document.addEventListener("click", suppressClick, true);
          } catch (err) {
            // ignore
          }
        }
      }
    };

    if ((isMouseDown && dragButton === 0) || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isMouseDown,
    dragButton,
    isResizing,
    dragOffset,
    resizeStartX,
    resizeStartY,
    resizeStartSize,
    resizeStartWidth,
    resizeStartHeight,
    storageKey,
    position,
    widgetConfig,
    setIsDragging,
    updateWidgetSettings,
    updateWidgetPosition,
    hasMovedWhileMouseDown,
  ]);

  // detect whether the child rendered its own header (so we can avoid
  // rendering a fallback header)
  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;
    const found = Boolean(
      el.querySelector && el.querySelector(".widget-header")
    );
    setHasChildHeader(found);
  }, [children]);

  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    // Two ways to opt into widget dragging:
    //   1. Hold 'd' + left-click (one-shot drag without leaving
    //      normal mode). The 'd' keydown/keyup effect above keeps
    //      `body.show-widget-outline` in sync with the held state,
    //      so reading the class is the cheapest authoritative
    //      check at click time.
    //   2. Drag Mode is on (sticky mode toggled from sidebar /
    //      right-click).
    if (e.button !== 0) return;
    // `show-widget-outline` body class is added when EITHER `d` or
    // Shift is held (see the held-to-drag effect higher up). Both
    // keys are valid drag activators.
    const dragKeyHeld = document.body.classList.contains(
      "show-widget-outline",
    );
    if (!dragKeyHeld && !dragMode) return;
    if (isResizing) return;

    // Don't hijack mousedowns that originated on the resize handle or
    // the quick-edit button — those have their own click handlers and
    // the drag flow swallows the click.
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".widget-resize-handle")) return;
    if (target?.closest?.(".widget-quick-edit")) return;

    e.preventDefault();
    e.stopPropagation();

    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const top = rect.top;

      setDragOffset({
        x: centerX - e.clientX,
        y: top - e.clientY,
      });

      setIsMouseDown(true);
      setHasMovedWhileMouseDown(false);
      setDragButton(e.button);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Storage is reference-px; the drag handler does math in
    // screen-px (so the drag feel stays consistent across viewports —
    // 20 px of mouse movement is always one "step" regardless of
    // current viewport width). Convert stored → screen at drag-start;
    // we'll convert screen → reference at write time inside mousemove.
    if (widgetConfig.fontSize) {
      setResizeStartSize(toScreenPx(Number(widgetSettings.fontSize) || 0));
    } else if (widgetConfig.size) {
      setResizeStartSize(toScreenPx(Number(widgetSettings.size) || 0));
    } else {
      if (widgetConfig.width)
        setResizeStartWidth(toScreenPx(Number(widgetSettings.width) || 0));
      if (widgetConfig.height)
        setResizeStartHeight(toScreenPx(Number(widgetSettings.height) || 0));
    }

    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartY(e.clientY);
    setIsDragging(true);
  };

  const alignment = getAlignment();
  const hasResizeHandle = !!(
    widgetConfig.fontSize ||
    widgetConfig.size ||
    widgetConfig.width ||
    widgetConfig.height
  );

  // Safe to early-return now — all hooks above have already run.
  if (!shouldRender) return null;

  // Surface up the widget's opacity + blur settings (when present) as
  // shared CSS vars on the shell. Non-Frost themes use --widget-opacity
  // for surface alpha; Frost uses --widget-blur for glass intensity.
  // Each is set as a 0–1 fraction.
  const opacityFraction =
    "opacity" in widgetSettings
      ? Math.max(0, Math.min(1, Number(widgetSettings.opacity) / 100))
      : undefined;
  const blurFraction =
    "blur" in widgetSettings
      ? Math.max(0, Math.min(1, Number(widgetSettings.blur) / 100))
      : undefined;
  // Text highlight — a hex string turns it on, null/absent leaves it
  // off. The shell only publishes the vars; which text nodes actually
  // get painted is a per-widget selector list in Widget.css.
  // `widgetSettings` already carries any hover preview — AppContext
  // merges it into the render view, so nothing extra is needed here.
  const highlight =
    typeof widgetSettings.highlightColor === "string"
      ? normalizeHex(widgetSettings.highlightColor)
      : null;
  const highlightAlpha =
    typeof widgetSettings.highlightOpacity === "number"
      ? widgetSettings.highlightOpacity
      : 100;
  const typeIn = widgetSettings.typeIn === true;

  return (
    <div
      ref={widgetRef}
      className={`widget ${isDragging ? "dragging" : ""} ${
        isEditingThis ? "edit-mode" : ""
      } ${isResizing ? "resizing" : ""} ${
        isFadingOut ? "fade-out" : ""
      } draggable widget-align-${alignment}${
        highlight ? " has-text-highlight" : ""
      }${typeIn ? " has-type-in" : ""}`}
      data-widget-key={storageKey}
      style={{
        left: `${position.x}vw`,
        top: `${position.y}vh`,
        transform: getTransform(),
        ...(opacityFraction !== undefined
          ? { ["--widget-opacity" as any]: opacityFraction }
          : {}),
        ...(blurFraction !== undefined
          ? { ["--widget-blur" as any]: blurFraction }
          : {}),
        ...(typeIn
          ? {
              ["--type-in-steps" as any]: typeSteps,
              ["--type-in-duration" as any]: `${typeSteps * 0.055}s`,
            }
          : {}),
        ...(highlight
          ? {
              ["--text-highlight" as any]: withAlpha(highlight, highlightAlpha),
              ["--text-highlight-fg" as any]: resolveForeground(
                highlight,
                isHighlightTextColor(widgetSettings.highlightTextColor)
                  ? widgetSettings.highlightTextColor
                  : "auto"
              ),
            }
          : {}),
      }}
      onMouseDown={handleWidgetMouseDown}
      onContextMenu={(e) => {
        // Let the browser's native context menu (copy / cut / paste /
        // spell-check / undo) fire when the right-click is inside a
        // text input, textarea, or any contentEditable element —
        // hijacking those would break basic editing UX. We DO still
        // stop propagation so the background's right-click handler
        // doesn't fire either.
        const target = e.target as HTMLElement | null;
        const isEditable = !!(
          target &&
          (target.matches?.(
            "input, textarea, [contenteditable], [contenteditable='true']"
          ) ||
            target.closest?.(
              "input, textarea, [contenteditable], [contenteditable='true']"
            ))
        );
        e.stopPropagation();
        if (isEditable) return;
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* if child doesn't render a '.widget-header', show a small invisible
          top handle so the widget remains draggable */}
      {!hasChildHeader && (
        <div
          className="widget-fallback-header widget-header"
          aria-hidden="true"
        />
      )}
      {isEditingThis && !isResizing && (
        <Suspense fallback={null}>
          <EditWidget
            showWidgetEdits={isEditingThis}
            isResizing={isResizing}
            storageKey={storageKey}
            anchorEl={widgetRef.current}
          />
        </Suspense>
      )}
      {isEditingThis &&
        hasResizeHandle &&
        !(isQuicklinks && !widgets.quicklinks.settings.gridMode) && (
          <div
            ref={resizeHandleRef}
            className="widget-resize-handle"
            onMouseDown={handleResizeMouseDown}
            title={t("widgets.edit.resizeTitle")}
          ></div>
        )}
      {/* Drag-mode-only quick controls — only visible while `d` is held
          and the widget isn't already in edit mode. The pencil at top-
          right jumps straight into editing this widget; the minus at
          top-left hides the widget without opening any menu. CSS class
          .show-widget-outline (toggled by the held-d effect above)
          fades both in. */}
      {!isEditingThis && (
        <button
          type="button"
          className="widget-quick-edit"
          onClick={(e) => {
            e.stopPropagation();
            setEditingWidgetKey(storageKey);
          }}
          aria-label={t("widgets.edit.ariaEdit", { key: storageKey })}
          data-tooltip={t("widgets.edit.tooltipEdit")}
          tabIndex={-1}
        >
          <EditIcon style={{ fontSize: 14 }} />
        </button>
      )}
      {!isEditingThis && (
        <button
          type="button"
          className="widget-quick-hide"
          onClick={(e) => {
            e.stopPropagation();
            toggleWidgetVisibility(storageKey);
          }}
          aria-label={t("widgets.edit.ariaHide", { key: storageKey })}
          data-tooltip={t("widgets.edit.tooltipHide")}
          tabIndex={-1}
        >
          <RemoveIcon style={{ fontSize: 16 }} />
        </button>
      )}
      <div className="widget-content">{children}</div>
      {contextMenuPos && (
        <ContextMenu
          position={contextMenuPos}
          onClose={() => setContextMenuPos(null)}
          items={buildContextMenuItems({
            storageKey,
            widgets: widgetsCommitted,
            t,
            setEditingWidgetKey,
            toggleWidgetVisibility,
            updateWidgetSettings,
            setWidgetInRightSidebar,
            setWidgetDockWidth,
            setWidgetShowBackground,
            setDragMode,
            isFrost: appearance.theme === "frost",
            preview: (patch) => previewWidgetSettings(storageKey, patch),
            openHighlightPicker: () =>
              setHighlightPickerAt(contextMenuPos ?? { x: 80, y: 80 }),
          })}
        />
      )}
      {highlightPickerAt && (
        <Suspense fallback={null}>
          <ColorPickerPopover
            anchor={highlightPickerAt}
            color={
              typeof committedSettings.highlightColor === "string"
                ? normalizeHex(committedSettings.highlightColor)
                : null
            }
            textColor={
              isHighlightTextColor(committedSettings.highlightTextColor)
                ? committedSettings.highlightTextColor
                : "auto"
            }
            opacity={
              typeof committedSettings.highlightOpacity === "number"
                ? committedSettings.highlightOpacity
                : 100
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, {
                highlightColor: next,
              } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, {
                highlightTextColor: next,
              } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, {
                highlightOpacity: next,
              } as never)
            }
            onClose={() => setHighlightPickerAt(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

const INFO_FIELD_KEYS = [
  "japaneseTitle",
  "title",
  "year",
  "movieLength",
  "quote",
] as const;

// Per-widget right-click menu builder. Mirrors the controls available
// in EditWidget so users get the same toggles without entering edit
// mode. Multi-select options become cascading submenus to keep the
// root menu compact.
//
// `mode` selects the surface:
//   "canvas" — full menu (Edit, Drag, Hide + extras). Hide toggles
//     `visible`, removing the widget from BOTH canvas and dock.
//   "dock"   — Edit/Drag are dropped (no-op in the dock; sizing is
//     hard-coded). Hide only flips `inRightSidebar` so the canvas
//     state is untouched. Settings extras come first since they're
//     the user's primary use of right-click in the dock.
export function buildContextMenuItems(args: {
  storageKey: WidgetKey;
  widgets: ReturnType<typeof useAppContext>["widgets"];
  t: (key: string, vars?: Record<string, string | number>) => string;
  setEditingWidgetKey: (k: WidgetKey | null) => void;
  toggleWidgetVisibility: (k: WidgetKey) => void;
  updateWidgetSettings: ReturnType<
    typeof useAppContext
  >["updateWidgetSettings"];
  setWidgetInRightSidebar: (k: WidgetKey, value: boolean) => void;
  setWidgetDockWidth: (k: WidgetKey, value: "half" | "full") => void;
  setWidgetShowBackground: (k: WidgetKey, value: boolean) => void;
  setDragMode: (b: boolean) => void;
  isFrost: boolean;
  mode?: "canvas" | "dock";
  /** Demo a settings patch while a row is hovered; null clears it.
   *  Rows whose effect isn't visible on the widget (multi-selects,
   *  sounds) deliberately don't use this. */
  preview?: (patch: Record<string, unknown> | null) => void;
  /** Open the highlight colour picker at the menu's position. */
  openHighlightPicker?: () => void;
}): ContextMenuItem[] {
  const {
    storageKey,
    widgets,
    t,
    setEditingWidgetKey,
    toggleWidgetVisibility,
    updateWidgetSettings,
    setWidgetInRightSidebar,
    setWidgetDockWidth,
    setWidgetShowBackground,
    setDragMode,
    isFrost,
    mode = "canvas",
    preview,
    openHighlightPicker,
  } = args;

  /** Hover handler for a radio row that demos `patch`. */
  const demo = (patch: Record<string, unknown>) => (active: boolean) =>
    preview?.(active ? patch : null);

  const widgetName = t(`widgets.names.${storageKey}`);
  const universal: ContextMenuItem[] =
    mode === "canvas"
      ? [
          {
            type: "action",
            label: t("widgets.contextMenu.edit", { name: widgetName }),
            onClick: () => setEditingWidgetKey(storageKey),
            icon: <EditIcon style={{ fontSize: 14 }} />,
          },
          {
            type: "action",
            label: t("widgets.contextMenu.drag", { name: widgetName }),
            onClick: () => setDragMode(true),
            icon: <OpenWithIcon style={{ fontSize: 14 }} />,
          },
          {
            type: "action",
            label: t("widgets.contextMenu.hide", { name: widgetName }),
            onClick: () => toggleWidgetVisibility(storageKey),
            icon: <VisibilityOffIcon style={{ fontSize: 14 }} />,
          },
        ]
      : [];

  let extras: ContextMenuItem[] = [];

  if (storageKey === "time") {
    const s = widgets.time.settings as TimeSettings;
    const isAnalog = !!s.analog;
    extras = [
      {
        type: "submenu",
        label: t("widgets.contextMenu.timeFormat"),
        icon: <AccessTimeFilledIcon style={{ fontSize: 14 }} />,
        items: [
          {
            type: "radio",
            label: t("widgets.contextMenu.time12"),
            selected: !isAnalog && !s.is24Hour,
            onHover: demo({ analog: false, is24Hour: false }),
            onClick: () =>
              updateWidgetSettings("time", { analog: false, is24Hour: false }),
          },
          {
            type: "radio",
            label: t("widgets.contextMenu.time24"),
            selected: !isAnalog && !!s.is24Hour,
            onHover: demo({ analog: false, is24Hour: true }),
            onClick: () =>
              updateWidgetSettings("time", { analog: false, is24Hour: true }),
          },
          {
            type: "radio",
            label: t("widgets.contextMenu.timeAnalog"),
            selected: isAnalog,
            onHover: demo({ analog: true }),
            onClick: () => updateWidgetSettings("time", { analog: true }),
          },
        ],
      },
    ];
  } else if (storageKey === "quicklinks") {
    const s = widgets.quicklinks.settings as QuicklinksSettings;
    extras = [
      {
        type: "action",
        label: t("widgets.contextMenu.addLink"),
        icon: <AddIcon style={{ fontSize: 14 }} />,
        onClick: () =>
          window.dispatchEvent(new CustomEvent("ghiblify:quicklinks:add")),
      },
      { type: "separator" },
      {
        type: "submenu",
        label: t("widgets.contextMenu.quicklinksView"),
        icon: s.gridMode ? (
          <ViewModuleIcon style={{ fontSize: 14 }} />
        ) : (
          <ListIcon style={{ fontSize: 14 }} />
        ),
        items: [
          {
            type: "radio",
            label: t("widgets.edit.gridShow"),
            selected: !!s.gridMode,
            onHover: demo({ gridMode: true }),
            onClick: () =>
              updateWidgetSettings("quicklinks", { gridMode: true }),
          },
          {
            type: "radio",
            label: t("widgets.edit.gridShowList"),
            selected: !s.gridMode,
            onHover: demo({ gridMode: false }),
            onClick: () =>
              updateWidgetSettings("quicklinks", { gridMode: false }),
          },
        ],
      },
    ];
  } else if (storageKey === "weather") {
    const s = widgets.weather.settings as WeatherSettings;
    const detail = resolveWeatherDetail(s);
    // Half-width dock cells aren't wide enough for the forecast strips,
    // so the scale stops at "now" there — matching what the widget
    // actually renders on that surface.
    const isHalfDock =
      mode === "dock" && widgets.weather.dockWidth === "half";
    const detailOptions = isHalfDock
      ? (["icon", "now"] as const)
      : WEATHER_DETAILS;

    // Read the resolved location from the weather cache so the user
    // can see what geolocation reported. The label is set by
    // useWeather after a reverse-geocode (BigDataCloud) and persisted
    // in `ghiblify_weather.place.label`.
    let locationLabel: string | null = null;
    try {
      const raw = localStorage.getItem("ghiblify_weather");
      if (raw) {
        const blob = JSON.parse(raw);
        const label = blob?.place?.label;
        if (typeof label === "string" && label.trim()) locationLabel = label;
      }
    } catch {
      /* ignore — no label shown */
    }

    const manual = isManualPlace(s.manualPlace) ? s.manualPlace : null;

    // Four cascades — Location / Detail / Units / Style. Every root row
    // is the same kind of thing (a group you open), and each cascade
    // answers exactly one question.
    extras = [
      // The resolved place *is* the row — it used to be a dead info
      // line with a separate "Location" cascade underneath, which read
      // as a disabled item sitting above the thing that actually works.
      {
        type: "submenu",
        label: locationLabel ?? t("widgets.contextMenu.weatherLocation"),
        icon: <MyLocationIcon style={{ fontSize: 14 }} />,
        items: [
          {
            type: "radio",
            label: t("widgets.contextMenu.weatherUseMyLocation"),
            selected: !manual,
            onClick: () => {
              updateWidgetSettings("weather", {
                manualPlace: null,
                useDeviceLocation: true,
              });
              // The manual city's coords live under the same cache key
              // the device position uses, so they have to go too.
              clearWeatherLocation();
              window.dispatchEvent(new CustomEvent("ghiblify:weather:refresh"));
            },
          },
          ...(manual
            ? ([
                {
                  type: "radio" as const,
                  label: manual.name,
                  selected: true,
                  onClick: () => {
                    /* already active — picking it again is a no-op */
                  },
                },
              ] as ContextMenuItem[])
            : []),
          { type: "separator" },
          {
            type: "action",
            label: t("widgets.contextMenu.weatherChooseCity"),
            icon: <PlaceIcon style={{ fontSize: 14 }} />,
            onClick: () =>
              window.dispatchEvent(
                new CustomEvent("ghiblify:weather:choose-city")
              ),
          },
          {
            type: "action",
            label: t("widgets.contextMenu.weatherRefresh"),
            icon: <RefreshIcon style={{ fontSize: 14 }} />,
            onClick: () =>
              window.dispatchEvent(new CustomEvent("ghiblify:weather:refresh")),
          },
        ],
      },
      // One scale instead of three checkboxes plus an icons-only
      // toggle: each step is a superset of the last, so there's no
      // invalid combination to guard against.
      {
        type: "submenu",
        label: t("widgets.contextMenu.weatherDetail"),
        icon: <VisibilityIcon style={{ fontSize: 14 }} />,
        items: detailOptions.map((v) => ({
          type: "radio" as const,
          label: t(`widgets.edit.weatherDetail.${v}`),
          selected: detail === v,
          onHover: demo({ detail: v }),
          onClick: () => updateWidgetSettings("weather", { detail: v }),
        })),
      },
      {
        type: "submenu",
        label: t("widgets.edit.weatherUnitLabel"),
        icon: <ThermostatIcon style={{ fontSize: 14 }} />,
        items: (["C", "F"] as const).map((v) => ({
          type: "radio" as const,
          label: t(`widgets.edit.weatherUnit${v}`),
          selected: s.unit === v,
          // Unit changes need a refetch, so the preview only swaps the
          // suffix — close enough to answer "which one am I on?".
          onHover: demo({ unit: v }),
          onClick: () => updateWidgetSettings("weather", { unit: v }),
        })),
      },
      // Surface treatment and motion. Motion stays its own checkbox
      // rather than being folded into the surface presets — wanting
      // still icons is usually an accessibility call, and it shouldn't
      // cost you the card.
      {
        type: "submenu",
        label: t("widgets.contextMenu.weatherStyle"),
        icon: <PaletteIcon style={{ fontSize: 14 }} />,
        items: [
          {
            type: "radio",
            label: t("widgets.edit.weatherStylePlain"),
            selected: !s.showCard,
            onHover: demo({ showCard: false }),
            onClick: () => updateWidgetSettings("weather", { showCard: false }),
          },
          {
            type: "radio",
            label: t("widgets.edit.weatherStyleCard"),
            selected: !!s.showCard,
            onHover: demo({ showCard: true }),
            onClick: () => updateWidgetSettings("weather", { showCard: true }),
          },
          { type: "separator" },
          {
            type: "checkbox",
            label: t("widgets.edit.weatherAnimatedIcons"),
            checked: (s.iconStyle ?? "animated") === "animated",
            onClick: () =>
              updateWidgetSettings("weather", {
                iconStyle:
                  (s.iconStyle ?? "animated") === "animated"
                    ? "still"
                    : "animated",
              }),
          },
        ],
      },
    ];
  } else if (storageKey === "notes") {
    const s = widgets.notes.settings as NotesSettings;
    const showBorder = s.showBorder !== false;
    extras = [
      {
        type: "checkbox",
        label: t("widgets.edit.notesShowBorder"),
        checked: showBorder,
        onClick: () =>
          updateWidgetSettings("notes", { showBorder: !showBorder }),
      },
    ];
  } else if (storageKey === "avatar") {
    const s = widgets.avatar.settings as AvatarSettings;
    extras = [
      {
        type: "submenu",
        label: t("widgets.contextMenu.selectAvatar"),
        icon: <FaceIcon style={{ fontSize: 14 }} />,
        items: AVATAR_OPTIONS.map((opt) => ({
          type: "radio" as const,
          label: opt.label,
          selected: s.selectedAvatar === opt.value,
          // Names alone ("Boh", "Heen") don't tell you who you're
          // picking — hovering swaps the avatar in place so you see it.
          onHover: demo({ selectedAvatar: opt.value }),
          onClick: () =>
            updateWidgetSettings("avatar", { selectedAvatar: opt.value }),
        })),
      },
    ];
  } else if (storageKey === "pomodoro") {
    // Focus mode lives in Pomodoro's local React state, not in
    // AppContext. Read the current state from the same localStorage
    // blob the widget reads at mount, and dispatch a custom event the
    // Pomodoro effect listens for to flip it.
    let focusOn = false;
    try {
      const raw = localStorage.getItem("ghiblify_pomodoro");
      if (raw) {
        const blob = JSON.parse(raw);
        focusOn = blob?.focusMode === true;
      }
    } catch {
      /* ignore — default to false */
    }
    const pSettings = widgets.pomodoro.settings as {
      size?: "small" | "medium" | "large" | "compact" | "regular";
      sound?: PomodoroSoundKey;
      soundVolume?: number;
    };
    // Anything that isn't a known current size (small/medium/large)
    // collapses to "medium" — covers legacy "compact" / "regular"
    // labels and any other stale value, so the default experience
    // is always medium.
    const rawSize = pSettings.size ?? "medium";
    const currentSize: "small" | "medium" | "large" =
      rawSize === "small" || rawSize === "medium" || rawSize === "large"
        ? rawSize
        : "medium";
    // Chime settings, validated the same way Pomodoro validates them —
    // stored settings can predate the feature (undefined) or name a
    // sound key that no longer exists.
    const currentSound: PomodoroSoundKey = isPomodoroSoundKey(pSettings.sound)
      ? pSettings.sound
      : "musicbox";
    const currentVolume =
      typeof pSettings.soundVolume === "number" ? pSettings.soundVolume : 70;
    // The EditWidget slider is continuous but a cascade has to be
    // discrete, so the radio highlights the preset the stored volume is
    // closest to (the 70 default lands on 75). Picking one snaps to the
    // exact preset value.
    const VOLUME_PRESETS = [0, 25, 50, 75, 100];
    const nearestVolume = VOLUME_PRESETS.reduce((best, v) =>
      Math.abs(v - currentVolume) < Math.abs(best - currentVolume) ? v : best
    );
    extras = [
      {
        type: "action",
        label: focusOn
          ? t("widgets.contextMenu.focusModeOff")
          : t("widgets.contextMenu.focusModeOn"),
        icon: <CenterFocusStrongIcon style={{ fontSize: 14 }} />,
        onClick: () =>
          window.dispatchEvent(
            new CustomEvent("ghiblify:pomodoro:toggle-focus")
          ),
      },
      { type: "separator" },
      // Size / Sound / Volume all cascade rather than sitting flat, so
      // the root menu stays one screenful next to the generic
      // opacity/blur entries appended below.
      {
        type: "submenu",
        label: t("widgets.edit.pomodoroSizeLabel"),
        icon: <PhotoSizeSelectSmallIcon style={{ fontSize: 14 }} />,
        items: (["small", "medium", "large"] as const).map((v) => ({
          type: "radio" as const,
          label: t(
            `widgets.contextMenu.pomodoroSize${
              v.charAt(0).toUpperCase() + v.slice(1)
            }`
          ),
          selected: currentSize === v,
          onHover: demo({ size: v }),
          onClick: () => updateWidgetSettings("pomodoro", { size: v }),
        })),
      },
      // Picking a sound previews it, same as the EditWidget dropdown.
      // The click is a real user gesture, so it doubles as the audio
      // unlock — otherwise the context is still suspended when the
      // timer ends half an hour later and the chime is silent.
      {
        type: "submenu",
        label: t("widgets.edit.pomodoroSoundLabel"),
        icon: <MusicNoteIcon style={{ fontSize: 14 }} />,
        items: POMODORO_SOUND_KEYS.map((v) => ({
          type: "radio" as const,
          label: t(`widgets.edit.pomodoroSound.${v}`),
          selected: currentSound === v,
          onClick: () => {
            updateWidgetSettings("pomodoro", { sound: v });
            primePomodoroAudio();
            playPomodoroChime(v, currentVolume);
          },
        })),
      },
      // Volume is meaningless with no chime to play — hidden on "none",
      // matching the EditWidget slider's own gate.
      ...(currentSound === "none"
        ? []
        : [
            {
              type: "submenu" as const,
              label: t("widgets.edit.pomodoroVolume"),
              icon: <VolumeUpIcon style={{ fontSize: 14 }} />,
              items: VOLUME_PRESETS.map((v) => ({
                type: "radio" as const,
                label: `${v}%`,
                selected: nearestVolume === v,
                onClick: () => {
                  updateWidgetSettings("pomodoro", { soundVolume: v });
                  primePomodoroAudio();
                  playPomodoroChime(currentSound, v);
                },
              })),
            },
          ]),
    ];
  } else if (storageKey === "info") {
    const s = widgets.info.settings as InfoSettings;
    const onlyOneOn =
      INFO_FIELD_KEYS.filter((k) => s.infoFields[k]).length <= 1;
    extras = [
      {
        type: "submenu",
        label: t("widgets.edit.infoFieldsLabel"),
        icon: <ListIcon style={{ fontSize: 14 }} />,
        items: INFO_FIELD_KEYS.map((k) => ({
          type: "checkbox" as const,
          label: t(`widgets.edit.infoFields.${k}`),
          checked: !!s.infoFields[k],
          disabled: onlyOneOn && !!s.infoFields[k],
          onClick: () => {
            const nextFields = { ...s.infoFields, [k]: !s.infoFields[k] };
            const remaining = INFO_FIELD_KEYS.filter(
              (fk) => nextFields[fk]
            ).length;
            if (remaining === 0) return;
            updateWidgetSettings("info", { infoFields: nextFields });
          },
        })),
      },
    ];
  }

  // Generic text-shadow cascade — auto-attaches to any widget whose
  // settings include `textShadow` (currently Time, Date, Greeting).
  // Adding `textShadow` to a new widget's settings interface gets
  // this submenu for free, no extra wiring.
  const widgetSettingsAny = widgets[storageKey].settings as Record<
    string,
    unknown
  >;
  // Text highlight — auto-attaches to any widget whose settings carry
  // `highlightColor`. The cascade covers the common case (a suggested
  // colour, an alpha for it) without leaving the menu; the picker row
  // opens the full swatch/wheel/hex panel for everything else.
  if ("highlightColor" in widgetSettingsAny) {
    const current =
      typeof widgetSettingsAny.highlightColor === "string"
        ? normalizeHex(widgetSettingsAny.highlightColor)
        : null;
    const highlightOpacity =
      typeof widgetSettingsAny.highlightOpacity === "number"
        ? widgetSettingsAny.highlightOpacity
        : 100;
    const recents = readRecentColors();
    const swatches = [
      ...recents,
      ...HIGHLIGHT_PRESETS.filter((p) => !recents.includes(p)),
    ].slice(0, 8);
    if (extras.length > 0) extras.push({ type: "separator" });
    extras.push({
      type: "submenu",
      label: t("widgets.contextMenu.highlight"),
      icon: <FormatColorFillIcon style={{ fontSize: 14 }} />,
      items: [
        {
          type: "radio",
          label: t("widgets.contextMenu.highlightOff"),
          selected: !current,
          onHover: demo({ highlightColor: null }),
          onClick: () =>
            updateWidgetSettings(storageKey, {
              highlightColor: null,
            } as never),
        },
        { type: "separator" },
        // Each colour opens onto its own alpha levels, so a pick is one
        // gesture: the row you land on sets colour and opacity
        // together. A shared opacity submenu meant choosing twice, and
        // the alpha you'd get was invisible while picking the colour.
        ...swatches.map((hex) => ({
          type: "submenu" as const,
          label: hex.toUpperCase(),
          icon: (
            <span
              className="ctx-menu-swatch"
              style={{ background: withAlpha(hex, highlightOpacity) }}
              aria-hidden="true"
            />
          ),
          items: HIGHLIGHT_OPACITY_PRESETS.map((v) => ({
            type: "radio" as const,
            label: `${v}%`,
            // The chip shows this exact colour+alpha, so the row is a
            // preview of the bar it produces.
            swatch: withAlpha(hex, v),
            selected: current === hex && highlightOpacity === v,
            onHover: demo({ highlightColor: hex, highlightOpacity: v }),
            onClick: () => {
              pushRecentColor(hex);
              updateWidgetSettings(storageKey, {
                highlightColor: hex,
                highlightOpacity: v,
              } as never);
            },
          })),
        })),
        { type: "separator" },
        {
          type: "action",
          label: t("widgets.contextMenu.highlightCustom"),
          icon: <FormatColorFillIcon style={{ fontSize: 14 }} />,
          onClick: () => openHighlightPicker?.(),
        },
      ],
    });
  }

  // Type-in — auto-attaches wherever the setting exists, same rule as
  // the highlight above.
  if ("typeIn" in widgetSettingsAny) {
    extras.push({
      type: "checkbox",
      label: t("widgets.contextMenu.typeIn"),
      icon: <KeyboardIcon style={{ fontSize: 14 }} />,
      checked: widgetSettingsAny.typeIn === true,
      onClick: () =>
        updateWidgetSettings(storageKey, {
          typeIn: widgetSettingsAny.typeIn !== true,
        } as never),
    });
  }

  if (typeof widgetSettingsAny.textShadow === "number") {
    if (extras.length > 0) extras.push({ type: "separator" });
    const current = widgetSettingsAny.textShadow as number;
    extras.push({
      type: "submenu",
      label: t("widgets.contextMenu.textShadow"),
      icon: <TextFieldsIcon style={{ fontSize: 14 }} />,
      items: [0, 50, 100, 150, 200].map((v) => ({
        type: "radio" as const,
        label: `${v}%`,
        selected: current === v,
        onHover: demo({ textShadow: v }),
        onClick: () =>
          updateWidgetSettings(storageKey, { textShadow: v } as never),
      })),
    });
  }

  // Generic opacity / blur cascades — mirror the textShadow pattern.
  // Auto-attaches to any widget whose settings include numeric
  // `opacity` / `blur` fields (Todo, QuickLinks, SearchBar, Weather,
  // Pomodoro [opacity only]). Gated by theme to match EditWidget's
  // slider, which swaps the same way:
  //   - Non-Frost themes: Opacity is the meaningful surface knob
  //     (alpha of the tinted background). Blur is irrelevant — the
  //     widget isn't a glass pane.
  //   - Frost: Blur is the meaningful knob (glass haze intensity).
  //     Opacity is locked by the Frost surface alpha cap.
  // Showing only the relevant one keeps the menu honest about what
  // moving the slider would actually do on the current theme.
  const OPACITY_BLUR_PRESETS = [0, 25, 50, 75, 100];
  // Weather-specific gate: the opacity knob only tints the hourly /
  // daily forecast cell backgrounds. If the user has both strips off
  // (only "Now" showing), opacity is a no-op — same gate EditWidget
  // applies to its slider — so we skip the cascade entirely.
  // Weather's opacity only tints the forecast cells, which don't exist
  // below the "hourly" detail level — so the cascade would be a no-op.
  const weatherDetail = resolveWeatherDetail(
    widgets.weather.settings as WeatherSettings
  );
  const weatherOpacityIsNoOp =
    storageKey === "weather" &&
    weatherDetail !== "hourly" &&
    weatherDetail !== "full";
  if (
    typeof widgetSettingsAny.opacity === "number" &&
    !isFrost &&
    !weatherOpacityIsNoOp
  ) {
    if (extras.length > 0) extras.push({ type: "separator" });
    const current = widgetSettingsAny.opacity as number;
    extras.push({
      type: "submenu",
      label: t("widgets.contextMenu.opacity"),
      icon: <OpacityIcon style={{ fontSize: 14 }} />,
      items: OPACITY_BLUR_PRESETS.map((v) => ({
        type: "radio" as const,
        label: `${v}%`,
        selected: current === v,
        onHover: demo({ opacity: v }),
        onClick: () =>
          updateWidgetSettings(storageKey, { opacity: v } as never),
      })),
    });
  }
  if (typeof widgetSettingsAny.blur === "number" && isFrost) {
    if (extras.length > 0) extras.push({ type: "separator" });
    const current = widgetSettingsAny.blur as number;
    extras.push({
      type: "submenu",
      label: t("widgets.contextMenu.blur"),
      icon: <BlurOnIcon style={{ fontSize: 14 }} />,
      items: OPACITY_BLUR_PRESETS.map((v) => ({
        type: "radio" as const,
        label: `${v}%`,
        selected: current === v,
        onHover: demo({ blur: v }),
        onClick: () =>
          updateWidgetSettings(storageKey, { blur: v } as never),
      })),
    });
  }

  if (mode === "dock") {
    // Background toggle is intentionally absent now — every dock
    // widget paints a uniform glass card via `.dock-widget` CSS so
    // the dock reads as one consistent design. The
    // `setWidgetShowBackground` setter is kept on the context so
    // stored values aren't broken, but the toggle no longer
    // surfaces here.
    void setWidgetShowBackground;

    // Dock layout: settings first (the primary reason to right-click
    // here), then a half/full width control (where allowed), then
    // Hide.
    //
    // Some widgets are locked to a specific size in the dock and
    // skip the half/full radio entirely:
    //   Todo/Info — content-dense, half-cell breaks them.
    //   Avatar   — small image tile, full-row reads as empty space.
    const FULL_WIDTH_ONLY: WidgetKey[] = ["todo", "info"];
    const HALF_WIDTH_ONLY: WidgetKey[] = ["avatar"];
    const allowHalf =
      !FULL_WIDTH_ONLY.includes(storageKey) &&
      !HALF_WIDTH_ONLY.includes(storageKey);
    const currentDockWidth = widgets[storageKey].dockWidth;
    const widthControls: ContextMenuItem[] = allowHalf
      ? [
          {
            type: "radio",
            label: t("widgets.contextMenu.dockWidthFull"),
            selected: currentDockWidth === "full",
            onClick: () => setWidgetDockWidth(storageKey, "full"),
          },
          {
            type: "radio",
            label: t("widgets.contextMenu.dockWidthHalf"),
            selected: currentDockWidth === "half",
            onClick: () => setWidgetDockWidth(storageKey, "half"),
          },
        ]
      : [];
    const dockHide: ContextMenuItem = {
      type: "action",
      label: t("widgets.contextMenu.hide", { name: widgetName }),
      onClick: () => setWidgetInRightSidebar(storageKey, false),
      icon: <VisibilityOffIcon style={{ fontSize: 14 }} />,
    };
    const out: ContextMenuItem[] = [];
    if (extras.length) {
      out.push(...extras, { type: "separator" });
    }
    if (widthControls.length) {
      out.push(...widthControls, { type: "separator" });
    }
    out.push(dockHide);
    return out;
  }
  return extras.length
    ? [...universal, { type: "separator" }, ...extras]
    : universal;
}
