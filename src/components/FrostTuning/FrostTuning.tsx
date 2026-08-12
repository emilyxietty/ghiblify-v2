import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_FROST_COLOR,
  frostBlurPx,
  useAppContext,
} from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import { normalizeHex } from "../../utils/textHighlight";
import { EditIcon } from "../Icons/Icons";
import "./FrostTuning.css";

const VIEWPORT_MARGIN = 8;

/** The suggested tints, as (colour, opacity) pairs - opacity is half
 *  the answer here, so a chip that only set a hex would land you on
 *  the wrong glass. "Clear" keeps whatever colour is set and just
 *  takes the tint to zero, leaving pure blur. */
const FROST_PRESETS = [
  { id: "clear", labelKey: "frostClear", color: null, opacity: 0, swatch: null },
  {
    id: "black",
    labelKey: "frostBlack",
    color: "#000000",
    opacity: 100,
    swatch: "#000000",
  },
  {
    id: "blackSoft",
    labelKey: "frostBlack",
    color: "#000000",
    opacity: 50,
    // The chip wears the alpha it applies, over the checkerboard.
    swatch: "rgba(0, 0, 0, 0.5)",
  },
  {
    id: "white",
    labelKey: "frostWhite",
    color: "#ffffff",
    opacity: 100,
    swatch: "#ffffff",
  },
  {
    id: "whiteSoft",
    labelKey: "frostWhite",
    color: "#ffffff",
    opacity: 50,
    swatch: "rgba(255, 255, 255, 0.5)",
  },
] as const;

interface FrostTuningProps {
  /** Viewport point to open next to - the Frost swatch's rect. */
  anchor: { x: number; y: number; height?: number };
  onClose: () => void;
}

/**
 * Tuning popup for the Frost palette, opened by its swatch.
 *
 * Three knobs, all stored on `appearance` and spent as custom
 * properties on <html>: `frostAmount` -> --frost-blur, `frostColor` ->
 * --frost-rgb, `frostOpacity` -> --frost-alpha (a multiplier on each
 * surface's shipped alpha, so the hierarchy between a dialog and the
 * sidebar survives). They drive the palette's own glass (sidebars,
 * dock, tooltips, dialogs) plus any widget explicitly switched to
 * frost - never a widget that didn't opt in.
 *
 * The panel is its own preview: it paints with the very tokens it
 * edits, so dragging the slider re-frosts the thing under your cursor
 * rather than a swatch standing in for it. Portalled to <body> so the
 * blur samples the wallpaper (a backdrop-filter nested inside the
 * transformed sidebar would only see the sidebar) and so no ancestor
 * stacking context can trap it.
 */
