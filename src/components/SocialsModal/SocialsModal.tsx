import React from "react";
import { useT } from "../../i18n/i18n";
import { DialogShell } from "../DialogShell/DialogShell";
import { SOCIALS } from "../../config/socials";
import "./SocialsModal.css";

interface SocialsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SocialsModal: React.FC<SocialsModalProps> = ({ open, onClose }) => {
  const t = useT();

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      backdropClassName="socials-backdrop"
      dialogClassName="socials-dialog"
      labelledBy="socials-title"
      closeClassName="socials-close"
      closeLabel={t("modal.common.closeAria")}
    >
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
    </DialogShell>
  );
};

export default SocialsModal;
