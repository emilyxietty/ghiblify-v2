import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/Button/Button";
import { DragIndicatorIcon, PlaceIcon } from "../Icons/Icons";
import {
  getWidgetConfig,
  InfoFields,
  InfoSettings,
  isWidgetKey,
  NotesSettings,
  PomodoroSettings,
  QuicklinksSettings,
  resolveWeatherDetail,
  TimeSettings,
  WeatherSettings,
  WEATHER_DETAILS,
  type WeatherDetail,
} from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import {
  POMODORO_SOUND_KEYS,
  isPomodoroSoundKey,
  playPomodoroChime,
  primePomodoroAudio,
  type PomodoroSoundKey,
} from "../../utils/pomodoroChime";
import { isHighlightTextColor, normalizeHex } from "../../utils/textHighlight";
import { ColorPicker } from "../ColorPicker/ColorPicker";
import { Dropdown } from "../Dropdown/Dropdown";
import { MultiSelectDropdown } from "../MultiSelectDropdown/MultiSelectDropdown";
import "./EditWidget.css";

interface EditWidgetProps {
  showWidgetEdits: boolean;
  isResizing: boolean;
  storageKey?: string;
  /** The widget being edited — the panel measures it to sit alongside. */
  anchorEl?: HTMLElement | null;
}

const INFO_FIELD_VALUES = [
  "japaneseTitle",
  "title",
  "year",
  "movieLength",
  "quote",
] as const;

const PANEL_GAP = 12;
const VIEWPORT_MARGIN = 12;

/**
 * Panel stacking + placement, shared across every open panel.
 *
 * With several widgets in edit mode at once the panels overlap, so the
 * one you touched last has to come forward — a fixed z-index would
 * leave whichever mounted last permanently on top.
 *
 * The counter sits in its own band below --z-portal, the tier every
 * portalled dropdown / colour picker / menu uses. It only ever climbs,
 * so without a ceiling a long session of clicks would eventually lift a
 * panel above the very menus that open *from* it — which is exactly how
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

/** A full-width slider row — label and value share the top line. */
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
 * dropdowns — readable at three controls, unreadable at Weather's six,
 * and it grew horizontally every time a setting was added. Rows grow
 * downward, name what they change, and leave the widget visible while
 * you change it.
 */
