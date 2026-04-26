import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import "./Notes.css";

// Cute sticky-note widget. The user types whatever they want into the
// textarea; content persists into the widget's settings blob like
// every other tweakable setting (no separate localStorage key).
//
// We debounce the persist so we don't hammer the widgets blob on every
// keystroke — local state updates immediately for snappy typing,
// settings update after a brief idle.
export const Notes: React.FC = () => {
  const t = useT();
  const { widgets, updateWidgetSettings } = useAppContext();
  const settings = widgets.notes.settings;
  const [draft, setDraft] = useState(settings.content);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Sync local draft if settings change from elsewhere (e.g. Reset
  // All Widgets, or content updated in another tab via storage event).
  useEffect(() => {
    if (settings.content !== draftRef.current) {
      setDraft(settings.content);
    }
  }, [settings.content]);

  // Debounced persist — coalesces typing bursts.
  useEffect(() => {
    if (draft === settings.content) return;
    const id = window.setTimeout(() => {
      updateWidgetSettings("notes", { content: draft });
    }, 300);
    return () => window.clearTimeout(id);
  }, [draft, settings.content, updateWidgetSettings]);

  // Auto-continue bullet / dash lists. When the user presses Enter
  // on a line that starts with "- ", "* ", or "• ", the next line
  // auto-prefixes with the same marker. Pressing Enter on an empty
  // marker (e.g. "- " with no content) exits the list (clears the
  // marker and lands the cursor on a blank line).
  const handleListAutocontinue = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const target = e.currentTarget;
    const value = target.value;
    const cursor = target.selectionStart;
    // Find the start of the current line.
    const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
    const lineEnd = value.indexOf("\n", cursor);
    const line = value.slice(
      lineStart,
      lineEnd === -1 ? value.length : lineEnd
    );
    const m = line.match(/^([ \t]*)([-*•])(\s+)/);
    if (!m) return;
    const [marker, indent, bullet, sep] = m;

    // Empty marker — exit the list. Wipe the bullet from the line
    // and let the user start a fresh empty line below.
    if (line.trim() === bullet) {
      e.preventDefault();
      const before = value.slice(0, lineStart);
      const after = value.slice(lineEnd === -1 ? value.length : lineEnd);
      const next = before + after;
      target.value = next;
      target.setSelectionRange(lineStart, lineStart);
      setDraft(next);
      return;
    }

    // Continue the list — insert "\n<indent><bullet><sep>" at cursor.
    e.preventDefault();
    const insertion = "\n" + indent + bullet + sep;
    const next = value.slice(0, cursor) + insertion + value.slice(cursor);
    target.value = next;
    const newCursor = cursor + insertion.length;
    target.setSelectionRange(newCursor, newCursor);
    setDraft(next);
    // marker is referenced via destructure above; silence unused-var
    void marker;
  };

  return (
    <div
      className={`notes-widget widget-header${
        settings.showBorder === false ? " no-border" : ""
      }`}
      style={{ width: settings.width, height: settings.height }}
    >
      <textarea
        id="notes-textarea"
        className="notes-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleListAutocontinue}
        placeholder={t("notes.placeholder")}
        spellCheck
        aria-label={t("notes.ariaLabel")}
      />
    </div>
  );
};

export default Notes;
