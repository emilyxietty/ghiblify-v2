import EditIcon from "@mui/icons-material/Edit";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuItem,
} from "../../components/ContextMenu/ContextMenu";
import EditWidget from "../../components/EditWidget/EditWidget";
import {
  getWidgetConfig,
  InfoSettings,
  QuicklinksSettings,
  TimeSettings,
  WeatherSettings,
  WidgetKey,
} from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
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
    dragMode,
    setDragMode,
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
    // Two ways to opt into widget dragging:
    //   1. Shift + left-click (one-shot drag without leaving normal mode)
    //   2. Drag Mode is on (sticky mode toggled from sidebar / right-click)
    // Holding shift OR being in drag mode means the user wants to move
    // the widget, so we don't bail on interactive children (buttons,
    // inputs) — that was the source of inconsistent drag behavior in
    // edit mode where overlay controls cover most of the widget surface.
    if (e.button !== 0) return;
    if (!e.shiftKey && !dragMode) return;
    if (isResizing) return;

    // Don't hijack mousedowns that originated on the resize handle or
    // the Shift+pencil quick-edit button — those have their own click
    // handlers and the drag flow swallows the click.
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
      <EditWidget
        showWidgetEdits={isEditingThis}
        isResizing={isResizing}
        storageKey={storageKey}
      />
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
      {/* Shift-only quick-edit pencil — only visible while Shift is held
          and the widget isn't already in edit mode. Lets you jump straight
          into editing one widget without going through the sidebar. */}
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
            setDragMode,
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
function buildContextMenuItems(args: {
  storageKey: WidgetKey;
  widgets: ReturnType<typeof useAppContext>["widgets"];
  t: (key: string, vars?: Record<string, string | number>) => string;
  setEditingWidgetKey: (k: WidgetKey | null) => void;
  toggleWidgetVisibility: (k: WidgetKey) => void;
  updateWidgetSettings: ReturnType<
    typeof useAppContext
  >["updateWidgetSettings"];
  setDragMode: (b: boolean) => void;
}): ContextMenuItem[] {
  const {
    storageKey,
    widgets,
    t,
    setEditingWidgetKey,
    toggleWidgetVisibility,
    updateWidgetSettings,
    setDragMode,
  } = args;

  const universal: ContextMenuItem[] = [
    {
      type: "action",
      label: t("widgets.contextMenu.edit"),
      onClick: () => setEditingWidgetKey(storageKey),
      icon: <EditIcon style={{ fontSize: 14 }} />,
    },
    {
      type: "action",
      label: t("widgets.contextMenu.drag"),
      onClick: () => setDragMode(true),
      icon: <OpenWithIcon style={{ fontSize: 14 }} />,
    },
    {
      type: "action",
      label: t("widgets.contextMenu.hide"),
      onClick: () => toggleWidgetVisibility(storageKey),
      icon: <VisibilityOffIcon style={{ fontSize: 14 }} />,
    },
  ];

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
    const sectionKeys = ["now", "hourly", "daily"] as const;
    const onlyOneOn =
      sectionKeys.filter((k) => s.sections[k]).length <= 1;
    extras = [
      {
        type: "radio",
        label: t("widgets.edit.weatherUnitC"),
        selected: s.unit === "C",
        onClick: () => updateWidgetSettings("weather", { unit: "C" }),
      },
      {
        type: "radio",
        label: t("widgets.edit.weatherUnitF"),
        selected: s.unit === "F",
        onClick: () => updateWidgetSettings("weather", { unit: "F" }),
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

  return extras.length
    ? [...universal, { type: "separator" }, ...extras]
    : universal;
}
