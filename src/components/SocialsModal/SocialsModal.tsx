import React, { useEffect, useRef } from "react";
import { useT } from "../../i18n/i18n";
import { CloseIcon } from "../Icons/Icons";
import { SOCIALS } from "../../config/socials";
import "./SocialsModal.css";

interface SocialsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SocialsModal: React.FC<SocialsModalProps> = ({ open, onClose }) => {
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
    <div className="socials-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="socials-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="socials-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="socials-close"
          aria-label={t("modal.common.closeAria")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <h2 id="socials-title" className="socials-title">
          {t("socials.modalTitle")}
        </h2>
        <p className="socials-intro">{t("socials.modalIntro")}</p>

        <ul className="socials-list">
          {SOCIALS.map((s) => (
            <li key={s.key}>
              <a
                className="socials-link"
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="socials-icon"><s.Icon /></span>
                <span className="socials-meta">
                  <span className="socials-label">{s.label}</span>
                  <span className="socials-handle">{s.handle}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SocialsModal;
