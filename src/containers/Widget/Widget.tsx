import React, { ReactNode, useEffect, useRef, useState } from "react";
import { EditWidget } from "../../components/EditWidget/EditWidget";
import "./Widget.css";

interface WidgetProps {
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  storageKey?: string;
  showDragHandle?: boolean;
  onReset?: () => void;
  editComponent?: ReactNode;
}

export const Widget: React.FC<WidgetProps> = ({
  children,
  initialPosition = { x: 50, y: 50 },
  storageKey,
  showDragHandle = false,
  onReset,
  editComponent,
}) => {
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

  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

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

    return {
      x: snapX(centerX),
      y: snapY(centerY),
    };
  };

  const getTransform = () => {
    return "translate(-50%, -50%)";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && widgetRef.current) {
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
      if (isDragging) {
        setIsDragging(false);

        if (storageKey) {
          localStorage.setItem(`${storageKey}_x`, position.x.toString());
          localStorage.setItem(`${storageKey}_y`, position.y.toString());
          console.log("Position saved (vw/vh):", position);
        }
      }
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, storageKey, position]);

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
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
      setIsDragging(true);
    }
  };

  const toggleEdit = () => {
    setIsEditOpen(!isEditOpen);
  };

  return (
    <>
      {isDragging && <div className="grid-overlay" />}
      <div
        ref={widgetRef}
        className="widget"
        style={{
          left: `${position.x}vw`,
          top: `${position.y}vh`,
          transform: getTransform(),
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="widget-content">{children}</div>
        {(showDragHandle || isHovered) && (
          <>
            {editComponent && (
              <button className="edit-button" onClick={toggleEdit}>
                ✎
              </button>
            )}
            <div
              className="drag-handle"
              onMouseDown={handleDragHandleMouseDown}
            >
              ⋮⋮
            </div>
          </>
        )}
      </div>

      {editComponent && (
        <EditWidget
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          previewComponent={children}
        >
          {editComponent}
        </EditWidget>
      )}
    </>
  );
};
