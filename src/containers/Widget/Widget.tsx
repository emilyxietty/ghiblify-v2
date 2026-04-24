import React, { ReactNode, useEffect, useRef, useState } from "react";
import EditWidget from "../../components/EditWidget/EditWidget";
import { getWidgetConfig, WidgetKey } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import "./Widget.css";

interface WidgetProps {
  children: ReactNode;
  storageKey: WidgetKey;
}

export const Widget: React.FC<WidgetProps> = ({ children, storageKey }) => {
  const {
    showWidgetEdits,
    widgets,
    updateWidgetPosition,
    updateWidgetSettings,
    isDragging,
    setIsDragging,
  } = useAppContext();
  const widgetConfig = getWidgetConfig(storageKey);
  const widgetSettings = widgets[storageKey].settings as Record<string, unknown>;

  const [position, setPosition] = useState(() => widgets[storageKey].position);

  // Track context position changes (e.g. from a reset) so the local
  // drag-state doesn't get stuck on a stale value.
  useEffect(() => {
    setPosition(widgets[storageKey].position);
  }, [widgets, storageKey]);

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

  // Show widget outlines when Shift is held
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") {
        document.body.classList.add("show-widget-outline");
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") {
        document.body.classList.remove("show-widget-outline");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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

  const getTransform = () => {
    // Anchor horizontally centered but vertically anchored to the top
    // so changes in child height (collapse/expand) don't shift the
    // widget's top edge / header position.
    return "translate(-50%, 0)";
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
        const snap = (start: number, delta: number, b: { min: number; max: number; step: number }) => {
          const stepsMoved = Math.round(delta / 20);
          const target = start + stepsMoved * b.step;
          const snapped = Math.round(target / b.step) * b.step;
          return Math.max(b.min, Math.min(b.max, snapped));
        };

        if (widgetConfig.size) {
          const newSize = snap(resizeStartSize, e.clientY - resizeStartY, widgetConfig.size);
          updateWidgetSettings(storageKey, { size: newSize } as never);
        } else if (widgetConfig.width || widgetConfig.height) {
          const patch: Record<string, number> = {};
          if (widgetConfig.width) {
            patch.width = snap(resizeStartWidth, e.clientX - resizeStartX, widgetConfig.width);
          }
          if (widgetConfig.height) {
            patch.height = snap(resizeStartHeight, e.clientY - resizeStartY, widgetConfig.height);
          }
          updateWidgetSettings(storageKey, patch as never);
        } else if (widgetConfig.fontSize) {
          const newSize = snap(resizeStartSize, e.clientY - resizeStartY, widgetConfig.fontSize);
          updateWidgetSettings(storageKey, { fontSize: newSize } as never);
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
    // Shift + left-click is the explicit drag opt-in. Holding shift means the
    // user wants to move the widget, so don't bail on interactive children
    // (buttons, inputs) — that was the source of inconsistent drag behavior
    // in edit mode where overlay controls cover most of the widget surface.
    if (e.button !== 0 || !e.shiftKey) return;
    if (isResizing) return;

    // Don't hijack drags that originated on the resize handle.
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".widget-resize-handle")) return;

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

    if (widgetConfig.fontSize) {
      setResizeStartSize(Number(widgetSettings.fontSize) || 0);
    } else if (widgetConfig.size) {
      setResizeStartSize(Number(widgetSettings.size) || 0);
    } else {
      if (widgetConfig.width)
        setResizeStartWidth(Number(widgetSettings.width) || 0);
      if (widgetConfig.height)
        setResizeStartHeight(Number(widgetSettings.height) || 0);
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

  return (
    <div
      ref={widgetRef}
      className={`widget ${isDragging ? "dragging" : ""} ${
        showWidgetEdits ? "edit-mode" : ""
      } ${isResizing ? "resizing" : ""} draggable widget-align-${alignment}`}
      style={{
        left: `${position.x}vw`,
        top: `${position.y}vh`,
        transform: getTransform(),
      }}
      onMouseDown={handleWidgetMouseDown}
      onContextMenu={(e) => {
        // Prevent default context menu
        e.preventDefault();
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
      <EditWidget
        showWidgetEdits={showWidgetEdits}
        isResizing={isResizing}
        storageKey={storageKey}
      />
      {showWidgetEdits &&
        hasResizeHandle &&
        !(isQuicklinks && !widgets.quicklinks.settings.gridMode) && (
          <div
            ref={resizeHandleRef}
            className="widget-resize-handle"
            onMouseDown={handleResizeMouseDown}
            title="Drag to resize"
          ></div>
        )}
      <div className="widget-content">{children}</div>
    </div>
  );
};
