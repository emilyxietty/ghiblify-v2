import React, { ReactNode, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditIcon } from "../../components/Icons/Icons";
import { RemoveIcon } from "../../components/Icons/Icons";
// Lazy - every widget mounts an EditWidget but only the one currently
// being edited actually renders content. Gating on `isEditingThis`
// below means the chunk only fetches the first time any widget enters
// edit mode.
const EditWidget = lazy(() => import("../../components/RightClickEditModal/EditWidget/EditWidget"));
import { isTypeInUnavailable } from "../../config/widgetConfig";
import { getWidgetConfig, WidgetKey } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { getWidgetSurfacePresentation } from "../../utils/widgetSurfacePresentation";
import { toReferencePx, toScreenPx } from "../../utils/viewportScale";
import { bringWidgetToFront, useWidgetZIndex } from "../../utils/widgetStack";
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
  // render (Rules of Hooks) - otherwise toggling visibility off (which
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
  } = useAppContext();
  const t = useT();
  // The widget is "in edit mode" if either the global edit toggle is on,
  // or this specific widget was singled out via the D+pencil button.
  const isEditingThis = showWidgetEdits || editingWidgetKey === storageKey;
  const widgetConfig = getWidgetConfig(storageKey);
  const widgetSettings = widgets[storageKey].settings as unknown as Record<string, unknown>;
  const [position, setPosition] = useState(() => widgets[storageKey].position);
  // Bounded click-to-front stacking - see utils/widgetStack.ts.
  const zIndex = useWidgetZIndex(storageKey);

  useLayoutEffect(() => {
    if (widgetSettings.typeIn !== true) return;
    const text = widgetRef.current?.textContent?.trim() ?? "";
    if (text.length) setTypeSteps(Math.min(60, Math.max(6, text.length)));
    // Only when the toggle flips: the effect deliberately doesn't watch
    // the text, so a ticking clock doesn't retype itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetSettings.typeIn, storageKey]);

  // Replay the CSS type-in when its pace changes. Only the animation's
  // duration changes, and a running or finished CSS animation doesn't
  // restart for that - so the class comes off, a reflow is forced, and
  // it goes back on (the standard restart). Done on the DOM directly:
  // React's next render writes the same className and leaves it be.
  // Info drives its own reveal in JS and replays itself. Skipped on
  // mount so a fresh tab types once, not twice.
  const typeInSpeed = widgetSettings.typeInSpeed;
  const typeInSpeedSeen = useRef(typeInSpeed);
  useLayoutEffect(() => {
    if (typeInSpeedSeen.current === typeInSpeed) return;
    typeInSpeedSeen.current = typeInSpeed;
    const el = widgetRef.current;
    if (!el || widgetSettings.typeIn !== true) return;
    if (!el.classList.contains("has-type-in")) return;
    el.classList.remove("has-type-in");
    void el.offsetWidth;
    el.classList.add("has-type-in");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeInSpeed]);

  // Track context position changes (e.g. from a reset) so the local
  // drag-state doesn't get stuck on a stale value.
  useEffect(() => {
    setPosition(widgets[storageKey].position);
  }, [widgets, storageKey]);

  // Character count for the type-in reveal. Measured from the rendered
  // text rather than guessed: `steps()` has to match the number of
  // characters or the reveal lands mid-glyph and reads as a wipe
  // instead of typing. Measured once - re-measuring as the clock ticks
  // would restart the animation every second.
  const [typeSteps, setTypeSteps] = useState(24);


  // Hidden native colour input - the context menu's "custom colour"
  // row clicks it to open the OS palette directly.



  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragButton, setDragButton] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const hasMovedWhileMouseDownRef = useRef(false);
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

  // Skipped while typing so entering text cannot enable drag.
  useEffect(() => {
    let held = false;
    const apply = () => {
      document.body.classList.toggle("show-widget-outline", held);
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
        // Plain 'd' only - combos (Cmd+D bookmark, etc.) shouldn't
        // trigger drag.
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        held = true;
        apply();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "d" || e.key === "D") {
        held = false;
        apply();
      }
    }
    function clearAll() {
      held = false;
      apply();
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearAll);
    document.addEventListener("visibilitychange", clearAll);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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

  // Runtime overflow nudge - measures the widget's actual rendered
  // bounds and computes a corrective offset that keeps it inside the
  // viewport. Storage position is left alone (the user's intent is
  // preserved); only the rendered offset adjusts. The offset is
  // recomputed from the widget's NATURAL position (rect minus the
  // current offset) every measurement, so it shrinks back to zero
  // when the viewport expands and the widget no longer overflows -
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
      // Direct set, not additive - converges in one render and
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
    // baked in via calc() - keeps the widget inside the viewport on
    // small screens without rewriting the user's stored position.
    return `translate(calc(-50% + ${overflowOffset.x}px), ${overflowOffset.y}px)`;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only track drag if mouse is down and dragButton is 0.
      if (isMouseDown && dragButton === 0 && widgetRef.current) {
        if (!hasMovedWhileMouseDownRef.current) {
          hasMovedWhileMouseDownRef.current = true;
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

      // Resize logic - translate the bound that's enabled into a settings patch.
      if (isResizing && storageKey) {
        // Snap operates in screen-px (start / delta / bounds all in
        // current-viewport pixels) so the drag feel stays uniform
        // across viewports. We convert the widget config's
        // reference-px bounds to screen-px here, snap, then convert
        // the result back to reference-px before persisting.
        const screenBound = (b: { min: number; max: number; step: number }) => ({
          min: toScreenPx(b.min),
          max: toScreenPx(b.max),
          // Step in screen-px is the reference step scaled - but we
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
          // squareLock - width and height stay tied. Take the larger
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
        if (!hasMovedWhileMouseDownRef.current) {
          hasMovedWhileMouseDownRef.current = true;
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

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        setIsDragging(false);
      }
      if (isMouseDown) {
        const didMove = hasMovedWhileMouseDownRef.current;
        hasMovedWhileMouseDownRef.current = false;
        setIsMouseDown(false);
        setIsDragging(false);
        setDragButton(null);

        // If the user moved the widget while the mouse was down, persist
        // the new position and mark this widget as "just dragged" so child
        // header click handlers can ignore the immediate click that follows
        // the drag end (prevents accidental toggles).
        if (storageKey && didMove && updateWidgetPosition) {
          updateWidgetPosition(storageKey, position);
        }

        if (didMove && widgetRef.current) {
          try {
            widgetRef.current.dataset.justDragged = "true";
            window.setTimeout(() => {
              if (widgetRef.current)
                delete widgetRef.current.dataset.justDragged;
            }, 200);
          } catch (err) {
            // ignore
          }
          // Suppress only the immediate click that follows a drag. Its
          // target can be outside the widget after the widget has moved,
          // so target containment is not a reliable signal here.
          try {
            let timeoutId: number | null = null;
            const suppressClick = (ev: MouseEvent) => {
              ev.stopImmediatePropagation();
              ev.preventDefault();
              if (timeoutId !== null) window.clearTimeout(timeoutId);
              document.removeEventListener("click", suppressClick, true);
            };
            document.addEventListener("click", suppressClick, true);
            timeoutId = window.setTimeout(() => {
              document.removeEventListener("click", suppressClick, true);
            }, 250);
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

  /**
   * Did this event actually happen inside the widget's own box?
   *
   * React replays events from a portal up the COMPONENT tree, not the
   * DOM tree - so a dialog a widget renders through `createPortal`
   * (the weather location picker, a context menu) delivers its
   * mousedowns and right-clicks to this shell even though it paints
   * over on `<body>`. In edit mode the whole shell is the drag
   * surface, which meant selecting text or clicking into a field in
   * one of those dialogs dragged the widget around behind it, and
   * dragging preventDefaults the mousedown, so inputs never took
   * focus at all.
   *
   * The edit panel is exempt from the same problem for a different
   * reason: it's `position: fixed` but still a DOM descendant, so it
   * passes this test and needs its own check further down.
   */
  const isInsideWidget = (e: React.SyntheticEvent) =>
    e.target instanceof Node && !!widgetRef.current?.contains(e.target);

  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    if (!isInsideWidget(e)) return;
    // Any press (left click, drag start, right-click for the context
    // menu) surfaces this widget above its siblings - before the drag
    // gating below, which returns early for plain clicks.
    bringWidgetToFront(storageKey);
    // Two ways to opt into widget dragging:
    //   1. Hold D + left-click. The keydown/keyup effect
    //      above keeps `body.show-widget-outline` in sync with the
    //      held state, so reading the class is the cheapest
    //      authoritative check at click time.
    //   2. The widget is in edit mode - then the whole shell is the
    //      drag surface. This replaced a grab-handle tab: the handle
    //      had to hang outside the widget, which put it off-screen (or
    //      inside the left sidebar's hover strip) for left-parked
    //      widgets, and every fallback position collided with
    //      something else. The content is already dimmed and inert
    //      under the edit overlay, so there's nothing to conflict
    //      with.
    if (e.button !== 0) return;
    // `show-widget-outline` is present while D is held.
    const dragKeyHeld = document.body.classList.contains(
      "show-widget-outline",
    );
    const target = e.target as HTMLElement | null;
    // The settings panel is a DOM descendant of the widget (it's
    // `position: fixed`, but still inside), so without this every
    // click on a slider or swatch would start a drag instead.
    if (target?.closest?.(".edit-panel")) return;
    if (!dragKeyHeld && !isEditingThis) return;
    if (isResizing) return;

    // Don't hijack mousedowns that originated on the resize handle or
    // the quick-edit button - those have their own click handlers and
    // the drag flow swallows the click.
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
      hasMovedWhileMouseDownRef.current = false;
      setDragButton(e.button);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Storage is reference-px; the drag handler does math in
    // screen-px (so the drag feel stays consistent across viewports -
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

  // Safe to early-return now - all hooks above have already run.
  if (!shouldRender) return null;

  const surfacePresentation = getWidgetSurfacePresentation({
    storageKey,
    settings: widgetSettings,
    allowTypeIn: !isTypeInUnavailable(storageKey, widgetSettings),
    typeSteps,
  });

  return (
    <div
      ref={widgetRef}
      className={`widget ${isDragging ? "dragging" : ""} ${
        isEditingThis ? "edit-mode" : ""
      } ${isResizing ? "resizing" : ""} ${
        isFadingOut ? "fade-out" : ""
      } draggable widget-align-${alignment}${
        surfacePresentation.className
          ? ` ${surfacePresentation.className}`
          : ""
      }`}
      data-widget-key={storageKey}
      data-guide-right-click={t(
        "welcome.slides.adjustTime.rightClickWidgetCue",
      )}
      data-guide-drag={t("welcome.slides.drag.dragCue")}
      style={{
        left: `${position.x}vw`,
        top: `${position.y}vh`,
        zIndex,
        transform: getTransform(),
        // The shell adopts its content's font size so em-based tokens
        // (--text-highlight-radius: the corner-style-aware pill
        // rounding) resolve against the TEXT scale, not the 16px base.
        // Safe: every fontSize-bearing widget sets its own inline
        // font-size below the shell, so nothing inherits this.
        ...(typeof widgetSettings.fontSize === "number"
          ? { fontSize: `${toScreenPx(widgetSettings.fontSize)}px` }
          : {}),
        ...surfacePresentation.style,
      }}
      onMouseDown={handleWidgetMouseDown}
      onContextMenu={(e) => {
        // Same portal caveat as the mousedown handler: a right-click
        // inside a dialog this widget portalled out would otherwise
        // open the widget's own context menu on top of it.
        if (!isInsideWidget(e)) return;
        // Let the browser's native context menu (copy / cut / paste /
        // spell-check / undo) fire when the right-click is inside a
        // text input, textarea, or any contentEditable element -
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
        setEditingWidgetKey(storageKey);
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
            title={t("widgets.edit.resizeTitle", {
              name: t(`widgets.names.${storageKey}`),
            })}
            data-tooltip={t("widgets.edit.resizeTitle", {
              name: t(`widgets.names.${storageKey}`),
            })}
            // Guide cue. The drag slide teaches move AND resize, but
            // only move had a label - the grip just pulsed, which
            // shows you where to look without saying what to do. The
            // pill is drawn from this attribute (see WelcomeModal.css).
            data-guide-resize={t("welcome.slides.drag.resizeCue")}
          >
            {/* The guide's hand cursor, mirroring the one the same
                slide puts at the widget's top-left for dragging. It
                needs a real element: the handle's ::before is the grip
                and ::after is the label pill, so no pseudo-element is
                free, and a background on the handle itself would clip
                a cursor that has to overhang the corner. Inert and
                invisible outside the tutorial. */}
            <span className="widget-resize-guide-cursor" aria-hidden="true" />
          </div>
        )}
      {/* Quick controls - only visible while D is held
          and the widget isn't already in edit mode. The pencil at top-
          right jumps straight into editing this widget; the minus at
          top-left hides the widget without opening any menu. CSS class
          .show-widget-outline (toggled by the D-key effect above)
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
    </div>
  );
};
