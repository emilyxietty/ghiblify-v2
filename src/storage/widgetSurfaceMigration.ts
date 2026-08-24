// The schema-8 fold: two settings the surface rework retired, kept
// apart from AppContext so it can be exercised on its own - same
// reasoning as imageSelectionMigration.ts. It is pure, it touches no
// storage, and it is the only code path an existing user's widget
// settings pass through on upgrade. Everything it gets wrong is
// invisible until someone's weather turns to plain text, or their
// Pomodoro card quietly resizes.
//
// It operates on the PERSISTED BLOB, which holds only what differs
// from the shipped defaults - not on merged settings. That is what
// makes the Pomodoro half work at all: `width` is absent here for
// anyone who never free-resized, whereas after the merge it is always
// the default number.

import { POMODORO_LEGACY_DIMS, type PomodoroSize } from "../config/widgetConfig";

/** The old fixed glass was `blur(14px)` on the shell; the Background
 *  row's blur is a 0-100 setting spent as `* 20px`. */
export const FROST_BLUR_SETTING = 70;
/** "Smoked" frost painted rgba(12, 16, 20, 0.42) over that glass. */
export const FROST_DARK_COLOR = "#0c1014";
export const FROST_DARK_OPACITY = 42;

type Settings = Record<string, unknown>;

interface WidgetEntry {
  settings?: Settings;
  dockSettings?: Settings;
  [key: string]: unknown;
}

export type WidgetBlob = Record<string, WidgetEntry | undefined>;

/**
 * Weather's retired `frosted` / `frostDark` flags, rewritten as the
 * generic Background row the widget now uses.
 *
 * `cardOn` is the mood card. With it on, the card painted its own
 * surface and the frost was already suppressed, so there is no look to
 * carry over - the dead flags go and nothing else is touched.
 */
const frostToBackground = (s: Settings | undefined, cardOn: boolean): void => {
  if (!s || s.frosted !== true) return;
  if (!cardOn) {
    s.blur = FROST_BLUR_SETTING;
    if (s.frostDark === true) {
      s.surfaceColor = FROST_DARK_COLOR;
      s.opacity = FROST_DARK_OPACITY;
    } else {
      // Plain frost was glass and nothing else - no tint at all.
      s.opacity = 0;
    }
  }
  delete s.frosted;
  delete s.frostDark;
};

/** Mutates and returns the blob. `frosted` is shared with todo and
 *  googleApps, which still honour it, so only weather's copy is
 *  retired here. */
export const migrateWidgetSurfaces = (blob: WidgetBlob): WidgetBlob => {
  const weather = blob.weather;
  if (weather) {
    const canvasCard = weather.settings?.showCard === true;
    frostToBackground(weather.settings, canvasCard);
    // The dock copy can override showCard; absent means it inherits
    // whatever the canvas one chose.
    frostToBackground(
      weather.dockSettings,
      (weather.dockSettings?.showCard as boolean | undefined) ?? canvasCard,
    );
  }

  const pomodoro = blob.pomodoro?.settings;
  if (pomodoro && typeof pomodoro.size === "string") {
    const dims = POMODORO_LEGACY_DIMS[pomodoro.size as PomodoroSize];
    // Unknown presets ("compact" / "regular", from a rename two
    // versions back) have no dimensions to restore and normalised to
    // the default anyway - drop the key and let them do that.
    if (dims) {
      if (typeof pomodoro.width !== "number") pomodoro.width = dims.width;
      if (typeof pomodoro.height !== "number") pomodoro.height = dims.height;
    }
    delete pomodoro.size;
  }

  return blob;
};
