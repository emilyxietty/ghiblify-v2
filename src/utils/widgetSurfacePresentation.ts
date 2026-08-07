import type { CSSProperties } from "react";
import {
  resolveSurfaceFrost,
  type WidgetKey,
} from "../config/widgetConfig";
import {
  isHighlightTextColor,
  normalizeHex,
  resolveForeground,
  withAlpha,
} from "./textHighlight";

type SurfaceStyle = CSSProperties &
  Partial<Record<`--${string}`, string | number>>;

interface WidgetSurfacePresentationOptions {
  storageKey: WidgetKey;
  settings: Record<string, unknown>;
  theme: string;
  allowTypeIn?: boolean;
  typeSteps?: number;
}

interface WidgetSurfacePresentation {
  className: string;
  style: SurfaceStyle;
}

const fraction = (value: unknown): number =>
  Math.max(0, Math.min(1, Number(value) / 100));

export const getWidgetSurfacePresentation = ({
  storageKey,
  settings,
  theme,
  allowTypeIn = false,
  typeSteps = 0,
}: WidgetSurfacePresentationOptions): WidgetSurfacePresentation => {
  const classes: string[] = [];
  const style: SurfaceStyle = {};
  const usesListSurface =
    storageKey === "quicklinks" && settings.gridMode === false;
  const opacityKey = usesListSurface ? "listOpacity" : "opacity";
  const blurKey = usesListSurface ? "listBlur" : "blur";

  if (opacityKey in settings)
    style["--widget-opacity"] = fraction(settings[opacityKey]);
  if (blurKey in settings)
    style["--widget-blur"] = fraction(settings[blurKey]);

  const highlight =
    typeof settings.highlightColor === "string"
      ? normalizeHex(settings.highlightColor)
      : null;
  if (highlight) {
    const opacity =
      typeof settings.highlightOpacity === "number"
        ? settings.highlightOpacity
        : 100;
    const blur =
      typeof settings.highlightBlur === "number" ? settings.highlightBlur : 60;
    const textColor = isHighlightTextColor(settings.highlightTextColor)
      ? settings.highlightTextColor
      : "auto";
    classes.push("has-text-highlight");
    if (settings.highlightFrost === true) classes.push("highlight-frost");
    style["--text-highlight"] = withAlpha(highlight, opacity);
    style["--text-highlight-blur"] = fraction(blur);
    style["--text-highlight-fg"] = resolveForeground(highlight, textColor);
  }

  if (storageKey === "notes" && settings.paperFrost === true)
    classes.push("widget-notes-frost");

  const supportsSurfaceFrost =
    storageKey === "todo" ||
    storageKey === "weather" ||
    storageKey === "googleApps";
  if (
    supportsSurfaceFrost &&
    resolveSurfaceFrost(settings.frosted as boolean | undefined, theme) &&
    !(storageKey === "weather" && settings.showCard === true)
  ) {
    classes.push("widget-surface-frost");
    if (settings.frostDark === true) classes.push("frost-dark");
  }

  if (allowTypeIn && settings.typeIn === true) {
    classes.push("has-type-in");
    style["--type-in-steps"] = typeSteps;
    style["--type-in-duration"] = `${typeSteps * 0.055}s`;
  }

  return { className: classes.join(" "), style };
};
