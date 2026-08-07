import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../components/Button/Button";
import {
  BlurOnIcon,
  CloseIcon,
  DragIndicatorIcon,
  ExpandMoreIcon,
  OpacityIcon,
  PlaceIcon,
  VisibilityOffIcon,
} from "../../Icons/Icons";
import { AVATAR_OPTIONS } from "../../../config/avatarConfig";
import {
  AvatarSettings,
  DATE_DISPLAY_STYLES,
  DateSettings,
  DOCK_WIDGET_KEYS,
  getDockWidthPolicy,
  getWidgetConfig,
  InfoFields,
  InfoSettings,
  isWidgetKey,
  NOTE_PAPER_PRESETS,
  NotesSettings,
  POMODORO_CARD_PRESETS,
  PomodoroSettings,
  QuicklinksSettings,
  resolveWeatherDetail,
  supportsDockAlignment,
  TimeSettings,
  WeatherSettings,
  WEATHER_DETAILS,
  type WeatherDetail,
  type DateDisplayStyle,
} from "../../../config/widgetConfig";
import {
  useAppContext,
  type WidgetSurface,
  type WidgetsState,
} from "../../../contexts/AppContext";
import {
  clearWeatherLocation,
  getDeviceLocationLabel,
} from "../../../hooks/useWeather";
import { useT } from "../../../i18n/i18n";
import {
  POMODORO_SOUND_KEYS,
  isPomodoroSoundKey,
  playPomodoroChime,
  primePomodoroAudio,
  type PomodoroSoundKey,
} from "../../../utils/pomodoroChime";
import { isHighlightTextColor, normalizeHex } from "../../../utils/textHighlight";
import { ColorPicker, ColorTuning } from "../ColorPicker/ColorPicker";
import { Dropdown } from "../../Dropdown/Dropdown";
import { MultiSelectDropdown } from "../MultiSelectDropdown/MultiSelectDropdown";
import {
  SurfaceStylePicker,
  type SurfaceStyleValue,
} from "../SurfaceStylePicker/SurfaceStylePicker";
import "./EditWidget.css";

interface EditWidgetProps {
  showWidgetEdits: boolean;
  isResizing: boolean;
  storageKey?: string;
  /** The widget being edited - the panel measures it to sit alongside. */
  anchorEl?: HTMLElement | null;
  surface?: WidgetSurface;
  onClose?: () => void;
  /** Renders dock-only teaching controls for a temporary guide widget
   *  without treating that widget as persisted dock membership. */
  dockGuidePreview?: boolean;
}

const INFO_FIELD_VALUES = [
  "japaneseTitle",
  "title",
  "year",
  "movieLength",
  "quote",
] as const;

const infoFieldsFromValues = (fields: readonly string[]): InfoFields => ({
  japaneseTitle: fields.includes("japaneseTitle"),
  title: fields.includes("title"),
  year: fields.includes("year"),
  movieLength: fields.includes("movieLength"),
  quote: fields.includes("quote"),
});

const weatherSurfaceSettings = (style: SurfaceStyleValue) => ({
  showCard: style === "weather",
  frosted: style === "frost" || style === "frostDark",
  frostDark: style === "frostDark",
});

const PANEL_GAP = 12;
const VIEWPORT_MARGIN = 12;

/**
 * Panel stacking + placement, shared across every open panel.
 *
 * With several widgets in edit mode at once the panels overlap, so the
 * one you touched last has to come forward - a fixed z-index would
 * leave whichever mounted last permanently on top.
 *
 * The counter sits in its own band below --z-portal, the tier every
 * portalled dropdown / colour picker / menu uses. It only ever climbs,
 * so without a ceiling a long session of clicks would eventually lift a
 * panel above the very menus that open *from* it - which is exactly how
 * the detail dropdown ended up rendering behind the panel.
 *
 * Positions are remembered per widget for the life of the page, so
 * toggling edit mode off and on doesn't undo an arrangement.
 */
const PANEL_Z_BASE = 90000;
const PANEL_Z_CEILING = 99000;
let topPanelZ = PANEL_Z_BASE;
const nextPanelZ = () => {
  topPanelZ = topPanelZ >= PANEL_Z_CEILING ? PANEL_Z_BASE : topPanelZ + 1;
  return topPanelZ;
};
const movedPanels = new Map<string, { top: number; left: number }>();

/** One setting: name on the left, control on the right. */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="edit-panel-row">
    <span className="edit-panel-row-label">{label}</span>
    <div className="edit-panel-row-control">{children}</div>
  </div>
);

