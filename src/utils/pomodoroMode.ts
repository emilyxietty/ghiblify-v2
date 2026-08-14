// Which mode the pomodoro card is in, readable from outside the widget.
//
// The edit panel needs this to open its Background control on the
// surface you are actually looking at, and it cannot import the widget
// to ask: Pomodoro is a lazily-loaded chunk, and pulling it into the
// panel's bundle to read one boolean would undo that.
//
// The key is the widget's own state blob. It used to be eight separate
// `pomodoro_*` / `break_*` entries; those are legacy and are DELETED by
// the migration in Pomodoro.tsx, so anything reading
// `pomodoro_is_break` today gets null and quietly answers "focus".

export const POMODORO_STATE_KEY = "ghiblify_pomodoro";

const readFlag = (field: "isBreak" | "focusMode"): boolean => {
  try {
    const raw = localStorage.getItem(POMODORO_STATE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.[field] === true;
  } catch {
    return false;
  }
};

export const readPomodoroIsBreak = (): boolean => readFlag("isBreak");

/** Concentration mode. While it is on the card drops its surface
 *  entirely (see `body.pomodoro-focus` in Pomodoro.css), so the colour
 *  controls have nothing to paint. */
export const readPomodoroFocusMode = (): boolean => readFlag("focusMode");
