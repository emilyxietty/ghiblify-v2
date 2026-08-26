import React, { lazy, Suspense } from "react";
import { useWidgetSettings } from "../../hooks/useWidgetSettings";
import type { NoteKey } from "../../config/widgetConfig";
import { useT } from "../../i18n/i18n";
import { useScaledPx } from "../../utils/viewportScale";
import {
  HIGHLIGHT_TEXT_DARK,
  HIGHLIGHT_TEXT_LIGHT,
  foregroundFor,
  isHighlightTextColor,
} from "../../utils/textHighlight";
import "./Notes.css";

// Lightweight paper shell. This renders instantly (no Lexical) so the
// note's paper + border paints immediately on load; the heavy Lexical
// editor is code-split into NotesEditor and lazy-loaded inside, with a
// static placeholder as the Suspense fallback. Previously the whole
// widget was one lazy chunk gated behind `fallback={null}`, so nothing
// showed at all until Lexical downloaded - hence the slow pop-in.
const NotesEditor = lazy(() => import("./NotesEditor"));

export const Notes: React.FC<{ storageKey?: NoteKey }> = ({
  storageKey = "notes",
}) => {
  const t = useT();
  const { settings } = useWidgetSettings(storageKey);
  const scaledWidth = useScaledPx(settings.width);
  const scaledHeight = useScaledPx(settings.height);

  // The Background row writes surfaceColor; paperColor is the older
  // field the right-click paper submenu used to write, still honoured
  // when nothing newer is set. null = the classic cream.
  const paperColor =
    typeof settings.surfaceColor === "string"
      ? settings.surfaceColor
      : typeof settings.paperColor === "string"
        ? settings.paperColor
        : null;
  // Ink. "auto" keeps the classic brown unless the paper is dark enough
  // to need white; light / dark are the explicit choices.
  const inkMode = isHighlightTextColor(settings.textColor)
    ? settings.textColor
    : "auto";
  const ink =
    inkMode === "light"
      ? HIGHLIGHT_TEXT_LIGHT
      : inkMode === "dark"
        ? HIGHLIGHT_TEXT_DARK
        : paperColor && foregroundFor(paperColor) === HIGHLIGHT_TEXT_LIGHT
          ? HIGHLIGHT_TEXT_LIGHT
          : null;

  return (
    <div
      className={`notes-widget widget-header${
        settings.showBorder === false ? " no-border" : ""
      }${
        // Legacy "no paper" - only while nothing newer has painted a
        // tint over it.
        settings.paperNone === true &&
        typeof settings.surfaceColor !== "string"
          ? " no-paper"
          : ""
      }${settings.paperFrost === true ? " notes-frost" : ""}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        ...(paperColor
          ? ({ "--note-paper": paperColor } as React.CSSProperties)
          : {}),
        ...(ink ? ({ "--notes-ink": ink } as React.CSSProperties) : {}),
      }}
    >
      <Suspense
        fallback={
          <div className="notes-editor-shell">
            {/* While the editor chunk loads, show the note's CONTENT
                (plaintext mirror), not the placeholder - otherwise a
                populated note flashes "Type here…" on every
                new tab before the text pops back in. Placeholder only
                for genuinely empty notes. */}
            {settings.content ? (
              <div className="notes-textarea notes-static-preview">
                {settings.content}
              </div>
            ) : (
              <div className="notes-placeholder" aria-hidden>
                {t("notes.placeholder")}
              </div>
            )}
          </div>
        }
      >
        <NotesEditor storageKey={storageKey} />
      </Suspense>
    </div>
  );
};

export default Notes;