/** A full-width slider row - label and value share the top line. */
const SliderRow: React.FC<{
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}> = ({ id, label, value, min, max, step, ariaLabel, onChange, onCommit }) => (
  <div className="edit-panel-slider-row">
    <label className="edit-panel-slider-head" htmlFor={id}>
      <span className="edit-panel-row-label">{label}</span>
      <span className="edit-panel-slider-value">{value}%</span>
    </label>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      aria-valuetext={`${value} percent`}
      className="widget-opacity-slider"
      onChange={(e) => onChange(parseInt(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
    />
  </div>
);

/**
 * The edit-mode settings panel.
 *
 * Sits *beside* the widget rather than on top of it, as a stack of
 * labelled rows. The previous overlay covered the thing being edited
 * and laid its controls out as one flat row of bare buttons and
 * dropdowns - readable at three controls, unreadable at Weather's six,
 * and it grew horizontally every time a setting was added. Rows grow
 * downward, name what they change, and leave the widget visible while
 * you change it.
 */
const EditWidget: React.FC<EditWidgetProps> = ({
  showWidgetEdits,
  isResizing,
  storageKey,
  anchorEl,
  surface = "canvas",
  onClose,
  dockGuidePreview = false,
}) => {
  const t = useT();
  const {
    widgetsCommitted: committedWidgets,
    updateWidgetSettings: updateCanvasWidgetSettings,
    updateWidgetDockSettings,
    previewWidgetSettings: previewSurfaceSettings,
    previewWidgetDockLayout,
    toggleWidgetVisibility,
    setWidgetInRightSidebar,
    setWidgetDockWidth,
    setWidgetDockAlignment,
    reorderDockedWidgets,
    setEditingWidgetKey,
    appearance,
  } = useAppContext();
  const isDock = surface === "dock";
  const widgetsCommitted = useMemo(() => {
    if (!isDock || !isWidgetKey(storageKey)) return committedWidgets;
    const entry = committedWidgets[storageKey];
    return {
      ...committedWidgets,
      [storageKey]: {
        ...entry,
        settings: { ...entry.settings, ...entry.dockSettings },
      },
    } as WidgetsState;
  }, [committedWidgets, isDock, storageKey]);
  const updateWidgetSettings = isDock
    ? updateWidgetDockSettings
    : updateCanvasWidgetSettings;
  const previewWidgetSettings = (
    key: Parameters<typeof previewSurfaceSettings>[0],
    patch: Parameters<typeof previewSurfaceSettings>[1]
  ) => previewSurfaceSettings(key, patch, surface);
  const closeEditor = () => {
    if (isWidgetKey(storageKey)) {
      previewSurfaceSettings(storageKey, null, surface);
      previewWidgetDockLayout(storageKey, null);
    }
    if (onClose) onClose();
    else setEditingWidgetKey(null);
  };
  const panelRef = useRef<HTMLDivElement | null>(null);
  // While a hover-preview is active, the panel must NOT re-place
  // itself. Previewing "analog" swells the Time widget, the
  // ResizeObserver re-anchors the panel, the cursor is suddenly off
  // the segment, the preview clears, the widget shrinks, the panel
  // snaps back under the cursor… a feedback loop that reads as the
  // panel spasming. Freezing placement for the hover's duration
  // breaks the loop; placement resumes on leave/click.
  const previewFreezeRef = useRef(false);
  const panelStorageKey = storageKey
    ? isDock
      ? `dock:${storageKey}`
      : storageKey
    : null;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(() =>
    panelStorageKey ? movedPanels.get(panelStorageKey) ?? null : null
  );
  const [z, setZ] = useState(nextPanelZ);
  // Once the user has dragged a panel, it stays where they put it -
  // auto-placement would otherwise snap it back to the widget's side on
  // the next reflow.
  const [isCustomPlaced, setIsCustomPlaced] = useState(
    () => !!panelStorageKey && movedPanels.has(panelStorageKey)
  );
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  // Whether the tuning column (opacity / blur / ink) is expanded out
  // the panel's right side - toggled by the strip's chevron.
  const [highlightTuneOpen, setHighlightTuneOpen] = useState(false);
  // Same disclosure model as the highlight picker: the row stays a
  // compact set of chips, and the numeric tuning (opacity / blur) lives
  // behind a toggle so the panel doesn't grow a slider for every widget
  // that happens to have a surface.
  const [surfaceTuneOpen, setSurfaceTuneOpen] = useState(false);
  // Todo alone has two surfaces: its own background, and the per-row
  // highlight. They tune independently, so each owns a flyout.
  const [rowTuneOpen, setRowTuneOpen] = useState(false);
  // The place the last location lookup resolved, so the Location row
  // can name it instead of saying "Auto" - "Auto" answers "how", when
  // what the row is being read for is "where". Captured on open: the
  // panel is short-lived, and the label lives in localStorage where the
  // widget's own fetch writes it.
  const [deviceLocationLabel] = useState(() => getDeviceLocationLabel());
  // The side column fits ONE panel, so opening either tuning flyout
  // closes the other instead of stacking them.
  const openSurfaceTune = (open: boolean) => {
    setSurfaceTuneOpen(open);
    if (open) setRowTuneOpen(false);
  };
  const openRowTune = (open: boolean) => {
    setRowTuneOpen(open);
    if (open) setSurfaceTuneOpen(false);
  };

  useEffect(() => {
    if (!isWidgetKey(storageKey)) return;
    const key = storageKey;
    setHighlightTuneOpen(false);
    return () => {
      previewWidgetSettings(key, null);
      previewWidgetDockLayout(key, null);
    };
  }, [storageKey]);

  const bringToFront = () => setZ(nextPanelZ());

  /** Drag from the title bar. Pointer capture keeps the drag alive when
   *  the cursor outruns the panel. */
  const onHandleDown = (e: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setIsCustomPlaced(true);
    bringToFront();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const rect = panel.getBoundingClientRect();
    // Clamped so a panel can't be parked entirely off-screen.
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, e.clientX - drag.dx),
      window.innerWidth - rect.width - VIEWPORT_MARGIN
    );
    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, e.clientY - drag.dy),
      window.innerHeight - rect.height - VIEWPORT_MARGIN
    );
    const next = { top, left };
    setPos(next);
    if (panelStorageKey) movedPanels.set(panelStorageKey, next);
  };

  const onHandleUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // Follow the widget: it can be dragged, resized, or reflowed by a
  // viewport change while the panel is open. Skipped once the user has
  // placed the panel themselves.
  useLayoutEffect(() => {
    if (!anchorEl || !showWidgetEdits || isCustomPlaced) return;
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      if (previewFreezeRef.current) return;
      const anchor = anchorEl.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      // Prefer the right side; flip left when it wouldn't fit.
      const rightEdge = anchor.right + PANEL_GAP + rect.width;
      const left =
        rightEdge <= window.innerWidth - VIEWPORT_MARGIN
          ? anchor.right + PANEL_GAP
          : Math.max(VIEWPORT_MARGIN, anchor.left - PANEL_GAP - rect.width);
      const top = Math.min(
        Math.max(VIEWPORT_MARGIN, anchor.top),
        window.innerHeight - rect.height - VIEWPORT_MARGIN
      );
      setPos({ top, left });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(anchorEl);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorEl, showWidgetEdits, storageKey, isCustomPlaced]);

  useEffect(() => {
    if (!showWidgetEdits || !onClose) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (
        !target ||
        panelRef.current?.contains(target) ||
        (!isDock && anchorEl?.contains(target)) ||
        targetElement?.closest(
          "[role='dialog'], .dropdown-menu, .multi-select-menu, .ctx-menu"
        )
      )
        return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Enter") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [anchorEl, isDock, onClose, showWidgetEdits]);

  if (!showWidgetEdits || isResizing || !isWidgetKey(storageKey)) return null;

  const widgetConfig = getWidgetConfig(storageKey);
  const settings = widgetsCommitted[storageKey].settings as Record<string, unknown>;
  const controls = widgetConfig.customControls;
  const supportsDockWidth = isDock && getDockWidthPolicy(storageKey) === "flexible";
  const supportsDockItemAlignment =
    isDock && supportsDockAlignment(storageKey);
  const persistedDockedWidgetKeys = isDock
    ? DOCK_WIDGET_KEYS.filter(
        (key) => widgetsCommitted[key].inRightSidebar,
      ).sort(
        (a, b) =>
          widgetsCommitted[a].dockOrder - widgetsCommitted[b].dockOrder,
      )
    : [];
  const dockedWidgetKeys =
    isDock && dockGuidePreview && storageKey === "time"
      ? [
          "time" as const,
          ...persistedDockedWidgetKeys.filter((key) => key !== "time"),
        ]
      : persistedDockedWidgetKeys;
  const dockOrderIndex = dockedWidgetKeys.findIndex(
    (key) => key === storageKey,
  );
  const supportsDockOrdering = isDock && dockOrderIndex >= 0;
  const moveDockWidget = (offset: -1 | 1) => {
    if (dockGuidePreview) return;
    const targetIndex = dockOrderIndex + offset;
    if (targetIndex < 0 || targetIndex >= dockedWidgetKeys.length) return;
    const reordered = [...dockedWidgetKeys];
    [reordered[dockOrderIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[dockOrderIndex],
    ];
    reorderDockedWidgets(reordered);
  };

  // --- Generic controls, driven by what the config declares ----------
  const isFrost = appearance.theme === "frost";
  const isNotes = storageKey === "notes";
  const isNotesPaperFrost =
    isNotes && (settings as Record<string, unknown>).paperFrost === true;
  // The single slider drives `blur` on Frost (the widget renders as
  // glass with no surface alpha to tune) and `opacity` everywhere else.
  // Notes always persists this value as opacity: solid paper uses it as
  // alpha, while frosted paper maps it to blur strength in CSS.
  let sliderField: string = isNotes ? "opacity" : isFrost ? "blur" : "opacity";
  // Quicklinks stores a separate pair per mode - the grid's own
  // background and the list popup are different surfaces - so the
  // slider has to write whichever belongs to the mode on screen.
  if (
    storageKey === "quicklinks" &&
    !(widgetsCommitted.quicklinks.settings as QuicklinksSettings).gridMode
  ) {
    sliderField = sliderField === "blur" ? "listBlur" : "listOpacity";
  }
  let supportsSlider =
    sliderField in (widgetConfig.settings as Record<string, unknown>);
  if (supportsSlider && !isFrost && storageKey === "weather") {
    // Weather's opacity only tints the forecast cells, which don't
    // exist below the "hourly" detail level.
    const detail = resolveWeatherDetail(
      widgetsCommitted.weather.settings as WeatherSettings
    );
    if (detail !== "hourly" && detail !== "full") supportsSlider = false;
  }
  const sliderValue = supportsSlider
    ? Math.round(Number(settings[sliderField]) || 0)
    : 50;

  // Quicklinks exposes opacity AND blur together (no frost chip to
  // switch between them), and each mode stores its own pair.
  const qlGrid = (widgetsCommitted.quicklinks.settings as QuicklinksSettings)
    .gridMode;
  const qlFields = qlGrid
    ? { opacity: "opacity", blur: "blur" }
    : { opacity: "listOpacity", blur: "listBlur" };

  // Surface fields for whichever widget owns the Background control.
  // Quicklinks is the only one that stores a pair per mode.
  const surfaceFields =
    storageKey === "quicklinks"
      ? qlFields
      : { opacity: "opacity", blur: "blur" };
  const surfaceSettings = settings as Record<string, unknown>;
  const surfaceColorValue =
    typeof surfaceSettings.surfaceColor === "string"
      ? surfaceSettings.surfaceColor
      : null;
  const surfaceInk = isHighlightTextColor(surfaceSettings.textColor)
    ? surfaceSettings.textColor
    : "auto";
  const surfaceOpacityValue = Math.round(
    Number(surfaceSettings[surfaceFields.opacity]) || 0
  );
  const surfaceBlurValue = Math.round(
    Number(surfaceSettings[surfaceFields.blur]) || 0
  );

  // Pomodoro's two surfaces, read straight off its settings.
  // Clearing a colour restores the widget's CONFIGURED default alpha,
  // not 0. Zeroing suits widgets that ship clear (todo, quicklinks
  // grid, google apps) but wrecked ones whose default surface is
  // meaningful on its own - the search bar's translucent white went
  // fully invisible when you removed a tint.
  const defaultAlpha = (field: string) =>
    Number(
      (widgetConfig.settings as Record<string, unknown>)[field] ?? 0
    ) || 0;

  const pomoRead = (c: string, o: string, b: string, tc: string) => ({
    color:
      typeof surfaceSettings[c] === "string"
        ? (surfaceSettings[c] as string)
        : null,
    opacity: Math.round(Number(surfaceSettings[o]) || 0),
    blur: Math.round(Number(surfaceSettings[b]) || 0),
    ink: isHighlightTextColor(surfaceSettings[tc])
      ? (surfaceSettings[tc] as "auto" | "light" | "dark")
      : ("auto" as const),
  });
  const pomoFocus = pomoRead("cardColor", "opacity", "blur", "textColor");
  const pomoBreak = pomoRead(
    "breakColor",
    "breakOpacity",
    "breakBlur",
    "breakTextColor"
  );

  const rowColorValue =
    typeof surfaceSettings.rowColor === "string"
      ? surfaceSettings.rowColor
      : null;
  const rowInk = isHighlightTextColor(surfaceSettings.rowTextColor)
    ? surfaceSettings.rowTextColor
    : "auto";
  const rowOpacityValue = Math.round(Number(surfaceSettings.rowOpacity) || 0);
  const rowBlurValue = Math.round(Number(surfaceSettings.rowBlur) || 0);

  const qlSettings = widgetsCommitted.quicklinks.settings as QuicklinksSettings;
  const qlSurfaceColor =
    typeof qlSettings.surfaceColor === "string" ? qlSettings.surfaceColor : null;
  const qlTextColor = isHighlightTextColor(qlSettings.textColor)
    ? qlSettings.textColor
    : "auto";
  const qlOpacityValue = Math.round(
    Number(qlSettings[qlFields.opacity as keyof QuicklinksSettings]) || 0
  );
  const qlBlurValue = Math.round(
    Number(qlSettings[qlFields.blur as keyof QuicklinksSettings]) || 0
  );

  // Widgets whose Background row owns the numeric tuning. Others keep
  // the slider inline, since without a surface row there'd be nothing
  // to expand from.
  const surfaceOwnsTuning = !!(controls?.todoFrosted && supportsSlider);
  // Quicklinks drives its own panel from the swatch, so it never shows
  // the separate tune toggle.
  const showTuneToggle = surfaceOwnsTuning && storageKey !== "quicklinks";
  // Naming follows what the control actually paints:
  //   Highlights - the individual pieces inside the widget
  //                (quicklinks GRID tiles, todo rows)
  //   Background - the widget's whole surface
  //                (quicklinks LIST popup, google apps cluster,
  //                 weather card, and the pill behind time / date /
  //                 greeting / info, which for a text-only widget IS
  //                 its background)
  // Info paints a pill per line rather than one behind the widget, so
  // it names the canvas control after what it does. In the dock that
  // same setting paints the complete tile, so it is a Background.
  const paintsPieces =
    (storageKey === "quicklinks" && qlGrid) ||
    (storageKey === "info" && !isDock);
  const surfaceLabel = paintsPieces
    ? t("widgets.edit.surfaceHighlights")
    : t("widgets.edit.surfaceStyle");

  const supportsTextShadow =
    "textShadow" in (widgetConfig.settings as Record<string, unknown>);
  // `??` not `||` - `||` would snap back to 100 when dragged to 0.
  const textShadowValue = Math.round(
    typeof settings.textShadow === "number" ? settings.textShadow : 100
  );

  // Presence in the *config* is the gate, so a stale stored value can't
  // make a control appear on a widget that doesn't support it.
  const supportsHighlight =
    "highlightColor" in (widgetConfig.settings as Record<string, unknown>);
  const supportsTypeIn =
    surface === "canvas" &&
    "typeIn" in (widgetConfig.settings as Record<string, unknown>);
  const highlightValue =
    typeof settings.highlightColor === "string"
      ? normalizeHex(settings.highlightColor)
      : null;
  const highlightTextColor = isHighlightTextColor(settings.highlightTextColor)
    ? settings.highlightTextColor
    : "auto";
  const highlightOpacity =
    typeof settings.highlightOpacity === "number"
      ? settings.highlightOpacity
      : 100;

  const hasAnyControls = !!(
    controls?.timeFormat ||
    controls?.dateFormat ||
    controls?.avatarSelector ||
    controls?.infoFields ||
    controls?.gridMode ||
    controls?.weatherUnit ||
    controls?.weatherDetail ||
    controls?.weatherCompact ||
    controls?.weatherStyle ||
    controls?.weatherLocation ||
    controls?.notesShowBorder ||
    controls?.notesPaper ||
    controls?.todoFrosted ||
    controls?.pomodoroSize ||
    controls?.pomodoroSound ||
    controls?.pomodoroColor ||
    supportsSlider ||
    supportsTextShadow ||
    supportsHighlight ||
    supportsTypeIn ||
    supportsDockWidth ||
    supportsDockItemAlignment ||
    supportsDockOrdering
  );

  const timeSettings = widgetsCommitted.time.settings as TimeSettings;
  const currentTimeFormat: "12h" | "24h" | "analog" = timeSettings.analog
    ? "analog"
    : timeSettings.is24Hour
      ? "24h"
      : "12h";
  const dateSettings = widgetsCommitted.date.settings as DateSettings;
  const quicklinksGrid = qlSettings.gridMode;
  const quicklinksPerRow = String(qlSettings.linksPerRow ?? 5);
  const quicklinksVisibleRows = String(qlSettings.visibleRows ?? 1);
  const typeInDisabled =
    storageKey === "date" && dateSettings.displayStyle === "calendar";
  const infoFields = (widgetsCommitted.info.settings as InfoSettings).infoFields;
  const weatherSettings = widgetsCommitted.weather.settings as WeatherSettings;
  const notesShowBorder =
    (widgetsCommitted.notes.settings as NotesSettings).showBorder !== false;
  const notesSettings = widgetsCommitted.notes.settings as NotesSettings;
  const notesPaperColor =
    typeof notesSettings.paperColor === "string"
      ? normalizeHex(notesSettings.paperColor)
      : null;
  const notesPaperFrost = notesSettings.paperFrost === true;
  const notesPaperNone = notesSettings.paperNone === true;
  const avatarSettings = widgetsCommitted.avatar.settings as AvatarSettings;
  const highlightFrost = settings.highlightFrost === true;
  const highlightBlur = Math.round(
    typeof settings.highlightBlur === "number" ? settings.highlightBlur : 60
  );
  // Both fall back rather than trusting storage: these keys are newer
  // than the widget, so anyone upgrading has settings without them.
  // `??` on the volume so a deliberate 0 (mute) isn't bounced back up.
  const pomodoroSettings = widgetsCommitted.pomodoro.settings as PomodoroSettings;
  const pomodoroSound: PomodoroSoundKey = isPomodoroSoundKey(
    pomodoroSettings.sound
  )
    ? pomodoroSettings.sound
    : "musicbox";
  const pomodoroVolume = Math.round(pomodoroSettings.soundVolume ?? 70);
  const pomodoroCardColor =
    typeof pomodoroSettings.cardColor === "string"
      ? normalizeHex(pomodoroSettings.cardColor)
      : null;
  const pomodoroSize: "small" | "medium" | "large" = (() => {
    const raw = (widgetsCommitted.pomodoro.settings as { size?: string }).size;
    return raw === "small" || raw === "medium" || raw === "large"
      ? raw
      : "medium";
  })();

  /** Segmented control - for two or three short, mutually-exclusive
   *  options where a dropdown would hide the alternatives. */
  const segmented = <T extends string>(
    ariaLabel: string,
    options: Array<{
      key: T;
      label: React.ReactNode;
      ariaLabel?: string;
    }>,
    current: T,
    onPick: (key: T) => void,
    previewPatch?: (key: T) => Record<string, unknown>,
    onPreview?: (key: T | null) => void,
    disabled = false,
  ) => (
    <div className="edit-panel-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={current === o.key}
          aria-label={o.ariaLabel}
          data-tooltip={o.ariaLabel}
          disabled={disabled}
          className={`edit-panel-segment${
            current === o.key ? " is-active" : ""
          }`}
          onMouseEnter={() => {
            if (previewPatch || onPreview) {
              previewFreezeRef.current = true;
              if (previewPatch)
                previewWidgetSettings(storageKey, previewPatch(o.key));
              onPreview?.(o.key);
            }
          }}
          onMouseLeave={() => {
            previewFreezeRef.current = false;
            if (previewPatch) previewWidgetSettings(storageKey, null);
            onPreview?.(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            previewFreezeRef.current = false;
            if (previewPatch) previewWidgetSettings(storageKey, null);
            onPreview?.(null);
            onPick(o.key);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const panel = (
    <div
      ref={panelRef}
      className={`edit-panel${
        (highlightTuneOpen && supportsHighlight && highlightValue) ||
        (surfaceTuneOpen && controls?.todoFrosted && supportsSlider) ||
        (rowTuneOpen && (storageKey === "todo" || storageKey === "pomodoro")) ||
        (surfaceTuneOpen && storageKey === "pomodoro")
          ? " edit-panel-expanded"
          : ""
      }`}
      data-edit-surface={surface}
      role="dialog"
      aria-label={t("widgets.contextMenu.edit", {
        name: t(`widgets.names.${storageKey}`),
      })}
      style={
        pos
          ? { position: "fixed", top: pos.top, left: pos.left, zIndex: z }
          : // Off-screen for the first paint so it can be measured
            // without flashing in the wrong place.
            { position: "fixed", top: -9999, left: -9999, zIndex: z }
      }
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => {
        // Safety net: leaving the whole panel always releases the
        // placement freeze along with any live preview.
        previewFreezeRef.current = false;
        previewWidgetSettings(storageKey, null);
        previewWidgetDockLayout(storageKey, null);
      }}
      // Any press inside the panel raises it - clicking a control on a
      // half-covered panel should bring the whole thing forward, not
      // just work blind.
      onMouseDown={(e) => {
        e.stopPropagation();
        bringToFront();
      }}
    >
      <h3
        className="edit-panel-title"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
      >
        {/* The drag hint belongs to the grip + name, NOT the <h3>: a
            title on the heading is inherited by every child, so it
            surfaced over the hide button too and beat its own
            tooltip. */}
        <span
          className="edit-panel-title-label"
          title={t("widgets.edit.panelDragHint")}
        >
          <DragIndicatorIcon
            className="edit-panel-grip"
            style={{ fontSize: 14 }}
          />
          {t(`widgets.names.${storageKey}`)}
        </span>
        {/* Hiding is the one action every widget shares, and until now
            the only route to it was holding a key for the quick-hide
            button. It closes the panel too - leaving an editor open on
            a widget that's no longer on screen makes no sense.
            onPointerDown stops propagation so the title bar's drag
            handler doesn't claim the press. */}
        <button
          type="button"
          className="edit-panel-hide"
          aria-label={t("widgets.contextMenu.hide", {
            name: t(`widgets.names.${storageKey}`),
          })}
          data-tooltip={t("widgets.contextMenu.hide", {
            name: t(`widgets.names.${storageKey}`),
          })}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (isDock) setWidgetInRightSidebar(storageKey, false);
            else toggleWidgetVisibility(storageKey);
            closeEditor();
          }}
        >
          <VisibilityOffIcon style={{ fontSize: 14 }} />
        </button>
      </h3>

      <div className="edit-panel-body">
      <div className="edit-panel-main">

      {!hasAnyControls && (
        <p className="edit-panel-empty">{t("widgets.edit.noCustomization")}</p>
      )}

      {supportsDockOrdering && (
        <Row label={t("rightDock.orderLabel")}>
          <div className="edit-panel-order-control">
            <button
              type="button"
              className="edit-panel-order-button edit-panel-order-up"
              disabled={dockGuidePreview || dockOrderIndex === 0}
              aria-label={t("rightDock.moveUpLabel")}
              data-tooltip={t("rightDock.moveUpLabel")}
              onClick={() => moveDockWidget(-1)}
            >
              <ExpandMoreIcon fontSize={18} />
            </button>
            <button
              type="button"
              className="edit-panel-order-button"
              disabled={
                dockGuidePreview ||
                dockOrderIndex === dockedWidgetKeys.length - 1
              }
              aria-label={t("rightDock.moveDownLabel")}
              data-tooltip={t("rightDock.moveDownLabel")}
              onClick={() => moveDockWidget(1)}
            >
              <ExpandMoreIcon fontSize={18} />
            </button>
          </div>
        </Row>
      )}

      {supportsDockWidth && (
        <Row label={t("widgets.edit.dockWidth")}>
          <div className="edit-panel-width-control">
            {segmented(
              t("widgets.edit.dockWidth"),
              [
                {
                  key: "half" as const,
                  label: (
                    <span
                      className="edit-panel-width-shape edit-panel-width-shape-half"
                      aria-hidden="true"
                    />
                  ),
                  ariaLabel: t("widgets.contextMenu.dockWidthHalf"),
                },
                {
                  key: "full" as const,
                  label: (
                    <span
                      className="edit-panel-width-shape edit-panel-width-shape-full"
                      aria-hidden="true"
                    />
                  ),
                  ariaLabel: t("widgets.contextMenu.dockWidthFull"),
                },
              ],
              widgetsCommitted[storageKey].dockWidth,
              (width) => setWidgetDockWidth(storageKey, width),
              undefined,
              (width) =>
                previewWidgetDockLayout(
                  storageKey,
                  width ? { dockWidth: width } : null,
                ),
            )}
          </div>
        </Row>
      )}

      {supportsDockItemAlignment && (
        <Row label={t("notes.toolbar.align")}>
          {segmented(
            t("notes.toolbar.align"),
            (["left", "center", "right"] as const).map((alignment) => ({
              key: alignment,
              label: (
                <span
                  className={`edit-panel-align-icon edit-panel-align-${alignment}`}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </span>
              ),
              ariaLabel: t(`notes.toolbar.align${
                alignment === "left"
                  ? "Left"
                  : alignment === "center"
                    ? "Center"
                    : "Right"
              }`),
            })),
            widgetsCommitted[storageKey].dockAlignment,
            (alignment) =>
              setWidgetDockAlignment(storageKey, alignment),
            undefined,
            (alignment) =>
              previewWidgetDockLayout(
                storageKey,
                alignment ? { dockAlignment: alignment } : null,
              ),
          )}
        </Row>
      )}

      {controls?.timeFormat && (
        <Row label={t("widgets.contextMenu.timeFormat")}>
          {segmented(
            t("widgets.edit.timeFormatAria"),
            [
              { key: "12h" as const, label: t("widgets.edit.timeFormat12") },
              { key: "24h" as const, label: t("widgets.edit.timeFormat24") },
              {
                key: "analog" as const,
                label: t("widgets.edit.timeFormatAnalog"),
              },
            ],
            currentTimeFormat,
            (fmt) =>
              updateWidgetSettings(
                "time",
                fmt === "analog"
                  ? { analog: true }
                  : { analog: false, is24Hour: fmt === "24h" }
              ),
            (fmt) =>
              fmt === "analog"
                ? { analog: true }
                : { analog: false, is24Hour: fmt === "24h" }
          )}
        </Row>
      )}

      {controls?.dateFormat && (
        <Row label={t("widgets.edit.dateFormatLabel")}>
          <Dropdown
            className="edit-panel-dropdown"
            size="small"
            variant="outline-light"
            portal
            options={DATE_DISPLAY_STYLES.map((style) => ({
              value: style,
              label: t(`widgets.edit.dateFormat.${style}`),
            }))}
            value={dateSettings.displayStyle ?? "long"}
            onChange={(style) => {
              const displayStyle = style as DateDisplayStyle;
              updateWidgetSettings("date", {
                displayStyle,
                ...(displayStyle === "calendar" ? { typeIn: false } : {}),
              });
            }}
            onOptionPreview={(style) =>
              previewWidgetSettings("date", { displayStyle: style })
            }
            onPreviewEnd={() => previewWidgetSettings("date", null)}
          />
        </Row>
      )}

      {controls?.avatarSelector && (
        <div className="edit-panel-avatar-grid" role="radiogroup" aria-label={t("widgets.contextMenu.selectAvatar")}>
          {AVATAR_OPTIONS.map((avatar) => (
            <div key={avatar.value} className="edit-panel-avatar-option">
              <button
                type="button"
                role="radio"
                aria-checked={avatarSettings.selectedAvatar === avatar.value}
                aria-label={avatar.label}
                className={`edit-panel-avatar-button${
                  avatarSettings.selectedAvatar === avatar.value ? " is-active" : ""
                }`}
                onMouseEnter={() =>
                  previewWidgetSettings("avatar", { selectedAvatar: avatar.value })
                }
                onMouseLeave={() => previewWidgetSettings("avatar", null)}
                onClick={() =>
                  updateWidgetSettings("avatar", { selectedAvatar: avatar.value })
                }
              >
                <img src={avatar.src} alt="" />
                <span>{avatar.label}</span>
              </button>
              {avatar.creator && (
                avatar.source ? (
                  <a href={avatar.source} target="_blank" rel="noopener noreferrer">
                    {avatar.creator}
                  </a>
                ) : (
                  <span className="edit-panel-avatar-credit">{avatar.creator}</span>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {controls?.gridMode && (
        <Row label={t("widgets.contextMenu.quicklinksView")}>
          {segmented(
            t("widgets.contextMenu.quicklinksView"),
            [
              { key: "grid" as const, label: t("widgets.edit.gridShow") },
              { key: "list" as const, label: t("widgets.edit.gridShowList") },
            ],
            quicklinksGrid ? "grid" : "list",
            (v) =>
              updateWidgetSettings("quicklinks", { gridMode: v === "grid" }),
            (v) => ({ gridMode: v === "grid" })
          )}
        </Row>
      )}

      {controls?.gridMode && quicklinksGrid && (
        <>
          <Row label={t("widgets.edit.quicklinksPerRow")}>
            {segmented(
              t("widgets.edit.quicklinksPerRow"),
              ["2", "3", "4", "5", "6"].map((value) => ({
                key: value,
                label: value,
              })),
              quicklinksPerRow,
              (value) =>
                updateWidgetSettings("quicklinks", {
                  linksPerRow: Number(value),
                }),
              (value) => ({ linksPerRow: Number(value) }),
            )}
          </Row>
          <Row label={t("widgets.edit.quicklinksVisibleRows")}>
            {segmented(
              t("widgets.edit.quicklinksVisibleRows"),
              ["1", "2", "3", "4"].map((value) => ({
                key: value,
                label: value,
              })),
              quicklinksVisibleRows,
              (value) =>
                updateWidgetSettings("quicklinks", {
                  visibleRows: Number(value),
                }),
              (value) => ({ visibleRows: Number(value) }),
            )}
          </Row>
        </>
      )}

      {controls?.infoFields && (
        <Row label={t("widgets.edit.infoFieldsLabel")}>
          <MultiSelectDropdown
            portal
            options={INFO_FIELD_VALUES.map((v) => ({
              value: v,
              label: t(`widgets.edit.infoFields.${v}`),
            }))}
            selectedValues={INFO_FIELD_VALUES.filter((k) => infoFields[k])}
            onChange={(fields) => {
              // At least one field must stay on, or the widget renders
              // as an empty box.
              if (fields.length === 0) return;
              updateWidgetSettings("info", {
                infoFields: infoFieldsFromValues(fields),
              });
            }}
            onOptionPreview={(value) => {
              const selected = INFO_FIELD_VALUES.filter((key) => infoFields[key]);
              const previewed = selected.some((key) => key === value)
                ? selected.filter((key) => key !== value)
                : [...selected, value];
              if (previewed.length === 0) return;
              previewWidgetSettings("info", {
                infoFields: infoFieldsFromValues(previewed),
              });
            }}
            onPreviewEnd={() => previewWidgetSettings("info", null)}
            buttonText={t("widgets.edit.infoFieldsLabel")}
          />
        </Row>
      )}

      {/* Quicklinks uses the highlight model instead of surface chips:
          one swatch that opens a full tuning panel (colour, ink,
          opacity, blur). The chip strip only ever offered a handful of
          preset tones, and with a continuous blur slider now in play a
          pair of frost presets alongside it was two controls fighting
          over one property. */}
      {controls?.todoFrosted && (
        <div className="edit-panel-slider-row">
          <span className="edit-panel-row-label">{surfaceLabel}</span>
          <ColorPicker
            color={surfaceColorValue}
            tuningKind={paintsPieces ? "highlight" : "background"}
            textColor={surfaceInk}
            opacity={surfaceOpacityValue}
            blur={surfaceBlurValue}
            expanded={surfaceTuneOpen}
            onExpandChange={openSurfaceTune}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, {
                [surfaceFields.blur]: v,
              } as never)
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, {
                surfaceColor: next,
                // A colour picked while the surface is fully
                // transparent would paint nothing and read as a broken
                // picker; clearing it drops the alpha back so the
                // widget doesn't keep the theme tint that first pick
                // introduced.
                ...(next
                  ? surfaceOpacityValue === 0
                    ? { [surfaceFields.opacity]: 25 }
                    : {}
                  : {
                      [surfaceFields.opacity]: defaultAlpha(
                        surfaceFields.opacity
                      ),
                    }),
              } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, { textColor: next } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, {
                [surfaceFields.opacity]: next,
              } as never)
            }
            onPreviewChange={(next) =>
              // Mirror the commit's alpha bump, or hovering a colour on
              // a clear surface previews nothing and the swatches look
              // dead until you actually click one.
              previewWidgetSettings(storageKey, {
                surfaceColor: next,
                ...(next && surfaceOpacityValue === 0
                  ? { [surfaceFields.opacity]: 25 }
                  : {}),
              } as never)
            }
            onPreviewOpacity={(next) =>
              previewWidgetSettings(storageKey, { [surfaceFields.opacity]: next } as never)
            }
            onPreviewTextColor={(next) =>
              previewWidgetSettings(storageKey, { textColor: next } as never)
            }
            onPreviewClear={() => previewWidgetSettings(storageKey, null)}
          />
        </div>
      )}

      {storageKey === "todo" && (
        <div className="edit-panel-slider-row">
          <span className="edit-panel-row-label">
            {t("widgets.edit.surfaceHighlights")}
          </span>
          <ColorPicker
            color={rowColorValue}
            tuningKind="highlight"
            textColor={rowInk}
            opacity={rowOpacityValue}
            blur={rowBlurValue}
            expanded={rowTuneOpen}
            onExpandChange={openRowTune}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, { rowBlur: v } as never)
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, {
                rowColor: next,
                ...(next && rowOpacityValue === 0 ? { rowOpacity: 25 } : {}),
              } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, { rowTextColor: next } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, { rowOpacity: next } as never)
            }
            onPreviewChange={(next) =>
              previewWidgetSettings(storageKey, {
                rowColor: next,
                ...(next && rowOpacityValue === 0 ? { rowOpacity: 25 } : {}),
              } as never)
            }
            onPreviewOpacity={(next) =>
              previewWidgetSettings(storageKey, { rowOpacity: next } as never)
            }
            onPreviewTextColor={(next) =>
              previewWidgetSettings(storageKey, { rowTextColor: next } as never)
            }
            onPreviewClear={() => previewWidgetSettings(storageKey, null)}
          />
        </div>
      )}


      {controls?.weatherFrosted && (
        <Row label={t("widgets.edit.surfaceStyle")}>
          <SurfaceStylePicker
            value={
              weatherSettings.showCard
                ? "weather"
                : weatherSettings.frosted === true
                  ? weatherSettings.frostDark === true
                    ? "frostDark"
                    : "frost"
                  : "clear"
            }
            options={["clear", "frost", "frostDark", "weather"]}
            ariaLabel={t("widgets.edit.surfaceStyle")}
            onChange={(style) =>
              updateWidgetSettings("weather", weatherSurfaceSettings(style))
            }
            onPreviewChange={(style) =>
              previewWidgetSettings(
                "weather",
                style ? weatherSurfaceSettings(style) : null,
              )
            }
          />
        </Row>
      )}

      {controls?.notesShowBorder && (
        // Short "Border: Show | Hide" - the previous full "Show
        // border" strings in both the label AND the segments made the
        // row wider than the panel, so the control painted over the
        // label.
        <Row label={t("widgets.edit.notesBorder")}>
          {segmented(
            t("widgets.edit.notesBorder"),
            [
              { key: "on" as const, label: t("widgets.edit.borderShow") },
              { key: "off" as const, label: t("widgets.edit.borderHide") },
            ],
            notesShowBorder ? "on" : "off",
            (v) => updateWidgetSettings("notes", { showBorder: v === "on" }),
            (v) => ({ showBorder: v === "on" })
          )}
        </Row>
      )}

      {controls?.notesPaper && (
        <Row label={t("widgets.edit.notesPaper")}>
          <div
            className="edit-panel-swatches"
            role="radiogroup"
            aria-label={t("widgets.edit.notesPaperAria")}
          >
            <button
              type="button"
              role="radio"
              aria-checked={notesPaperNone}
              aria-label={t("widgets.edit.notesPaperNone")}
              className={`edit-panel-swatch edit-panel-swatch-empty${
                notesPaperNone ? " is-active" : ""
              }`}
              onMouseEnter={() =>
                previewWidgetSettings("notes", {
                  paperColor: null,
                  paperNone: true,
                  paperFrost: false,
                })
              }
              onMouseLeave={() => previewWidgetSettings("notes", null)}
              onClick={() =>
                updateWidgetSettings("notes", {
                  paperColor: null,
                  paperNone: true,
                  paperFrost: false,
                })
              }
            />
            {NOTE_PAPER_PRESETS.map((hex, i) => {
              // Slot 0 is the shipped cream - stored as null so
              // pre-feature blobs and an explicit default pick are
              // the same state.
              const value = i === 0 ? null : hex;
              const isActive =
                !notesPaperNone && !notesPaperFrost && notesPaperColor === value;
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${t("widgets.edit.notesPaperAria")} ${hex}`}
                  className={`edit-panel-swatch${
                    isActive ? " is-active" : ""
                  }`}
                  style={{ background: hex }}
                  onMouseEnter={() =>
                    previewWidgetSettings("notes", {
                      paperColor: value,
                      paperNone: false,
                      paperFrost: false,
                    })
                  }
                  onMouseLeave={() => previewWidgetSettings("notes", null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateWidgetSettings("notes", {
                      paperColor: value,
                      paperNone: false,
                      paperFrost: false,
                    });
                  }}
                />
              );
            })}
            {/* Frosted glass is just another paper - picking it wins
                over any colour swatch. */}
            <button
              type="button"
              role="radio"
              aria-checked={notesPaperFrost}
              aria-label={t("widgets.edit.styleFrost")}
              title={t("widgets.edit.styleFrost")}
              className={`edit-panel-swatch edit-panel-swatch-frost${
                notesPaperFrost ? " is-active" : ""
              }`}
              onMouseEnter={() =>
                previewWidgetSettings("notes", {
                  paperColor: null,
                  paperNone: false,
                  paperFrost: true,
                })
              }
              onMouseLeave={() => previewWidgetSettings("notes", null)}
              onClick={(e) => {
                e.stopPropagation();
                updateWidgetSettings("notes", {
                  paperColor: null,
                  paperNone: false,
                  paperFrost: true,
                });
              }}
            />
          </div>
        </Row>
      )}

      {controls?.weatherLocation && (
        // Right-click on the canvas widget opens THIS panel, so the
        // permission-style switch lives here. "Off" also forgets the
        // cached coords so it visibly takes effect.
        <Row label={t("settings.permissionGeolocation")}>
          {segmented(
            t("settings.permissionGeolocation"),
            [
              { key: "on" as const, label: t("widgets.edit.weatherAnimatedOn") },
              {
                key: "off" as const,
                label: t("widgets.edit.weatherAnimatedOff"),
              },
            ],
            weatherSettings.useDeviceLocation !== false ? "on" : "off",
            (v) => {
              updateWidgetSettings("weather", {
                useDeviceLocation: v === "on",
              });
              if (v === "off") {
                clearWeatherLocation();
                window.dispatchEvent(
                  new CustomEvent("ghiblify:weather:refresh")
                );
              }
            },
            // No preview patch: every other segmented control previews
            // on hover because it's paint-only, but this one clears the
            // cached coordinates and re-fetches. Hovering the row is not
            // consent to change where the weather comes from.
          )}
        </Row>
      )}

      {controls?.weatherLocation && (
        <Row label={t("widgets.contextMenu.weatherLocation")}>
          <Button
            className="edit-panel-location-button"
            size="small"
            variant="outline-light"
            aria-label={t("widgets.edit.weatherLocationAria")}
            onClick={(e) => {
              e.stopPropagation();
              // Same modal the right-click menu opens - one place to
              // change location instead of two different pickers.
              window.dispatchEvent(
                new CustomEvent("ghiblify:weather:choose-city")
              );
            }}
          >
            <PlaceIcon style={{ fontSize: 14 }} />
            {/* "Auto" only means something while device location is on.
                With it off and no city chosen there is no location at
                all, and labelling that state "Auto" read as though the
                widget had one - so it becomes the invitation to pick. */}
            {weatherSettings.manualPlace?.name ??
              (weatherSettings.useDeviceLocation !== false
                ? (deviceLocationLabel ?? t("widgets.edit.weatherLocationAuto"))
                : t("widgets.edit.weatherLocationChoose"))}
          </Button>
        </Row>
      )}

      {controls?.weatherDetail && (
        <Row label={t("widgets.contextMenu.weatherDetail")}>
          <Dropdown
            className="edit-panel-dropdown"
            size="small"
            variant="outline-light"
            portal
            options={WEATHER_DETAILS.map((v) => ({
              value: v,
              label: t(`widgets.edit.weatherDetail.${v}`),
            }))}
            value={resolveWeatherDetail(weatherSettings)}
            onChange={(v) =>
              updateWidgetSettings("weather", { detail: v as WeatherDetail })
            }
            onOptionPreview={(v) =>
              previewWidgetSettings("weather", { detail: v })
            }
            onPreviewEnd={() => previewWidgetSettings("weather", null)}
          />
        </Row>
      )}

      {controls?.weatherCompact && !isDock && (
        <Row label={t("widgets.edit.weatherLayoutLabel")}>
          {segmented(
            t("widgets.edit.weatherLayoutAria"),
            [
              {
                key: "standard" as const,
                label: t("widgets.edit.weatherLayoutStandard"),
              },
              {
                key: "compact" as const,
                label: t("widgets.edit.weatherLayoutCompact"),
              },
            ],
            weatherSettings.compact ? "compact" : "standard",
            (layout) =>
              updateWidgetSettings("weather", {
                compact: layout === "compact",
              }),
            (layout) => ({ compact: layout === "compact" }),
          )}
        </Row>
      )}

      {controls?.weatherUnit && (
        <Row label={t("widgets.edit.weatherUnitLabel")}>
          {segmented(
            t("widgets.edit.weatherUnitAria"),
            [
              { key: "C" as const, label: t("widgets.edit.weatherUnitC") },
              { key: "F" as const, label: t("widgets.edit.weatherUnitF") },
            ],
            weatherSettings.unit,
            (v) => updateWidgetSettings("weather", { unit: v }),
            (v) => ({ unit: v })
          )}
        </Row>
      )}

      {controls?.weatherStyle && (
        <>
          {/* The plain/card style pair moved into the four-way
              Background row below - one control owns the surface. */}
          <Row label={t("widgets.edit.weatherAnimatedIcons")}>
            {segmented(
              t("widgets.edit.weatherAnimatedIcons"),
              [
                {
                  key: "animated" as const,
                  label: t("widgets.edit.weatherAnimatedOn"),
                },
                {
                  key: "still" as const,
                  label: t("widgets.edit.weatherAnimatedOff"),
                },
              ],
              (weatherSettings.iconStyle ?? "animated") === "animated"
                ? "animated"
                : "still",
              (v) => updateWidgetSettings("weather", { iconStyle: v }),
              (v) => ({ iconStyle: v }),
            )}
          </Row>
        </>
      )}

      {controls?.pomodoroSize && (
        <Row label={t("widgets.edit.pomodoroSizeLabel")}>
          {segmented(
            t("widgets.edit.pomodoroSizeLabel"),
            [
              {
                key: "small" as const,
                label: t("widgets.edit.pomodoroSizeSmall"),
              },
              {
                key: "medium" as const,
                label: t("widgets.edit.pomodoroSizeMedium"),
              },
              {
                key: "large" as const,
                label: t("widgets.edit.pomodoroSizeLarge"),
              },
            ],
            pomodoroSize,
            (v) => updateWidgetSettings("pomodoro", { size: v }),
            (v) => ({ size: v })
          )}
        </Row>
      )}

      {controls?.pomodoroSound && (
        <Row label={t("widgets.edit.pomodoroSoundLabel")}>
          {/* Picking a sound plays it. That's the obvious preview
              affordance, and it doubles as the audio unlock - this
              click is a real user gesture, so the context starts here
              rather than failing silently when the timer ends half an
              hour later. */}
          <Dropdown
            size="small"
            variant="outline-light"
            portal
            options={POMODORO_SOUND_KEYS.map((v) => ({
              value: v,
              label: t(`widgets.edit.pomodoroSound.${v}`),
            }))}
            value={pomodoroSound}
            onChange={(v) => {
              const next = isPomodoroSoundKey(v) ? v : "musicbox";
              updateWidgetSettings("pomodoro", { sound: next });
              primePomodoroAudio();
              playPomodoroChime(next, pomodoroVolume);
            }}
          />
        </Row>
      )}

      {controls?.pomodoroColor && (
        <>
          {/* Focus and break are separate surfaces: the two modes are
              meant to read differently at a glance, so one shared
              colour defeated the point. Each uses the same picker +
              tuning flyout as every other Background control. */}
          <div className="edit-panel-slider-row">
            <span className="edit-panel-row-label">
              {t("widgets.edit.surfaceStyle")}
            </span>
            <ColorPicker
              color={pomoFocus.color}
              tuningKind="background"
              textColor={pomoFocus.ink}
              opacity={pomoFocus.opacity}
              blur={pomoFocus.blur}
              expanded={surfaceTuneOpen}
              onExpandChange={openSurfaceTune}
              onBlurChange={(v) =>
                updateWidgetSettings(storageKey, { blur: v } as never)
              }
              onChange={(next) =>
                updateWidgetSettings(storageKey, { cardColor: next } as never)
              }
              onTextColorChange={(next) =>
                updateWidgetSettings(storageKey, { textColor: next } as never)
              }
              onOpacityChange={(next) =>
                updateWidgetSettings(storageKey, { opacity: next } as never)
              }
              onPreviewChange={(next) =>
                previewWidgetSettings(storageKey, { cardColor: next } as never)
              }
              onPreviewOpacity={(next) =>
                previewWidgetSettings(storageKey, { opacity: next } as never)
              }
              onPreviewTextColor={(next) =>
                previewWidgetSettings(storageKey, { textColor: next } as never)
              }
              onPreviewClear={() => previewWidgetSettings(storageKey, null)}
            />
          </div>
          <div className="edit-panel-slider-row">
            <span className="edit-panel-row-label">
              {t("widgets.edit.pomodoroBreakColor")}
            </span>
            <ColorPicker
              color={pomoBreak.color}
              tuningKind="background"
              textColor={pomoBreak.ink}
              opacity={pomoBreak.opacity}
              blur={pomoBreak.blur}
              expanded={rowTuneOpen}
              onExpandChange={openRowTune}
              onBlurChange={(v) =>
                updateWidgetSettings(storageKey, { breakBlur: v } as never)
              }
              onChange={(next) =>
                updateWidgetSettings(storageKey, { breakColor: next } as never)
              }
              onTextColorChange={(next) =>
                updateWidgetSettings(storageKey, {
                  breakTextColor: next,
                } as never)
              }
              onOpacityChange={(next) =>
                updateWidgetSettings(storageKey, { breakOpacity: next } as never)
              }
              onPreviewChange={(next) =>
                previewWidgetSettings(storageKey, { breakColor: next } as never)
              }
              onPreviewOpacity={(next) =>
                previewWidgetSettings(storageKey, { breakOpacity: next } as never)
              }
              onPreviewTextColor={(next) =>
                previewWidgetSettings(storageKey, { breakTextColor: next } as never)
              }
              onPreviewClear={() => previewWidgetSettings(storageKey, null)}
            />
          </div>
        </>
      )}

      {controls?.pomodoroSound && pomodoroSound !== "none" && (
        <SliderRow
          id="widget-pomodoro-soundVolume"
          label={t("widgets.edit.pomodoroVolume")}
          value={pomodoroVolume}
          min={0}
          max={100}
          step={5}
          ariaLabel={t("widgets.edit.pomodoroVolumeAria")}
          onChange={(v) =>
            updateWidgetSettings("pomodoro", { soundVolume: v })
          }
          // Preview on release, not on change - sampling every drag
          // tick would fire a chime per pixel of travel.
          onCommit={() => {
            primePomodoroAudio();
            playPomodoroChime(pomodoroSound, pomodoroVolume);
          }}
        />
      )}

      {supportsHighlight && (
        // Stacked layout (label above, full-width swatch grid below) -
        // ~10 chips beside a side label was an unreadable squeeze.
        <div className="edit-panel-slider-row">
          <span className="edit-panel-row-label">
            {surfaceLabel}
          </span>
          <ColorPicker
            color={highlightValue}
            tuningKind={
              storageKey === "info" && !isDock ? "highlight" : "background"
            }
            textColor={highlightTextColor}
            opacity={highlightOpacity}
            expanded={highlightTuneOpen}
            onExpandChange={setHighlightTuneOpen}
            blur={highlightBlur}
            // Blur is a property of the colour: >0 frosts the pill in
            // that colour, 0 is solid. highlightFrost tracks it so
            // the shell's backdrop-filter class stays in sync.
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, {
                highlightBlur: v,
                highlightFrost: v > 0,
              } as never)
            }
            // Colour changes leave blur alone - a frosted pill stays
            // frosted when you re-tint it.
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
            onPreviewChange={(next) =>
              previewWidgetSettings(storageKey, { highlightColor: next })
            }
            onPreviewOpacity={(next) =>
              previewWidgetSettings(storageKey, { highlightOpacity: next })
            }
            onPreviewTextColor={(next) =>
              previewWidgetSettings(storageKey, { highlightTextColor: next })
            }
            onPreviewClear={() => previewWidgetSettings(storageKey, null)}
          />
        </div>
      )}

      {/* Opacity / ink / blur fine-tuning lives in the ColorPicker's
          hovercard (hover the swatch strip) rather than as permanent
          rows here. */}

      {supportsTypeIn && (
        <Row label={t("widgets.contextMenu.typeIn")}>
          {segmented(
            t("widgets.contextMenu.typeIn"),
            [
              { key: "on" as const, label: t("widgets.edit.weatherAnimatedOn") },
              {
                key: "off" as const,
                label: t("widgets.edit.weatherAnimatedOff"),
              },
            ],
            !typeInDisabled && settings.typeIn === true ? "on" : "off",
            (v) =>
              updateWidgetSettings(storageKey, {
                typeIn: v === "on",
              } as never),
            undefined,
            undefined,
            typeInDisabled,
          )}
        </Row>
      )}

      {supportsTextShadow && (
        <SliderRow
          id={`widget-${storageKey}-textShadow`}
          label={t("widgets.edit.textShadow")}
          value={textShadowValue}
          min={0}
          max={200}
          step={10}
          ariaLabel={t("widgets.edit.textShadowAria")}
          onChange={(v) =>
            updateWidgetSettings(storageKey, { textShadow: v } as never)
          }
        />
      )}

      {supportsSlider && !surfaceOwnsTuning && (
        <SliderRow
          id={`widget-${storageKey}-${sliderField}`}
          label={
            isNotesPaperFrost || (!isNotes && isFrost)
              ? t("widgets.edit.blur")
              : t("widgets.edit.opacity")
          }
          value={sliderValue}
          min={0}
          max={100}
          ariaLabel={
            isNotesPaperFrost || (!isNotes && isFrost)
              ? t("widgets.edit.blurAria")
              : t("widgets.edit.opacityAria")
          }
          onChange={(v) =>
            updateWidgetSettings(storageKey, { [sliderField]: v } as never)
          }
        />
      )}
      </div>

      {surfaceTuneOpen && storageKey === "pomodoro" && (
        <div className="edit-panel-side">
          <ColorTuning
            onClose={() => setSurfaceTuneOpen(false)}
            color={pomoFocus.color}
            tuningKind="background"
            textColor={pomoFocus.ink}
            opacity={pomoFocus.opacity}
            blur={pomoFocus.blur}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, { blur: v } as never)
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, { cardColor: next } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, { textColor: next } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, { opacity: next } as never)
            }
          />
        </div>
      )}

      {rowTuneOpen && storageKey === "pomodoro" && (
        <div className="edit-panel-side">
          <ColorTuning
            onClose={() => setRowTuneOpen(false)}
            color={pomoBreak.color}
            tuningKind="background"
            textColor={pomoBreak.ink}
            opacity={pomoBreak.opacity}
            blur={pomoBreak.blur}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, { breakBlur: v } as never)
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, { breakColor: next } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, { breakTextColor: next } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, { breakOpacity: next } as never)
            }
          />
        </div>
      )}

      {rowTuneOpen && storageKey === "todo" && (
        <div className="edit-panel-side">
          <ColorTuning
            onClose={() => setRowTuneOpen(false)}
            color={rowColorValue}
            tuningKind="highlight"
            textColor={rowInk}
            opacity={rowOpacityValue}
            blur={rowBlurValue}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, { rowBlur: v } as never)
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, {
                rowColor: next,
                ...(next && rowOpacityValue === 0 ? { rowOpacity: 25 } : {}),
              } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, { rowTextColor: next } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, { rowOpacity: next } as never)
            }
            onPreviewChange={(next) =>
              previewWidgetSettings(storageKey, { rowColor: next } as never)
            }
            onPreviewOpacity={(next) =>
              previewWidgetSettings(storageKey, { rowOpacity: next } as never)
            }
            onPreviewTextColor={(next) =>
              previewWidgetSettings(storageKey, { rowTextColor: next } as never)
            }
            onPreviewClear={() => previewWidgetSettings(storageKey, null)}
          />
        </div>
      )}

      {surfaceTuneOpen && controls?.todoFrosted && (
        <div className="edit-panel-side">
          <ColorTuning
            onClose={() => setSurfaceTuneOpen(false)}
            color={surfaceColorValue}
            tuningKind={paintsPieces ? "highlight" : "background"}
            textColor={surfaceInk}
            opacity={surfaceOpacityValue}
            blur={surfaceBlurValue}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, {
                [surfaceFields.blur]: v,
              } as never)
            }
            onChange={(next) =>
              updateWidgetSettings(storageKey, {
                surfaceColor: next,
                ...(next
                  ? surfaceOpacityValue === 0
                    ? { [surfaceFields.opacity]: 25 }
                    : {}
                  : {
                      [surfaceFields.opacity]: defaultAlpha(
                        surfaceFields.opacity
                      ),
                    }),
              } as never)
            }
            onTextColorChange={(next) =>
              updateWidgetSettings(storageKey, { textColor: next } as never)
            }
            onOpacityChange={(next) =>
              updateWidgetSettings(storageKey, {
                [surfaceFields.opacity]: next,
              } as never)
            }
            onPreviewChange={(next) =>
              previewWidgetSettings(storageKey, { surfaceColor: next } as never)
            }
            onPreviewOpacity={(next) =>
              previewWidgetSettings(storageKey, { [surfaceFields.opacity]: next } as never)
            }
            onPreviewTextColor={(next) =>
              previewWidgetSettings(storageKey, { textColor: next } as never)
            }
            onPreviewClear={() => previewWidgetSettings(storageKey, null)}
          />
        </div>
      )}

      {highlightTuneOpen && supportsHighlight && highlightValue && (
        <div className="edit-panel-side">
          <ColorTuning
            onClose={() => setHighlightTuneOpen(false)}
            color={highlightValue}
            tuningKind={storageKey === "info" ? "highlight" : "background"}
            textColor={highlightTextColor}
            opacity={highlightOpacity}
            blur={highlightBlur}
            onBlurChange={(v) =>
              updateWidgetSettings(storageKey, {
                highlightBlur: v,
                highlightFrost: v > 0,
              } as never)
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
            onPreviewTextColor={(next) =>
              previewWidgetSettings(storageKey, { highlightTextColor: next })
            }
            onPreviewClear={() => previewWidgetSettings(storageKey, null)}
          />
        </div>
      )}
      </div>
    </div>
  );

  // Portalled: the widget shell is `transform`ed, which would make the
  // panel's fixed position resolve against the widget instead of the
  // viewport.
  return createPortal(panel, document.body);
};

export default EditWidget;
