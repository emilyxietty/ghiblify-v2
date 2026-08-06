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
