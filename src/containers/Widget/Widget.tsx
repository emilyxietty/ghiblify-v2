import React, { ReactNode, useEffect, useRef, useState } from "react";
import EditWidget from "../../components/EditWidget/EditWidget";
import { useAppContext } from "../../contexts/AppContext";
import { getWidgetConfig } from "../../types/widgetConfig";
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
  const { showWidgetEdits, setIsDragging } = useAppContext();
  const widgetConfig = getWidgetConfig(storageKey);

  const [position, setPosition] = useState(() => {
    if (!storageKey) return initialPosition;

    const savedX = localStorage.getItem(`${storageKey}_x`);
    const savedY = localStorage.getItem(`${storageKey}_y`);

    if (savedX && savedY) {
      return {
        x: parseFloat(savedX),
        y: parseFloat(savedY),
      };
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
    return "translate(-50%, -50%)";
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

          localStorage.setItem(sizeKey, newSize.toString());

          const eventName = `${baseKey}SettingsChange`;
          window.dispatchEvent(
            new CustomEvent(eventName, { detail: { size: newSize } })
          );
        }
        // Todo: width (and/or height) with step
        else if (
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

            localStorage.setItem(widthKey, newWidth.toString());

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

            localStorage.setItem(heightKey, newHeight.toString());

            const eventName = `${baseKey}SettingsChange`;
            window.dispatchEvent(
              new CustomEvent(eventName, { detail: { height: newHeight } })
            );
          }
        }
        // Handle font size resizing
        else if (widgetConfig?.fontSize?.enabled) {
          const deltaY = e.clientY - resizeStartY;
          const fontSizeKey = `${baseKey}_fontSize`;
          const { min, max, step } = widgetConfig.fontSize;

          const stepsMoved = Math.round(deltaY / 20);
          const sizeChange = stepsMoved * (step ?? 1);
          const targetSize = resizeStartSize + sizeChange;
          const snappedSize =
            Math.round(targetSize / (step ?? 1)) * (step ?? 1);
          const newSize = Math.max(min ?? 1, Math.min(max ?? 1, snappedSize));

          localStorage.setItem(fontSizeKey, newSize.toString());

          let detail: any = { fontSize: newSize };

          if (widgetConfig.customControls?.timeFormat) {
            const is24Hour = localStorage.getItem("time_is24Hour") === "true";
            detail.is24Hour = is24Hour;
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

        const centerX = e.clientX + dragOffset.x;
        const centerY = e.clientY + dragOffset.y;

        const newPosition = {
          x: (centerX / window.innerWidth) * 100,
          y: (centerY / window.innerHeight) * 100,
        };

        const snappedPosition = snapToGrid(newPosition.x, newPosition.y);
        setPosition(snappedPosition);
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

        if (storageKey && hasMovedWhileMouseDown) {
          localStorage.setItem(`${storageKey}_x`, position.x.toString());
          localStorage.setItem(`${storageKey}_y`, position.y.toString());
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
    hasMovedWhileMouseDown,
  ]);

  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isResizing) return;

    e.preventDefault();
    e.stopPropagation();

    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      setDragOffset({
        x: centerX - e.clientX,
        y: centerY - e.clientY,
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
        const fontSizeKey = `${baseKey}_fontSize`;
        const currentSize = parseInt(
          localStorage.getItem(fontSizeKey) ||
            widgetConfig.fontSize.default.toString()
        );
        setResizeStartSize(currentSize);
      } else if (widgetConfig.size?.enabled) {
        const sizeKey = `${baseKey}_size`;
        const currentSize = parseInt(
          localStorage.getItem(sizeKey) || widgetConfig.size.default.toString()
        );
        setResizeStartSize(currentSize);
      } else if (widgetConfig.width?.enabled || widgetConfig.height?.enabled) {
        if (widgetConfig.width?.enabled) {
          const widthKey = `${baseKey}_width`;
          const currentWidth = parseInt(
            localStorage.getItem(widthKey) ||
              widgetConfig.width.default.toString()
          );
          setResizeStartWidth(currentWidth);
        }
        if (widgetConfig.height?.enabled) {
          const heightKey = `${baseKey}_height`;
          const currentHeight = parseInt(
            localStorage.getItem(heightKey) ||
              widgetConfig.height.default.toString()
          );
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
