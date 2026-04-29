/**
 * Changelog modal — opens from the version button at the bottom of
 * the LeftSidebar. Reads the curated entry list from
 * `src/changelog.ts` and renders it as a scrollable list of release
 * notes. Backdrop click and Esc both close.
 */

import CloseIcon from "@mui/icons-material/Close";
import React, { useEffect, useRef } from "react";
import { CHANGELOG } from "../../changelog";
import { useT } from "../../i18n/i18n";
import "./ChangelogModal.css";

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="changelog-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="changelog-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="changelog-close"
          aria-label={t("modal.common.closeAria")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <h2 id="changelog-title" className="changelog-title">
          {t("changelog.title")}
        </h2>
        <p className="changelog-intro">{t("changelog.intro")}</p>

        <ol className="changelog-list">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="changelog-entry">
              <header className="changelog-entry-header">
                <span className="changelog-version">v{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
              </header>
              <ul className="changelog-highlights">
                {entry.highlights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default ChangelogModal;
