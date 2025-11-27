import { useEffect, useRef, useState } from "react";

export function useWidget({
  initialPosition = { x: 50, y: 50 },
  storageKey,
  widgetConfig,
  widgetPositions,
  updateWidgetPosition,
  contextSettings,
  contextUpdaters,
  quicklinksSettings,
  updateQuicklinksSettings,
  searchbarSettings,
  updateSearchbarSettings,
  setIsDragging,
}) {
  const [position, setPosition] = useState(() => {
    if (!storageKey) return initialPosition;
    if (widgetPositions && widgetPositions[storageKey]) {
      return widgetPositions[storageKey];
    }
    return initialPosition;
  });

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
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Alignment logic
  const getAlignment = () => {
    if (position.x <= 30) return "left";
    if (position.x >= 70) return "right";
    return "center";
  };

  // Snap logic
  const snapToGrid = (centerX: number, centerY: number) => {
    const snapThreshold = 2;
    const snapLines = [2, 50, 98];
    if (!widgetRef.current) return { x: centerX, y: centerY };
    const rect = widgetRef.current.getBoundingClientRect();
    const widthVw = (rect.width / window.innerWidth) * 100;
    const heightVh = (rect.height / window.innerHeight) * 100;
    const snapX = (cx: number) => {
      const leftEdge = cx - widthVw / 2;
      const rightEdge = cx + widthVw / 2;
      for (const snapLine of snapLines) {
        if (Math.abs(leftEdge - snapLine) < snapThreshold)
          return snapLine + widthVw / 2;
        if (Math.abs(cx - snapLine) < snapThreshold) return snapLine;
        if (Math.abs(rightEdge - snapLine) < snapThreshold)
          return snapLine - widthVw / 2;
      }
      return cx;
    };
    const snapY = (cy: number) => {
      const topEdge = cy - heightVh / 2;
      const bottomEdge = cy + heightVh / 2;
      for (const snapLine of snapLines) {
        if (Math.abs(topEdge - snapLine) < snapThreshold)
          return snapLine + heightVh / 2;
        if (Math.abs(cy - snapLine) < snapThreshold) return snapLine;
        if (Math.abs(bottomEdge - snapLine) < snapThreshold)
          return snapLine - heightVh / 2;
      }
      return cy;
    };
    let constrainedX = snapX(centerX);
    let constrainedY = snapY(centerY);
    const minX = widthVw / 2;
    const maxX = 100 - widthVw / 2;
    const minY = heightVh / 2;
    const maxY = 100 - heightVh / 2;
    constrainedX = Math.max(minX, Math.min(maxX, constrainedX));
    constrainedY = Math.max(minY, Math.min(maxY, constrainedY));
    return { x: constrainedX, y: constrainedY };
  };

  // Drag and resize event handlers
  useEffect(() => {
    setIsDragging(isResizing);
  }, [isResizing, setIsDragging]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Drag logic
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
      // Resize logic (similar to Widget.tsx)
      // ...existing resize logic can be moved here...
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
        if (storageKey && hasMovedWhileMouseDown && updateWidgetPosition) {
          updateWidgetPosition(storageKey, position);
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
    updateWidgetPosition,
    hasMovedWhileMouseDown,
  ]);

  // Mouse down handlers
  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !e.shiftKey) return;
    if (isResizing) return;
    e.preventDefault();
    const target = e.target as HTMLElement | null;
    const interactiveSelector =
      "input, button, textarea, select, a, [role=button], .no-drag";
    if (target?.closest?.(interactiveSelector)) return;
    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const top = rect.top;
      setDragOffset({ x: centerX - e.clientX, y: top - e.clientY });
      setIsMouseDown(true);
      setHasMovedWhileMouseDown(false);
      setDragButton(e.button);
    }
  };

  // Resize mouse down handler
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // ...existing resize logic can be moved here...
    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartY(e.clientY);
    setIsDragging(true);
  };

  return {
    position,
    setPosition,
    widgetRef,
    resizeHandleRef,
    isMouseDown,
    isResizing,
    dragButton,
    dragOffset,
    hasMovedWhileMouseDown,
    resizeStartX,
    resizeStartY,
    resizeStartSize,
    resizeStartWidth,
    resizeStartHeight,
    getAlignment,
    snapToGrid,
    handleWidgetMouseDown,
    handleResizeMouseDown,
    setResizeStartSize,
    setResizeStartWidth,
    setResizeStartHeight,
    setIsResizing,
    setIsMouseDown,
    setDragButton,
    setDragOffset,
    setHasMovedWhileMouseDown,
    setResizeStartX,
    setResizeStartY,
    setIsDragging,
  };
}
