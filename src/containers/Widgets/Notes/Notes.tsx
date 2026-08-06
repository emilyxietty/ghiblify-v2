import React, { lazy, Suspense } from "react";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useT } from "../../../i18n/i18n";
import { useScaledPx } from "../../../utils/viewportScale";
import "./Notes.css";

// Lightweight paper shell. This renders instantly (no Lexical) so the
// note's paper + border paints immediately on load; the heavy Lexical
// editor is code-split into NotesEditor and lazy-loaded inside, with a
// static placeholder as the Suspense fallback. Previously the whole
// widget was one lazy chunk gated behind `fallback={null}`, so nothing
// showed at all until Lexical downloaded - hence the slow pop-in.
const NotesEditor = lazy(() => import("./NotesEditor"));

export const Notes: React.FC = () => {
  const t = useT();
  const { settings } = useWidgetSettings("notes");
  const scaledWidth = useScaledPx(settings.width);
  const scaledHeight = useScaledPx(settings.height);

  const paperColor =
    typeof settings.paperColor === "string" ? settings.paperColor : null;

  return (
    <div
      className={`notes-widget widget-header${
        settings.showBorder === false ? " no-border" : ""
      }${settings.paperNone === true ? " no-paper" : ""
      }${settings.paperFrost === true ? " notes-frost" : ""}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        ...(paperColor
          ? ({ "--note-paper": paperColor } as React.CSSProperties)
          : {}),
      }}
    >
      <Suspense
        fallback={
          <div className="notes-editor-shell">
            {/* While the editor chunk loads, show the note's CONTENT
                (plaintext mirror), not the placeholder - otherwise a
                populated note flashes "Jot something down…" on every
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
        <NotesEditor />
      </Suspense>
    </div>
  );
};

export default Notes;
