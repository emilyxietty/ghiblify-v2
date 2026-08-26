import React, { useEffect, useState } from "react";
import { useT } from "../../../i18n/i18n";
import {
  HIGHLIGHT_OPACITY_PRESETS,
  HIGHLIGHT_PRESETS,
  RECENT_COLORS_EVENT,
  normalizeHex,
  pushRecentColor,
  readRecentColors,
  resolveForeground,
  withAlpha,
  type HighlightTextColor,
} from "../../../utils/textHighlight";
import { ChevronRightIcon, EditIcon } from "../../ui/Icons/Icons";
import "./ColorPicker.css";

interface PanelProps {
  /** Current colour, or null when the highlight is off. */
  color: string | null;
  /** Widget-supplied chips rendered after the colour presets - named
   *  looks rather than colours. A look is a whole surface recipe
   *  (colour + opacity + blur, or something the widget draws itself,
   *  like weather's mood card), so the caller owns what "active" and
   *  "select" mean; the strip only draws and previews them. */
  looks?: Array<{
    key: string;
    label: string;
    /** Extra class carrying the chip's visual (stripes, gradient). */
    className?: string;
    active: boolean;
    /** The look carries a colour the tuning column can act on, so
     *  picking it opens the column the way a colour pick does. Looks
     *  that paint themselves (the weather card) leave this off and
     *  close it instead. */
    tunable?: boolean;
    onSelect: () => void;
    onPreview?: (active: boolean) => void;
  }>;
  /** Drop the six colour presets so the strip is looks only - for a
   *  widget whose Background is a handful of recipes, not a palette. */
  hidePresets?: boolean;
  /** Replace the shared colour presets with a widget's own palette
   *  (notes' sticky-pad papers). Same chip count keeps the row's
   *  rhythm; the strip does not care what the colours are. */
  presets?: readonly string[];
  /** Ink on top of the highlight - "auto" derives it from the colour. */
  textColor: HighlightTextColor;
  /** 0–100 - how solid the bar is. */
  opacity: number;
  onChange: (next: string | null) => void;
  onTextColorChange: (next: HighlightTextColor) => void;
  onOpacityChange: (next: number) => void;
  onPreviewChange?: (next: string | null) => void;
  onPreviewTextColor?: (next: HighlightTextColor) => void;
  onPreviewOpacity?: (next: number) => void;
  onPreviewClear?: () => void;
  /** 0–100 - backdrop blur behind the highlight pill. Blur is a
   *  property of ANY colour (0 = solid, >0 = frosted glass in that
   *  colour), not a separate highlight type. */
  blur?: number;
  onBlurChange?: (v: number) => void;
  /** Whether the edit panel's tuning column is expanded - the strip's
   *  chevron reflects and drives it (state lives in EditWidget).
   *  Explicit target value, NOT a toggle: idempotent under double-
   *  fired clicks. */
  expanded?: boolean;
  onExpandChange?: (open: boolean) => void;
  tuningKind?: "background" | "highlight";
}

/**
 * The picker's contents, with no opinion about where it sits.
 *
 * Split out from the trigger so the same UI serves both surfaces: a
 * dropdown under a button in the edit overlay, and a floating panel
 * opened from the right-click menu. Those used to be different controls
 * for the same setting - a swatch grid in one, a list of hex strings in
 * the other.
 */
