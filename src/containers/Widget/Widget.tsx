import React, { ReactNode, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditIcon, OpenWithIcon } from "../../components/Icons/Icons";
import { CenterFocusStrongIcon, FaceIcon, PlaceIcon, RemoveIcon, VisibilityOffIcon } from "../../components/Icons/Icons";
import {
  ContextMenu,
  ContextMenuItem,
} from "../../components/ContextMenu/ContextMenu";
// Lazy — every widget mounts an EditWidget but only the one currently
// being edited actually renders content. Gating on `isEditingThis`
// below means the chunk only fetches the first time any widget enters
// edit mode.
const EditWidget = lazy(() => import("../../components/EditWidget/EditWidget"));
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
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
  } = useAppContext();
  const t = useT();
  // The widget is "in edit mode" if either the global edit toggle is on,
  // or this specific widget was singled out via the Shift+pencil button.
  const isEditingThis = showWidgetEdits || editingWidgetKey === storageKey;
  const widgetConfig = getWidgetConfig(storageKey);
  const widgetSettings = widgets[storageKey].settings as Record<string, unknown>;

  const [position, setPosition] = useState(() => widgets[storageKey].position);

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

  return (
    <div
      ref={widgetRef}
      className={`widget ${isDragging ? "dragging" : ""} ${
        isEditingThis ? "edit-mode" : ""
      } ${isResizing ? "resizing" : ""} ${
        isFadingOut ? "fade-out" : ""
      } draggable widget-align-${alignment}`}
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
            widgets,
            t,
            setEditingWidgetKey,
            toggleWidgetVisibility,
            updateWidgetSettings,
            setWidgetInRightSidebar,
            setWidgetDockWidth,
            setWidgetShowBackground,
            setDragMode,
            isFrost: appearance.theme === "frost",
          })}
        />
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
  } = args;

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
    extras = [
      {
        type: "radio",
        label: t("widgets.contextMenu.time12"),
        selected: !s.is24Hour,
        onClick: () => updateWidgetSettings("time", { is24Hour: false }),
      },
      {
        type: "radio",
        label: t("widgets.contextMenu.time24"),
        selected: !!s.is24Hour,
        onClick: () => updateWidgetSettings("time", { is24Hour: true }),
      },
    ];
  } else if (storageKey === "quicklinks") {
    const s = widgets.quicklinks.settings as QuicklinksSettings;
    extras = [
      {
        type: "action",
        label: t("widgets.contextMenu.addLink"),
        onClick: () =>
          window.dispatchEvent(new CustomEvent("ghiblify:quicklinks:add")),
      },
      { type: "separator" },
      {
        type: "radio",
        label: t("widgets.edit.gridShow"),
        selected: !!s.gridMode,
        onClick: () => updateWidgetSettings("quicklinks", { gridMode: true }),
      },
      {
        type: "radio",
        label: t("widgets.edit.gridShowList"),
        selected: !s.gridMode,
        onClick: () =>
          updateWidgetSettings("quicklinks", { gridMode: false }),
      },
    ];
  } else if (storageKey === "weather") {
    const s = widgets.weather.settings as WeatherSettings;
    // Half-width dock cells aren't wide enough for the hourly /
    // daily forecast strips, so hide those toggles entirely there
    // — only "Now" stays selectable. The Weather component also
    // forces those sections off at render time as a safety net.
    const isHalfDock =
      mode === "dock" && widgets.weather.dockWidth === "half";
    const sectionKeys = isHalfDock
      ? (["now"] as const)
      : (["now", "hourly", "daily"] as const);
    const onlyOneOn =
      sectionKeys.filter((k) => s.sections[k]).length <= 1;

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

    extras = [
      ...(locationLabel
        ? ([
            {
              type: "info" as const,
              label: locationLabel,
              icon: <PlaceIcon style={{ fontSize: 14 }} />,
            },
            { type: "separator" as const },
          ] as ContextMenuItem[])
        : []),
      // Unit submenu — mirrors the EditWidget dropdown so both
       // surfaces expose Celsius / Fahrenheit as direct radio picks.
       // Was two top-level radios; collapsing into a single cascade
       // entry keeps the root menu tidier next to Icon style.
       {
         type: "submenu",
         label: t("widgets.edit.weatherUnitLabel"),
         items: (["C", "F"] as const).map((v) => ({
           type: "radio" as const,
           label: t(`widgets.edit.weatherUnit${v}`),
           selected: s.unit === v,
           onClick: () => updateWidgetSettings("weather", { unit: v }),
         })),
       },
      {
        type: "submenu",
        label: t("widgets.edit.weatherSectionsLabel"),
        items: sectionKeys.map((k) => ({
          type: "checkbox" as const,
          label: t(`widgets.edit.weatherSections.${k}`),
          checked: !!s.sections[k],
          // Keep the min-one-selected rule from EditWidget — disable
          // the lone enabled option so it can't be turned off.
          disabled: onlyOneOn && !!s.sections[k],
          onClick: () => {
            const next = { ...s.sections, [k]: !s.sections[k] };
            const remaining = sectionKeys.filter((sk) => next[sk]).length;
            if (remaining === 0) return;
            updateWidgetSettings("weather", { sections: next });
          },
        })),
      },
      {
        type: "checkbox",
        label: t("widgets.edit.weatherShowCardLabel"),
        checked: !!s.showCard,
        onClick: () =>
          updateWidgetSettings("weather", { showCard: !s.showCard }),
      },
      {
        type: "checkbox",
        label: t("widgets.edit.weatherIconsOnly"),
        checked: !!s.iconsOnly,
        onClick: () =>
          updateWidgetSettings("weather", { iconsOnly: !s.iconsOnly }),
      },
      // Icon style submenu — mirrors the EditWidget Dropdown so both
      // surfaces expose the same Animated / Still pair as direct
      // radio picks (rather than a click-to-flip toggle).
      {
        type: "submenu",
        label: t("widgets.edit.weatherIconStyleLabel"),
        items: (["animated", "still"] as const).map((v) => ({
          type: "radio" as const,
          label: t(`widgets.edit.weatherIconStyle.${v}`),
          selected: s.iconStyle === v,
          onClick: () => updateWidgetSettings("weather", { iconStyle: v }),
        })),
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
      {
        type: "radio",
        label: t("widgets.contextMenu.pomodoroSizeSmall"),
        selected: currentSize === "small",
        onClick: () =>
          updateWidgetSettings("pomodoro", { size: "small" } as never),
      },
      {
        type: "radio",
        label: t("widgets.contextMenu.pomodoroSizeMedium"),
        selected: currentSize === "medium",
        onClick: () =>
          updateWidgetSettings("pomodoro", { size: "medium" } as never),
      },
      {
        type: "radio",
        label: t("widgets.contextMenu.pomodoroSizeLarge"),
        selected: currentSize === "large",
        onClick: () =>
          updateWidgetSettings("pomodoro", { size: "large" } as never),
      },
    ];
  } else if (storageKey === "info") {
    const s = widgets.info.settings as InfoSettings;
    const onlyOneOn =
      INFO_FIELD_KEYS.filter((k) => s.infoFields[k]).length <= 1;
    extras = [
      {
        type: "submenu",
        label: t("widgets.edit.infoFieldsLabel"),
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
  if (typeof widgetSettingsAny.textShadow === "number") {
    if (extras.length > 0) extras.push({ type: "separator" });
    const current = widgetSettingsAny.textShadow as number;
    extras.push({
      type: "submenu",
      label: t("widgets.contextMenu.textShadow"),
      items: [0, 50, 100, 150, 200].map((v) => ({
        type: "radio" as const,
        label: `${v}%`,
        selected: current === v,
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
  const weatherOpacityIsNoOp =
    storageKey === "weather" &&
    !((widgets.weather.settings as WeatherSettings).sections.hourly) &&
    !((widgets.weather.settings as WeatherSettings).sections.daily);
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
      items: OPACITY_BLUR_PRESETS.map((v) => ({
        type: "radio" as const,
        label: `${v}%`,
        selected: current === v,
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
      items: OPACITY_BLUR_PRESETS.map((v) => ({
        type: "radio" as const,
        label: `${v}%`,
        selected: current === v,
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