const EditWidget: React.FC<EditWidgetProps> = ({
  showWidgetEdits,
  isResizing,
  storageKey,
  anchorEl,
}) => {
  const t = useT();
  const { widgets, updateWidgetSettings, appearance } = useAppContext();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(
    () => (storageKey ? movedPanels.get(storageKey) ?? null : null)
  );
  const [z, setZ] = useState(nextPanelZ);
  // Once the user has dragged a panel, it stays where they put it —
  // auto-placement would otherwise snap it back to the widget's side on
  // the next reflow.
  const [isCustomPlaced, setIsCustomPlaced] = useState(
    () => !!storageKey && movedPanels.has(storageKey)
  );
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

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
    if (storageKey) movedPanels.set(storageKey, next);
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

  if (!showWidgetEdits || isResizing || !isWidgetKey(storageKey)) return null;

  const widgetConfig = getWidgetConfig(storageKey);
  const settings = widgets[storageKey].settings as Record<string, unknown>;
  const controls = widgetConfig.customControls;

  // --- Generic controls, driven by what the config declares ----------
  const isFrost = appearance.theme === "frost";
  // The single slider drives `blur` on Frost (the widget renders as
  // glass with no surface alpha to tune) and `opacity` everywhere else.
  const sliderField: "blur" | "opacity" = isFrost ? "blur" : "opacity";
  let supportsSlider =
    sliderField in (widgetConfig.settings as Record<string, unknown>);
  if (supportsSlider && !isFrost && storageKey === "weather") {
    // Weather's opacity only tints the forecast cells, which don't
    // exist below the "hourly" detail level.
    const detail = resolveWeatherDetail(
      widgets.weather.settings as WeatherSettings
    );
    if (detail !== "hourly" && detail !== "full") supportsSlider = false;
  }
  const sliderValue = supportsSlider
    ? Math.round(Number(settings[sliderField]) || 0)
    : 50;

  const supportsTextShadow =
    "textShadow" in (widgetConfig.settings as Record<string, unknown>);
  // `??` not `||` — `||` would snap back to 100 when dragged to 0.
  const textShadowValue = Math.round(
    typeof settings.textShadow === "number" ? settings.textShadow : 100
  );

  // Presence in the *config* is the gate, so a stale stored value can't
  // make a control appear on a widget that doesn't support it.
  const supportsHighlight =
    "highlightColor" in (widgetConfig.settings as Record<string, unknown>);
  const supportsTypeIn =
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
    controls?.infoFields ||
    controls?.gridMode ||
    controls?.weatherUnit ||
    controls?.weatherDetail ||
    controls?.weatherStyle ||
    controls?.weatherLocation ||
    controls?.notesShowBorder ||
    controls?.pomodoroSize ||
    controls?.pomodoroSound ||
    supportsSlider ||
    supportsTextShadow ||
    supportsHighlight ||
    supportsTypeIn
  );

  const timeSettings = widgets.time.settings as TimeSettings;
  const currentTimeFormat: "12h" | "24h" | "analog" = timeSettings.analog
    ? "analog"
    : timeSettings.is24Hour
      ? "24h"
      : "12h";
  const quicklinksGrid = (widgets.quicklinks.settings as QuicklinksSettings)
    .gridMode;
  const infoFields = (widgets.info.settings as InfoSettings).infoFields;
  const weatherSettings = widgets.weather.settings as WeatherSettings;
  const notesShowBorder =
    (widgets.notes.settings as NotesSettings).showBorder !== false;
  // Both fall back rather than trusting storage: these keys are newer
  // than the widget, so anyone upgrading has settings without them.
  // `??` on the volume so a deliberate 0 (mute) isn't bounced back up.
  const pomodoroSettings = widgets.pomodoro.settings as PomodoroSettings;
  const pomodoroSound: PomodoroSoundKey = isPomodoroSoundKey(
    pomodoroSettings.sound
  )
    ? pomodoroSettings.sound
    : "musicbox";
  const pomodoroVolume = Math.round(pomodoroSettings.soundVolume ?? 70);
  const pomodoroSize: "small" | "medium" | "large" = (() => {
    const raw = (widgets.pomodoro.settings as { size?: string }).size;
    return raw === "small" || raw === "medium" || raw === "large"
      ? raw
      : "medium";
  })();

  /** Segmented control — for two or three short, mutually-exclusive
   *  options where a dropdown would hide the alternatives. */
  const segmented = <T extends string>(
    ariaLabel: string,
    options: Array<{ key: T; label: string }>,
    current: T,
    onPick: (key: T) => void
  ) => (
    <div className="edit-panel-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={current === o.key}
          className={`edit-panel-segment${
            current === o.key ? " is-active" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
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
      className="edit-panel"
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
      // Any press inside the panel raises it — clicking a control on a
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
        title={t("widgets.edit.panelDragHint")}
      >
        <DragIndicatorIcon className="edit-panel-grip" style={{ fontSize: 14 }} />
        {t(`widgets.names.${storageKey}`)}
      </h3>

      {!hasAnyControls && (
        <p className="edit-panel-empty">{t("widgets.edit.noCustomization")}</p>
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
              )
          )}
        </Row>
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
              updateWidgetSettings("quicklinks", { gridMode: v === "grid" })
          )}
        </Row>
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
                infoFields: {
                  japaneseTitle: fields.includes("japaneseTitle"),
                  title: fields.includes("title"),
                  year: fields.includes("year"),
                  movieLength: fields.includes("movieLength"),
                  quote: fields.includes("quote"),
                } as InfoFields,
              });
            }}
            buttonText={t("widgets.edit.infoFieldsLabel")}
          />
        </Row>
      )}

      {controls?.notesShowBorder && (
        <Row label={t("widgets.edit.notesShowBorder")}>
          {segmented(
            t("widgets.edit.notesShowBorder"),
            [
              { key: "on" as const, label: t("widgets.edit.notesShowBorder") },
              { key: "off" as const, label: t("widgets.edit.notesHideBorder") },
            ],
            notesShowBorder ? "on" : "off",
            (v) => updateWidgetSettings("notes", { showBorder: v === "on" })
          )}
        </Row>
      )}

      {controls?.weatherLocation && (
        <Row label={t("widgets.contextMenu.weatherLocation")}>
          <Button
            size="small"
            variant="dark"
            aria-label={t("widgets.edit.weatherLocationAria")}
            onClick={(e) => {
              e.stopPropagation();
              // Same modal the right-click menu opens — one place to
              // change location instead of two different pickers.
              window.dispatchEvent(
                new CustomEvent("ghiblify:weather:choose-city")
              );
            }}
          >
            <PlaceIcon style={{ fontSize: 14 }} />
            {t("widgets.edit.weatherLocationAuto")}
          </Button>
        </Row>
      )}

      {controls?.weatherDetail && (
        <Row label={t("widgets.contextMenu.weatherDetail")}>
          <Dropdown
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
          />
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
            (v) => updateWidgetSettings("weather", { unit: v })
          )}
        </Row>
      )}

      {controls?.weatherStyle && (
        <>
          <Row label={t("widgets.contextMenu.weatherStyle")}>
            {segmented(
              t("widgets.contextMenu.weatherStyle"),
              [
                {
                  key: "plain" as const,
                  label: t("widgets.edit.weatherStylePlain"),
                },
                {
                  key: "card" as const,
                  label: t("widgets.edit.weatherStyleCard"),
                },
              ],
              weatherSettings.showCard ? "card" : "plain",
              (v) =>
                updateWidgetSettings("weather", { showCard: v === "card" })
            )}
          </Row>
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
              (v) => updateWidgetSettings("weather", { iconStyle: v })
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
            (v) => updateWidgetSettings("pomodoro", { size: v })
          )}
        </Row>
      )}

      {controls?.pomodoroSound && (
        <Row label={t("widgets.edit.pomodoroSoundLabel")}>
          {/* Picking a sound plays it. That's the obvious preview
              affordance, and it doubles as the audio unlock — this
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
          // Preview on release, not on change — sampling every drag
          // tick would fire a chime per pixel of travel.
          onCommit={() => {
            primePomodoroAudio();
            playPomodoroChime(pomodoroSound, pomodoroVolume);
          }}
        />
      )}

      {supportsHighlight && (
        <Row label={t("widgets.edit.highlightLabel")}>
          <ColorPicker
            color={highlightValue}
            textColor={highlightTextColor}
            opacity={highlightOpacity}
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
          />
        </Row>
      )}

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
            settings.typeIn === true ? "on" : "off",
            (v) =>
              updateWidgetSettings(storageKey, {
                typeIn: v === "on",
              } as never)
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

      {supportsSlider && (
        <SliderRow
          id={`widget-${storageKey}-${sliderField}`}
          label={isFrost ? t("widgets.edit.blur") : t("widgets.edit.opacity")}
          value={sliderValue}
          min={0}
          max={100}
          ariaLabel={
            isFrost
              ? t("widgets.edit.blurAria")
              : t("widgets.edit.opacityAria")
          }
          onChange={(v) =>
            updateWidgetSettings(storageKey, { [sliderField]: v } as never)
          }
        />
      )}
    </div>
  );

  // Portalled: the widget shell is `transform`ed, which would make the
  // panel's fixed position resolve against the widget instead of the
  // viewport.
  return createPortal(panel, document.body);
};

export default EditWidget;