export const ColorPickerPanel: React.FC<PanelProps> = ({
  color,
  textColor,
  opacity,
  onChange,
  onTextColorChange,
  onOpacityChange,
  onPreviewChange,
  onPreviewTextColor,
  onPreviewOpacity,
  onPreviewClear,
}) => {
  const t = useT();
  const [recents, setRecents] = useState<string[]>(() => readRecentColors());
  const [hexDraft, setHexDraft] = useState(color ?? "");

  useEffect(() => {
    setHexDraft(color ?? "");
  }, [color]);

  // Recents are shared across every widget's picker, so a colour chosen
  // in one has to show up in another that's already mounted.
  useEffect(() => {
    const sync = () => setRecents(readRecentColors());
    window.addEventListener(RECENT_COLORS_EVENT, sync);
    return () => window.removeEventListener(RECENT_COLORS_EVENT, sync);
  }, []);

  const commit = (hex: string) => {
    const norm = normalizeHex(hex);
    if (!norm) return;
    setRecents(pushRecentColor(norm));
    onChange(norm);
  };

  const hexIsValid = !hexDraft || !!normalizeHex(hexDraft);

  const swatch = (hex: string) => (
    <button
      key={hex}
      type="button"
      className={`color-picker-swatch${color === hex ? " is-active" : ""}`}
      style={{ background: hex }}
      aria-label={hex}
      data-tooltip={hex.toUpperCase()}
      onMouseEnter={() => onPreviewChange?.(hex)}
      onMouseLeave={onPreviewClear}
      onClick={() => commit(hex)}
    />
  );

  return (
    <>
      <button
        type="button"
        className={`color-picker-off${color ? "" : " is-active"}`}
        onMouseEnter={() => onPreviewChange?.(null)}
        onMouseLeave={onPreviewClear}
        onClick={() => onChange(null)}
      >
        {t("widgets.edit.highlightNone")}
      </button>

      {recents.length > 0 && (
        <>
          <span className="color-picker-label">
            {t("widgets.edit.highlightRecent")}
          </span>
          <div className="color-picker-swatches">{recents.map(swatch)}</div>
        </>
      )}

      <span className="color-picker-label">
        {t("widgets.edit.highlightPresets")}
      </span>
      <div className="color-picker-swatches">
        {HIGHLIGHT_PRESETS.map(swatch)}
      </div>

      <div className="color-picker-custom">
        {/* The native swatch fires per-drag in the OS dialog; only the
            committed value goes into recents, so dragging through the
            spectrum doesn't fill the list with noise. */}
        <span className="color-picker-native-wrap">
          <input
            type="color"
            className="color-picker-native"
            value={normalizeHex(color ?? "") ?? "#f7d774"}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            aria-label={t("widgets.edit.highlightCustomAria")}
          />
          <span className="color-picker-native-pencil" aria-hidden="true">
            <EditIcon style={{ fontSize: 14 }} />
          </span>
        </span>
        <input
          type="text"
          className={`color-picker-hex${hexIsValid ? "" : " is-invalid"}`}
          value={hexDraft}
          placeholder="#F7D774"
          spellCheck={false}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => commit(hexDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(hexDraft);
            }
          }}
          aria-label={t("widgets.edit.highlightHexAria")}
        />
      </div>

      {color && (
        <>
          <span className="color-picker-label">
            {t("widgets.contextMenu.opacity")}
          </span>
          <div className="color-picker-opacity">
            {HIGHLIGHT_OPACITY_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={opacity === v}
                className={`color-picker-opacity-step${
                  opacity === v ? " is-active" : ""
                }`}
                // Each step previews itself: the same colour at the
                // alpha it would apply.
                style={{ background: withAlpha(color, v) }}
                onMouseEnter={() => onPreviewOpacity?.(v)}
                onMouseLeave={onPreviewClear}
                onClick={() => onOpacityChange(v)}
              >
                {v}%
              </button>
            ))}
          </div>

          {/* Auto reads the colour's luminance, which is the right call
              for clear lights and darks but a coin flip for mid-tones - so the choice is offered rather than assumed. */}
          <span className="color-picker-label">
            {t("widgets.edit.highlightTextColor")}
          </span>
          <div
            className="color-picker-text-modes"
            role="radiogroup"
            aria-label={t("widgets.edit.highlightTextColor")}
          >
            {(["auto", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={textColor === mode}
                className={`color-picker-text-mode${
                  textColor === mode ? " is-active" : ""
                }`}
                style={
                  mode === "auto"
                    ? undefined
                    : {
                        background: color,
                        color: resolveForeground(color, mode),
                      }
                }
                onMouseEnter={() => onPreviewTextColor?.(mode)}
                onMouseLeave={onPreviewClear}
                onClick={() => onTextColorChange(mode)}
              >
                {mode === "auto" ? t("widgets.edit.highlightTextAuto") : "Aa"}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};

/** Inline swatch strip for the widget edit overlay: off + the six
 *  curated presets + custom-palette pencil + a chevron that expands
 *  the edit panel's tuning column (opacity / blur / ink - see
 *  ColorTuning, rendered by EditWidget as a second panel column
 *  rather than a floating overlay, so it never overlaps content and
 *  dismisses with the panel). */
export const ColorPicker: React.FC<PanelProps> = (props) => {
  const t = useT();
  // FIXED chip set - a variable count made the row wrap raggedly.
  // Recents are deliberately absent; custom/recent colours live one
  // click away behind the pencil (OS palette).
  const inlinePresets = props.presets ?? HIGHLIGHT_PRESETS;
  const tuningKind = props.tuningKind ?? "highlight";
  const tuneLabel = t(
    tuningKind === "background"
      ? "widgets.edit.backgroundTune"
      : "widgets.edit.highlightTune"
  );
  const unavailableLabel = t(
    tuningKind === "background"
      ? "widgets.edit.backgroundTuneUnavailable"
      : "widgets.edit.highlightTuneUnavailable"
  );

  // A look that is on stands in for the colour, so "none" must not
  // ALSO light up just because no colour hex is set.
  const lookActive = props.looks?.some((l) => l.active) ?? false;

  return (
    <div className="color-picker" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`color-picker-inline-swatch color-picker-inline-off${
          props.color || lookActive ? "" : " is-active"
        }`}
        aria-label={t("widgets.edit.highlightNone")}
        onMouseEnter={() => props.onPreviewChange?.(null)}
        onMouseLeave={props.onPreviewClear}
        onClick={() => {
          props.onChange(null);
          props.onExpandChange?.(false);
        }}
      />

      {!props.hidePresets && inlinePresets.map((hex) => (
        <button
          key={hex}
          type="button"
          className={`color-picker-inline-swatch${
            props.color === hex ? " is-active" : ""
          }`}
          // Solid, NOT at the current alpha: at a low opacity every
          // chip washed out to near-identical translucent grey, so the
          // palette stopped being a palette. The tuning rows below
          // preview what the alpha and blur actually do; these chips
          // are here to let you tell the colours apart.
          style={{ background: hex }}
          aria-label={hex.toUpperCase()}
          data-tooltip={hex.toUpperCase()}
          onMouseEnter={() => props.onPreviewChange?.(hex)}
          onMouseLeave={props.onPreviewClear}
          // Committing a colour auto-expands the tuning column - the
          // controls appear the moment they become relevant.
          onClick={() => {
            pushRecentColor(hex);
            props.onChange(hex);
            props.onExpandChange?.(true);
          }}
        />
      ))}


      {props.looks?.map((look) => (
        <button
          key={look.key}
          type="button"
          className={`color-picker-inline-swatch${
            look.className ? ` ${look.className}` : ""
          }${look.active ? " is-active" : ""}`}
          aria-label={look.label}
          data-tooltip={look.label}
          onMouseEnter={() => look.onPreview?.(true)}
          onMouseLeave={() => look.onPreview?.(false)}
          onClick={() => {
            look.onSelect();
            // A tunable look opens the tuning column, same as a colour
            // pick - the controls appear when they become relevant. A
            // self-painting look closes it: nothing there applies.
            props.onExpandChange?.(look.tunable === true);
          }}
        />
      ))}

      {/* Keep the disclosure slot visible before a colour is chosen so
          the strip advertises that presets have a second tuning level. */}
      {props.onExpandChange && !props.expanded && (
        <button
          type="button"
          className="color-picker-expand"
          aria-label={props.color ? tuneLabel : unavailableLabel}
          data-tooltip={props.color ? tuneLabel : unavailableLabel}
          aria-expanded={false}
          aria-disabled={!props.color}
          onClick={(e) => {
            e.stopPropagation();
            if (!props.color) return;
            props.onExpandChange?.(true);
          }}
        >
          <ChevronRightIcon style={{ fontSize: 15 }} />
        </button>
      )}
    </div>
  );
};

/** The tuning column - live "Aa" demo of the current pill, opacity,
 *  blur, ink. Rendered by EditWidget inside the panel's expandable
 *  right column (see .edit-panel-side). */
export const ColorTuning: React.FC<PanelProps & { onClose?: () => void }> = (
  props
) => {
  const t = useT();
  const tuneLabel = t(
    props.tuningKind === "background"
      ? "widgets.edit.backgroundTune"
      : "widgets.edit.highlightTune"
  );
  const [hexDraft, setHexDraft] = useState(props.color ?? "");
  useEffect(() => {
    setHexDraft(props.color ?? "");
  }, [props.color]);
  if (!props.color) return null;
  const hexIsValid = !hexDraft || !!normalizeHex(hexDraft);
  const commitHex = () => {
    const norm = normalizeHex(hexDraft);
    if (!norm) return;
    pushRecentColor(norm);
    props.onChange(norm);
  };
  return (
    <div className="highlight-tuning">
      <div className="highlight-tuning-head">
        <span>{tuneLabel}</span>
        {props.onClose && (
          <button
            type="button"
            className="highlight-tuning-close"
            aria-label={tuneLabel}
            onClick={props.onClose}
          >
            ✕
          </button>
        )}
      </div>
      <div
        className="color-picker-hovercard-demo"
        aria-hidden="true"
        style={{
          background: withAlpha(props.color, props.opacity),
          color: resolveForeground(props.color, props.textColor),
        }}
      >
        Aa
      </div>
      <div className="color-picker-hovercard-row">
        <span className="color-picker-hovercard-label">
          {t("widgets.edit.highlightCustomAria")}
        </span>
        <div className="highlight-tuning-custom-line">
          <span className="color-picker-native-wrap">
            <input
              type="color"
              className="color-picker-native"
              value={normalizeHex(props.color ?? "") ?? "#f7d774"}
              onChange={(e) => props.onChange(e.target.value)}
              onBlur={(e) => pushRecentColor(e.target.value)}
              aria-label={t("widgets.edit.highlightCustomAria")}
            />
            <span className="color-picker-native-pencil" aria-hidden="true">
              <EditIcon style={{ fontSize: 14 }} />
            </span>
          </span>
          <input
            type="text"
            className={`color-picker-hex${hexIsValid ? "" : " is-invalid"}`}
          value={hexDraft}
          placeholder="#F7D774"
          spellCheck={false}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitHex();
            }
          }}
            aria-label={t("widgets.edit.highlightHexAria")}
          />
        </div>
      </div>
      <label className="color-picker-hovercard-row">
        <span className="color-picker-hovercard-label">
          {t("widgets.contextMenu.opacity")}
        </span>
        <input
          type="range"
          className="filter-slider"
          min={5}
          max={100}
          step={5}
          value={props.opacity}
          aria-label={t("widgets.contextMenu.opacity")}
          onChange={(e) => props.onOpacityChange(Number(e.target.value))}
        />
      </label>
      {props.onBlurChange && (
        <label className="color-picker-hovercard-row">
          <span className="color-picker-hovercard-label">
            {t("widgets.edit.blur")}
          </span>
          <input
            type="range"
            className="filter-slider"
            min={0}
            max={100}
            step={5}
            value={props.blur ?? 0}
            aria-label={t("widgets.edit.blur")}
            onChange={(e) => props.onBlurChange?.(Number(e.target.value))}
          />
        </label>
      )}
      <div className="color-picker-hovercard-row">
        <span className="color-picker-hovercard-label">
          {t("widgets.edit.highlightTextColor")}
        </span>
        <div
          className="color-picker-ink"
          role="radiogroup"
          aria-label={t("widgets.edit.highlightTextColor")}
        >
          {(["auto", "light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={props.textColor === mode}
              aria-label={
                mode === "auto"
                  ? t("widgets.edit.highlightTextAuto")
                  : mode === "light"
                    ? t("widgets.edit.highlightTextLight")
                    : t("widgets.edit.highlightTextDark")
              }
              className={`color-picker-ink-btn ink-${mode}${
                props.textColor === mode ? " is-active" : ""
              }`}
              onMouseEnter={() => props.onPreviewTextColor?.(mode)}
              onMouseLeave={props.onPreviewClear}
              onClick={() => props.onTextColorChange(mode)}
            >
              {mode === "auto" ? t("widgets.edit.highlightTextAuto") : "Aa"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