export const FrostTuning: React.FC<FrostTuningProps> = ({
  anchor,
  onClose,
}) => {
  const t = useT();
  const { appearance, updateAppearance, previewFrost } = useAppContext();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: anchor.y,
    left: anchor.x,
  });

  const color = appearance.frostColor ?? DEFAULT_FROST_COLOR;
  const amount = appearance.frostAmount ?? 35;
  const opacity = appearance.frostOpacity ?? 100;
  const normalizedColor = (normalizeHex(color) ?? DEFAULT_FROST_COLOR)
    .toLowerCase();
  const [hexDraft, setHexDraft] = useState(color);
  useEffect(() => setHexDraft(color), [color]);
  const hexIsValid = !hexDraft || !!normalizeHex(hexDraft);
  const commitHex = () => {
    const norm = normalizeHex(hexDraft);
    if (!norm) return;
    updateAppearance({ frostColor: norm });
  };

  // Hovering a chip wears it: previewFrost runs the same writer a
  // commit does, so the tint, the glass AND the ink flip together -
  // an earlier version wrote only the tint, which showed you white
  // glass still carrying white text. Nothing is persisted.
  const previewChip = (chipColor: string | null, chipOpacity: number) =>
    previewFrost({
      ...(chipColor ? { frostColor: chipColor } : {}),
      frostOpacity: chipOpacity,
    });
  const clearFrostPreview = () => previewFrost(null);
  // Closing (or switching palettes) mid-hover must not leave a preview
  // painted - the mouseleave never arrives once the panel is gone. No
  // dep array on purpose: re-asserting the committed values is
  // idempotent, and running it on every cleanup means no preview can
  // outlive the panel by even a frame.
  useEffect(() => clearFrostPreview);

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
      className="frost-tuning"
      role="dialog"
      aria-label={t("sidebar.appearance.frostTune")}
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="frost-tuning-head">
        <span>{t("sidebar.appearance.frostTune")}</span>
        <button
          type="button"
          className="frost-tuning-close"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <label className="frost-tuning-row">
        <span className="frost-tuning-label">
          {t("sidebar.appearance.frostAmount")}
          {/* The px readout is the point of the slider: "35" means
              nothing, "14px" is the blur you are looking at. */}
          <span className="frost-tuning-value">{frostBlurPx(amount)}px</span>
        </span>
        <input
          type="range"
          className="filter-slider"
          min={0}
          max={100}
          step={5}
          value={amount}
          aria-label={t("sidebar.appearance.frostAmount")}
          onChange={(e) =>
            updateAppearance({ frostAmount: Number(e.target.value) })
          }
        />
      </label>

      <label className="frost-tuning-row">
        <span className="frost-tuning-label">
          {t("sidebar.appearance.frostOpacity")}
          <span className="frost-tuning-value">{opacity}%</span>
        </span>
        <input
          type="range"
          className="filter-slider"
          min={0}
          max={100}
          step={5}
          value={opacity}
          aria-label={t("sidebar.appearance.frostOpacity")}
          onChange={(e) =>
            updateAppearance({ frostOpacity: Number(e.target.value) })
          }
        />
      </label>

      <div className="frost-tuning-row">
        <span className="frost-tuning-label">
          {t("sidebar.appearance.frostColor")}
        </span>
        <div
          className="frost-tuning-presets"
          role="group"
          aria-label={t("sidebar.appearance.frostColor")}
        >
          {FROST_PRESETS.map((preset) => {
            const label =
              preset.opacity === 100 || preset.color === null
                ? t(`sidebar.appearance.${preset.labelKey}`)
                : `${t(`sidebar.appearance.${preset.labelKey}`)} ${preset.opacity}%`;
            // Clear wins on opacity alone: at zero tint the colour
            // underneath is invisible, so highlighting a colour chip
            // there would point at something you can't see.
            const active =
              opacity === 0
                ? preset.color === null
                : preset.color !== null &&
                  preset.color === normalizedColor &&
                  preset.opacity === opacity;
            return (
              <button
                key={preset.id}
                type="button"
                className={`frost-tuning-preset${active ? " is-active" : ""}`}
                style={
                  preset.swatch
                    ? ({ "--preset-color": preset.swatch } as React.CSSProperties)
                    : undefined
                }
                aria-label={label}
                data-tooltip={label}
                aria-pressed={active}
                onMouseEnter={() => previewChip(preset.color, preset.opacity)}
                onMouseLeave={clearFrostPreview}
                onFocus={() => previewChip(preset.color, preset.opacity)}
                onBlur={clearFrostPreview}
                onClick={() =>
                  updateAppearance({
                    frostOpacity: preset.opacity,
                    ...(preset.color ? { frostColor: preset.color } : {}),
                  })
                }
              />
            );
          })}
        </div>
        <div className="frost-tuning-color-line">
          <span className="frost-tuning-native-wrap">
            <input
              type="color"
              className="frost-tuning-native"
              value={normalizeHex(color) ?? DEFAULT_FROST_COLOR}
              onChange={(e) => updateAppearance({ frostColor: e.target.value })}
              aria-label={t("sidebar.appearance.frostColor")}
            />
            <span className="frost-tuning-native-pencil" aria-hidden="true">
              <EditIcon style={{ fontSize: 14 }} />
            </span>
          </span>
          <input
            type="text"
            className={`frost-tuning-hex${hexIsValid ? "" : " is-invalid"}`}
            value={hexDraft}
            placeholder={DEFAULT_FROST_COLOR.toUpperCase()}
            spellCheck={false}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitHex();
              }
            }}
            aria-label={t("sidebar.appearance.frostColor")}
          />
        </div>
      </div>

      <button
        type="button"
        className="frost-tuning-reset"
        onClick={() =>
          updateAppearance({
            frostAmount: 35,
            frostColor: DEFAULT_FROST_COLOR,
            frostOpacity: 100,
          })
        }
      >
        {t("common.reset")}
      </button>
    </div>,
    document.body
  );
};

export default FrostTuning;
