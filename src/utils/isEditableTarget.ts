/** True when an event originated inside an editable surface - an
 *  input, textarea, select, or any contenteditable (the Notes Lexical
 *  editor). Document-level shortcut listeners (Cmd+B bookmarks,
 *  Cmd+K sidebar) must ignore these, or they hijack standard editing
 *  combos: Cmd+B in the note means "bold", not "open bookmarks". */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable], [contenteditable='true']";

/** True when `target` is, or sits inside, an editable surface. The
 *  right-click handlers on widgets use this to leave the browser's
 *  own context menu (copy / paste / spell-check) alone over text
 *  fields, where `isEditableTarget`'s exact-element check is not
 *  enough - a click can land on a span inside a contenteditable. */
export const isInsideEditable = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest(EDITABLE_SELECTOR);
