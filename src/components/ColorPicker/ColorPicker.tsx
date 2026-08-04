import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/i18n";
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
} from "../../utils/textHighlight";
import { Z_FLOATING } from "../../utils/zLayers";
import { FormatColorFillIcon } from "../Icons/Icons";
import "./ColorPicker.css";

const VIEWPORT_MARGIN = 8;

interface PanelProps {
  /** Current colour, or null when the highlight is off. */
  color: string | null;
  /** Ink on top of the highlight — "auto" derives it from the colour. */
  textColor: HighlightTextColor;
  /** 0–100 — how solid the bar is. */
  opacity: number;
  onChange: (next: string | null) => void;
  onTextColorChange: (next: HighlightTextColor) => void;
  onOpacityChange: (next: number) => void;
}

/**
 * The picker's contents, with no opinion about where it sits.
 *
 * Split out from the trigger so the same UI serves both surfaces: a
 * dropdown under a button in the edit overlay, and a floating panel
 * opened from the right-click menu. Those used to be different controls
 * for the same setting — a swatch grid in one, a list of hex strings in
 * the other.
 */
export const ColorPickerPanel: React.FC<PanelProps> = ({
  color,
  textColor,
  opacity,
  onChange,
  onTextColorChange,
  onOpacityChange,
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
      onClick={() => commit(hex)}
    />
  );

  return (
    <>
      <button
        type="button"
        className={`color-picker-off${color ? "" : " is-active"}`}
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
        <input
          type="color"
          className="color-picker-native"
          value={normalizeHex(color ?? "") ?? "#f7d774"}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          aria-label={t("widgets.edit.highlightCustomAria")}
        />
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
                onClick={() => onOpacityChange(v)}
              >
                {v}%
              </button>
            ))}
          </div>

          {/* Auto reads the colour's luminance, which is the right call
              for clear lights and darks but a coin flip for mid-tones —
              so the choice is offered rather than assumed. */}
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

interface PopoverProps extends PanelProps {
  /** Viewport point to open next to — a click position, or a trigger's
   *  rect. */
  anchor: { x: number; y: number; height?: number };
  onClose: () => void;
}

/**
 * The panel, floating.
 *
 * Portalled to <body> and positioned in viewport coordinates. Both
 * matter: rendered in place it sat inside `.widget-opacity-control`,
 * whose own z-index opens a stacking context — so no z-index on the
 * panel could lift it above the sibling buttons, and the widget's
 * overflow clipped whatever was left.
 */
export const ColorPickerPopover: React.FC<PopoverProps> = ({
  anchor,
  onClose,
  ...panel
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: anchor.y,
    left: anchor.x,
  });

  // Measure after mount, then flip above the anchor / clamp sideways so
  // the panel always lands fully on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = anchor.y + (anchor.height ?? 0) + 6;
    const top =
      below + rect.height + VIEWPORT_MARGIN <= window.innerHeight
        ? below
        : Math.max(VIEWPORT_MARGIN, anchor.y - rect.height - 6);
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, anchor.x),
      window.innerWidth - rect.width - VIEWPORT_MARGIN
    );
    setPos({ top, left });
  }, [anchor.x, anchor.y, anchor.height]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="color-picker-panel"
      role="dialog"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: Z_FLOATING,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ColorPickerPanel {...panel} />
    </div>,
    document.body
  );
};

/** Trigger button + the floating panel, for the widget edit overlay. */
export const ColorPicker: React.FC<PanelProps> = (props) => {
  const t = useT();
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="color-picker" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="color-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-label={t("widgets.edit.highlightAria")}
        data-tooltip={t("widgets.edit.highlightLabel")}
        onClick={(e) => {
          e.stopPropagation();
          if (anchor) {
            setAnchor(null);
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setAnchor({ x: rect.left, y: rect.top, height: rect.height });
        }}
      >
        <FormatColorFillIcon style={{ fontSize: 14 }} />
        <span
          className={`color-picker-chip${props.color ? "" : " is-empty"}`}
          style={
            props.color
              ? { background: withAlpha(props.color, props.opacity) }
              : undefined
          }
          aria-hidden="true"
        />
      </button>

      {anchor && (
        <ColorPickerPopover
          {...props}
          anchor={anchor}
          onClose={() => setAnchor(null)}
        />
      )}
    </div>
  );
};

export default ColorPicker;
