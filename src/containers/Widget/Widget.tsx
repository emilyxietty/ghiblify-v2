import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { AvatarSelector } from "../../components/AvatarSelector/AvatarSelector";
import { FieldSelector } from "../../components/FieldSelector/FieldSelector";
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

const INFO_FIELD_OPTIONS = [
  { value: "japaneseTitle", label: "Japanese Title" },
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
  { value: "movieLength", label: "Movie Length" },
  { value: "quote", label: "Quote" },
];

export const Widget: React.FC<WidgetProps> = ({
  children,
  initialPosition = { x: 50, y: 50 },
  storageKey,
  onReset,
  showDragHandle,
}) => {
  const { showWidgetEdits, setIsDragging, updateInfoFields } = useAppContext();
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
  const [is24Hour, setIs24Hour] = useState(() => {
    return localStorage.getItem("time_is24Hour") === "true";
  });
  const [selectedInfoFields, setSelectedInfoFields] = useState<string[]>(() => {
    const saved = localStorage.getItem("info_selectedFields");
    return saved
      ? JSON.parse(saved)
      : ["japaneseTitle", "title", "year", "movieLength", "quote"];
  });
  const [selectedAvatar, setSelectedAvatar] = useState<string>(() => {
    return localStorage.getItem("avatar_selected") || "totoro";
  });
  const widgetRef = useRef<HTMLDivElement>(null);

  // Update global context when local drag state changes
  useEffect(() => {
    setIsDragging(localIsDragging);
  }, [localIsDragging, setIsDragging]);

  // Determine alignment based on position
  const getAlignment = () => {
    if (position.x <= 30) {
      return "left";
    } else if (position.x >= 70) {
      return "right";
    }
    return "center";
  };

  // Get widget name from config
  const getWidgetName = () => {
    return widgetConfig?.name || "Widget";
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
      if (isMouseDown && widgetRef.current) {
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

    if (isMouseDown) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isMouseDown,
    dragOffset,
    storageKey,
    position,
    setIsDragging,
    hasMovedWhileMouseDown,
  ]);

  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

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

  const adjustFontSize = (delta: number) => {
    if (!storageKey || !widgetConfig) return;

    const baseKey = storageKey.replace(/_position$/, "");
    const fontSizeKey = `${baseKey}_fontSize`;
    const currentSize = parseInt(
      localStorage.getItem(fontSizeKey) ||
        widgetConfig.fontSize.default.toString()
    );

    const { min, max, step } = widgetConfig.fontSize;
    const actualDelta = delta > 0 ? step : -step;
    const newSize = Math.max(min, Math.min(max, currentSize + actualDelta));

    localStorage.setItem(fontSizeKey, newSize.toString());

    let detail: any = { fontSize: newSize };

    if (widgetConfig.customControls?.timeFormat) {
      const is24Hour = localStorage.getItem("time_is24Hour") === "true";
      detail.is24Hour = is24Hour;
    }

    const eventName = `${baseKey}SettingsChange`;

    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
      })
    );
  };

  const adjustWidth = (delta: number) => {
    if (!storageKey || !widgetConfig?.width) return;

    const baseKey = storageKey.replace(/_position$/, "");
    const widthKey = `${baseKey}_width`;
    const currentWidth = parseInt(
      localStorage.getItem(widthKey) || widgetConfig.width.default.toString()
    );

    const { min, max, step } = widgetConfig.width;
    const actualDelta = delta > 0 ? step : -step;
    const newWidth = Math.max(min, Math.min(max, currentWidth + actualDelta));

    localStorage.setItem(widthKey, newWidth.toString());

    const eventName = `${baseKey}SettingsChange`;

    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          width: newWidth,
        },
      })
    );
  };

  const adjustSize = (delta: number) => {
    if (!storageKey || !widgetConfig?.size) return;

    const baseKey = storageKey.replace(/_position$/, "");
    const sizeKey = `${baseKey}_size`;
    const currentSize = parseInt(
      localStorage.getItem(sizeKey) || widgetConfig.size.default.toString()
    );

    const { min, max, step } = widgetConfig.size;
    const actualDelta = delta > 0 ? step : -step;
    const newSize = Math.max(min, Math.min(max, currentSize + actualDelta));

    localStorage.setItem(sizeKey, newSize.toString());

    const eventName = `${baseKey}SettingsChange`;

    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          size: newSize,
        },
      })
    );
  };

  const toggleTimeFormat = () => {
    const newIs24Hour = !is24Hour;
    setIs24Hour(newIs24Hour);
    localStorage.setItem("time_is24Hour", newIs24Hour.toString());

    const baseKey = storageKey?.replace(/_position$/, "");
    const fontSize = parseInt(
      localStorage.getItem(`${baseKey}_fontSize`) ||
        widgetConfig?.fontSize.default.toString() ||
        "24"
    );

    window.dispatchEvent(
      new CustomEvent("timeSettingsChange", {
        detail: {
          fontSize,
          is24Hour: newIs24Hour,
        },
      })
    );
  };

  const handleInfoFieldsChange = (fields: string[]) => {
    // Ensure at least one field is selected
    if (fields.length === 0) {
      return;
    }

    setSelectedInfoFields(fields);
    localStorage.setItem("info_selectedFields", JSON.stringify(fields));

    // Convert array to object for context
    const fieldsObj = {
      japaneseTitle: fields.includes("japaneseTitle"),
      title: fields.includes("title"),
      year: fields.includes("year"),
      movieLength: fields.includes("movieLength"),
      quote: fields.includes("quote"),
    };

    // Update context
    updateInfoFields(fieldsObj);

    window.dispatchEvent(
      new CustomEvent("infoSettingsChange", {
        detail: {
          selectedFields: fields,
        },
      })
    );
  };

  const handleAvatarChange = (avatar: string) => {
    setSelectedAvatar(avatar);
    localStorage.setItem("avatar_selected", avatar);

    window.dispatchEvent(
      new CustomEvent("avatarSettingsChange", {
        detail: {
          selectedAvatar: avatar,
        },
      })
    );
  };

  const alignment = getAlignment();
  const fontSizeEnabled = widgetConfig?.fontSize.enabled ?? false;
  const widthEnabled = widgetConfig?.width?.enabled ?? false;
  const sizeEnabled = widgetConfig?.size?.enabled ?? false;
  const hasTimeFormat = widgetConfig?.customControls?.timeFormat ?? false;
  const hasInfoFields = widgetConfig?.customControls?.infoFields ?? false;
  const hasAvatarSelector =
    widgetConfig?.customControls?.avatarSelector ?? false;
  const hasAnyControls =
    fontSizeEnabled ||
    hasTimeFormat ||
    widthEnabled ||
    hasInfoFields ||
    sizeEnabled ||
    hasAvatarSelector;

  return (
    <>
      <div
        ref={widgetRef}
        className={`widget ${localIsDragging ? "dragging" : ""} ${
          showWidgetEdits ? "edit-mode" : ""
        } draggable widget-align-${alignment}`}
        style={{
          left: `${position.x}vw`,
          top: `${position.y}vh`,
          transform: getTransform(),
        }}
        onMouseDown={handleWidgetMouseDown}
      >
        {showWidgetEdits && !localIsDragging && (
          <div
            className={`widget-overlay ${
              !hasAnyControls ? "draggable-overlay" : ""
            }`}
          >
            {hasAnyControls && (
              <>
                <div className="widget-controls-container">
                  {fontSizeEnabled && (
                    <div className="font-size-control-wrapper">
                      <div className="font-size-controls">
                        <button
                          className="font-size-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            adjustFontSize(-5);
                          }}
                          title="Decrease font size"
                        >
                          <span className="font-icon-small">-</span>
                        </button>
                        Aa
                        <button
                          className="font-size-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            adjustFontSize(5);
                          }}
                          title="Increase font size"
                        >
                          <span className="font-icon-large">+</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {widthEnabled && (
                    <div className="width-control-wrapper">
                      <div className="width-controls">
                        <button
                          className="width-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            adjustWidth(-50);
                          }}
                          title="Decrease width"
                        >
                          <ArrowLeftIcon />
                        </button>
                        width
                        <button
                          className="width-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            adjustWidth(50);
                          }}
                          title="Increase width"
                        >
                          <ArrowRightIcon />
                        </button>
                      </div>
                    </div>
                  )}
                  {sizeEnabled && (
                    <div className="size-control-wrapper">
                      <div className="size-controls">
                        <button
                          className="size-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            adjustSize(-50);
                          }}
                          title="Decrease size"
                        >
                          <ZoomOutIcon />
                        </button>
                        size
                        <button
                          className="size-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            adjustSize(50);
                          }}
                          title="Increase size"
                        >
                          <ZoomInIcon />
                        </button>
                      </div>
                    </div>
                  )}
                  {hasTimeFormat && (
                    <button
                      className="time-format-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTimeFormat();
                      }}
                      title="Toggle 12/24 hour format"
                    >
                      {is24Hour ? "24h" : "12h"}
                    </button>
                  )}
                </div>
                {hasInfoFields && (
                  <FieldSelector
                    options={INFO_FIELD_OPTIONS}
                    selectedValues={selectedInfoFields}
                    onChange={handleInfoFieldsChange}
                    variant="dark"
                    minSelected={1}
                  />
                )}
                {hasAvatarSelector && (
                  <AvatarSelector
                    selectedAvatar={selectedAvatar}
                    onChange={handleAvatarChange}
                  />
                )}
              </>
            )}
          </div>
        )}
        <div className="widget-content">{children}</div>
      </div>
    </>
  );
};
