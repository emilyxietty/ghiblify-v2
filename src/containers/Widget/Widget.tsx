import React, { ReactNode, useEffect, useRef, useState } from "react";
import EditWidget from "../../components/EditWidget/EditWidget";
import { getWidgetConfig } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import "./Widget.css";

interface WidgetProps {
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  storageKey?: string;
  onReset?: () => void;
  showDragHandle?: boolean;
}

export const Widget: React.FC<WidgetProps> = ({
  children,
  initialPosition = { x: 50, y: 50 },
  storageKey,
  onReset,
  showDragHandle,
}) => {
  const {
    showWidgetEdits,
    setIsDragging,
    updateAvatarSettings,
    updateTodoSettings,
    updateDateSettings,
    updateTimeSettings,
    updateInfoSettings,
    avatarSettings,
    todoSettings,
    dateSettings,
    timeSettings,
    infoSettings,
    widgetPositions,
    updateWidgetPosition,
    quicklinksSettings,
    updateQuicklinksSettings,
  } = useAppContext();
  const widgetConfig = getWidgetConfig(storageKey);

  const [position, setPosition] = useState(() => {
    if (!storageKey) return initialPosition;

    // Prefer positions already stored in context
    if (widgetPositions && widgetPositions[storageKey]) {
      return widgetPositions[storageKey];
    }
    return initialPosition;
  });

  const [localIsDragging, setLocalIsDragging] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
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

  // Update global context when local drag state changes
  useEffect(() => {
    setIsDragging(localIsDragging || isResizing);
  }, [localIsDragging, isResizing, setIsDragging]);

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
      if (isResizing && storageKey) {
        const baseKey = storageKey.replace(/_position$/, "");

        // Avatar: proportional square size
        if (widgetConfig?.size?.enabled) {
          const deltaY = e.clientY - resizeStartY;
          const sizeKey = `${baseKey}_size`;
          const { min, max, step } = widgetConfig.size;

          // Snap to step
          const stepsMoved = Math.round(deltaY / 20);
          const sizeChange = stepsMoved * step;
          const targetSize = resizeStartSize + sizeChange;
          const snappedSize = Math.round(targetSize / step) * step;
          const newSize = Math.max(min, Math.min(max, snappedSize));

          // If this is the avatar widget, update context so consumers using
          // `avatarSettings` (via useAppContext) update immediately and
          // persist via the updater.
          if (baseKey === "avatar" && updateAvatarSettings) {
            updateAvatarSettings({ size: newSize });
          }

          const eventName = `${baseKey}SettingsChange`;
          window.dispatchEvent(
            new CustomEvent(eventName, { detail: { size: newSize } })
          );
        } else if (
          widgetConfig?.width?.enabled ||
          widgetConfig?.height?.enabled
        ) {
          if (widgetConfig.width?.enabled) {
            const deltaX = e.clientX - resizeStartX;
            const widthKey = `${baseKey}_width`;
            const { min, max, step } = widgetConfig.width;

            const stepsMoved = Math.round(deltaX / 20);
            const widthChange = stepsMoved * step;
            const targetWidth = resizeStartWidth + widthChange;
            const snappedWidth = Math.round(targetWidth / step) * step;
            const newWidth = Math.max(min, Math.min(max, snappedWidth));

            // If this is the todo widget, update context so consumers using
            // `todoSettings` update immediately and persist via the updater.
            if (baseKey === "todo" && updateTodoSettings) {
              updateTodoSettings({ width: newWidth });
            }

            if (baseKey === "quicklinks" && updateQuicklinksSettings) {
              updateQuicklinksSettings({ width: newWidth });
            }

            const eventName = `${baseKey}SettingsChange`;
            window.dispatchEvent(
              new CustomEvent(eventName, { detail: { width: newWidth } })
            );
          }

          if (widgetConfig.height?.enabled) {
            const deltaY = e.clientY - resizeStartY;
            const heightKey = `${baseKey}_height`;
            const { min, max, step } = widgetConfig.height;

            const stepsMoved = Math.round(deltaY / 20);
            const heightChange = stepsMoved * step;
            const targetHeight = resizeStartHeight + heightChange;
            const snappedHeight = Math.round(targetHeight / step) * step;
            const newHeight = Math.max(min, Math.min(max, snappedHeight));

            if (baseKey === "todo" && updateTodoSettings) {
              updateTodoSettings({ height: newHeight });
            }

            if (baseKey === "quicklinks" && updateQuicklinksSettings) {
              updateQuicklinksSettings({ height: newHeight });
            }

            const eventName = `${baseKey}SettingsChange`;
            window.dispatchEvent(
              new CustomEvent(eventName, { detail: { height: newHeight } })
            );
          }
        } else if (widgetConfig?.fontSize?.enabled) {
          const deltaY = e.clientY - resizeStartY;
          const { min, max, step } = widgetConfig.fontSize;

          const stepsMoved = Math.round(deltaY / 20);
          const sizeChange = stepsMoved * (step ?? 1);
          const targetSize = resizeStartSize + sizeChange;
          const snappedSize =
            Math.round(targetSize / (step ?? 1)) * (step ?? 1);
          const newSize = Math.max(min ?? 1, Math.min(max ?? 1, snappedSize));

          if (baseKey === "date" && updateDateSettings) {
            updateDateSettings({ fontSize: newSize });
          }
          if (baseKey === "time" && updateTimeSettings) {
            updateTimeSettings({ fontSize: newSize });
          }
          if (baseKey === "info" && updateInfoSettings) {
            updateInfoSettings({ fontSize: newSize });
          }

          let detail: any = { fontSize: newSize };

          if (widgetConfig.customControls?.timeFormat) {
            detail.is24Hour = !!timeSettings?.is24Hour;
          }

          const eventName = `${baseKey}SettingsChange`;
          window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
      } else if (isMouseDown && widgetRef.current) {
        if (!hasMovedWhileMouseDown) {
          setHasMovedWhileMouseDown(true);
          setLocalIsDragging(true);
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
        setIsMouseDown(false);
        setHasMovedWhileMouseDown(false);
        setLocalIsDragging(false);
        setIsDragging(false);

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

    if (isMouseDown || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isMouseDown,
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
    updateAvatarSettings,
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
    if (e.button !== 0) return;
    if (isResizing) return;

    // Only start dragging when the user clicks on a header/drag-handle
    const target = e.target as HTMLElement | null;
    // If the child rendered its own header, require header-only drags.
    // However, treat clicks that land on the container itself (e.g. the
    // border/padding area) as valid drag starts so edges remain draggable.
    const current = e.currentTarget as HTMLElement | null;
    if (hasChildHeader && !showWidgetEdits) {
      // Normal mode: require clicks on the header or the container itself
      const clickedHeader =
        target && target.closest && target.closest(".widget-header");
      const clickedContainer = current && target === current;
      if (!clickedHeader && !clickedContainer) {
        return;
      }
    } else {
      // No child header: allow dragging from any non-interactive area.
      // Prevent starting a drag when clicking inputs, buttons, links, or
      // elements explicitly marked with `.no-drag`.
      const interactiveSelector =
        "input, button, textarea, select, a, [role=button], .no-drag";
      if (target && target.closest && target.closest(interactiveSelector)) {
        return;
      }
      // otherwise allow drag
    }

    // debug: log when the widget receives a mousedown so we can verify which
    // header areas let the event bubble up. Keep logs short and informative.
    // eslint-disable-next-line no-console
    try {
      const target = e.target as HTMLElement | null;
      // eslint-disable-next-line no-console
      console.debug("Widget.mousedown", {
        target:
          target &&
          target.tagName + (target.className ? `.${target.className}` : ""),
        hasChildHeader,
        isResizing,
        isMouseDown,
        isDragging: localIsDragging,
        clickedHeader:
          target && target.closest && Boolean(target.closest(".widget-header")),
      });
    } catch (err) {
      // ignore
    }

    e.preventDefault();
    e.stopPropagation();

    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      // For Y we store an offset to the top edge so subsequent mouse
      // moves compute a top-based position (since widget uses
      // translateY(0) / top-based positioning). For X we keep the
      // center-based offset so horizontal centering via translateX(-50%) still works.
      const top = rect.top;

      setDragOffset({
        x: centerX - e.clientX,
        y: top - e.clientY,
      });

      setIsMouseDown(true);
      setHasMovedWhileMouseDown(false);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    if (storageKey && widgetConfig) {
      const baseKey = storageKey.replace(/_position$/, "");

      if (widgetConfig.fontSize?.enabled) {
        let currentSize = widgetConfig.fontSize.default;
        if (baseKey === "date" && dateSettings?.fontSize !== undefined) {
          currentSize = dateSettings.fontSize;
        } else if (baseKey === "time" && timeSettings?.fontSize !== undefined) {
          currentSize = timeSettings.fontSize;
        } else if (baseKey === "info" && infoSettings?.fontSize !== undefined) {
          currentSize = infoSettings.fontSize;
        }
        setResizeStartSize(currentSize);
      } else if (widgetConfig.size?.enabled) {
        let currentSize = widgetConfig.size.default;
        if (baseKey === "avatar" && avatarSettings?.size !== undefined) {
          currentSize = avatarSettings.size;
        }
        setResizeStartSize(currentSize);
      } else if (widgetConfig.width?.enabled || widgetConfig.height?.enabled) {
        if (widgetConfig.width?.enabled) {
          let currentWidth = widgetConfig.width.default;
          if (baseKey === "todo" && todoSettings?.width !== undefined) {
            currentWidth = todoSettings.width;
          }
          setResizeStartWidth(currentWidth);
        }
        if (widgetConfig.height?.enabled) {
          let currentHeight = widgetConfig.height.default;
          if (baseKey === "todo" && todoSettings?.height !== undefined) {
            currentHeight = todoSettings.height;
          }
          setResizeStartHeight(currentHeight);
        }
      }

      setIsResizing(true);
      setResizeStartX(e.clientX);
      setResizeStartY(e.clientY);
      setIsDragging(true);
    }
  };

  const alignment = getAlignment();
  const fontSizeEnabled = widgetConfig?.fontSize?.enabled ?? false;
  const widthEnabled = widgetConfig?.width?.enabled ?? false;
  const heightEnabled = widgetConfig?.height?.enabled ?? false;
  const sizeEnabled = widgetConfig?.size?.enabled ?? false;
  const hasResizeHandle =
    fontSizeEnabled || sizeEnabled || widthEnabled || heightEnabled;

  return (
    <div
      ref={widgetRef}
      className={`widget ${localIsDragging ? "dragging" : ""} ${
        showWidgetEdits ? "edit-mode" : ""
      } ${isResizing ? "resizing" : ""} draggable widget-align-${alignment}`}
      style={{
        left: `${position.x}vw`,
        top: `${position.y}vh`,
        transform: getTransform(),
      }}
      onMouseDown={handleWidgetMouseDown}
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
        localIsDragging={localIsDragging}
        isResizing={isResizing}
        storageKey={storageKey}
      />
      {showWidgetEdits && hasResizeHandle && (
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
