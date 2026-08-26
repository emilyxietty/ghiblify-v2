import type { CSSProperties } from "react";
import {
  resolveSurfaceFrost,
  typeInMsPerChar,
  type WidgetKey, isNoteKey } from "../config/widgetConfig";
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
  // Published ONLY when non-zero. The shell rules read it without a
  // fallback, so an absent var leaves backdrop-filter at `none` - a
  // `blur(0px)` is not nothing: any backdrop-filter on the shell makes
  // it a backdrop root, and every blur inside the widget (todo rows,
  // weather's forecast cells, the pomodoro card) would go dead again.
  // Weather's mood card paints its own surface: the shell blur steps
  // aside under it no matter which path flipped the card on (the edit
  // panel's card chip resets blur to 0 itself; the right-click "Card"
  // radio only sets the flag).
  const blurSuppressed = storageKey === "weather" && settings.showCard === true;
  if (blurKey in settings && !blurSuppressed && fraction(settings[blurKey]) > 0)
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
    // Frost needs BOTH the flag and a strength. `blur(0px)` is not
    // nothing - it makes the element a backdrop root for no visual
    // gain - and a "Frosted" pill with the strength dragged to zero
    // looks identical to a solid one, so the class would be claiming
    // something the pixels don't show.
    if (settings.highlightFrost === true && blur > 0)
      classes.push("highlight-frost");
    style["--text-highlight"] = withAlpha(highlight, opacity);
    style["--text-highlight-blur"] = fraction(blur);
    style["--text-highlight-fg"] = resolveForeground(highlight, textColor);
  }

  if (isNoteKey(storageKey) && settings.paperFrost === true)
    classes.push("widget-notes-frost");

  // Weather is out of this list: its frost styles were retired with
  // the style strip, and honouring a stored `frosted` flag would put
  // shell glass under a surface the Background row now paints.
  const supportsSurfaceFrost =
    storageKey === "todo" || storageKey === "googleApps";
  if (
    supportsSurfaceFrost &&
    resolveSurfaceFrost(settings.frosted as boolean | undefined)
  ) {
    classes.push("widget-surface-frost");
    if (settings.frostDark === true) classes.push("frost-dark");
  }

  if (allowTypeIn && settings.typeIn === true) {
    classes.push("has-type-in");
    style["--type-in-steps"] = typeSteps;
    // One step per character at the widget's own pace, so a 200% clock
    // types in half the time of a 100% one.
    style["--type-in-duration"] = `${
      (typeSteps * typeInMsPerChar(settings.typeInSpeed)) / 1000
    }s`;
  }

  return { className: classes.join(" "), style };
};
