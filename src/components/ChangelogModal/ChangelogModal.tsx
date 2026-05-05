/**
 * Changelog modal — opens from the version button at the bottom of
 * the LeftSidebar. Rather than maintaining release notes inside the
 * extension code (which would mean a new build + CWS review for every
 * "what's new" tweak), we point users at the Discord where the latest
 * updates are posted. Backdrop click and Esc both close.
 */

import React, { useEffect, useRef } from "react";
import { useT } from "../../i18n/i18n";
import { CloseIcon, DiscordIcon } from "../Icons/Icons";
import "./ChangelogModal.css";

const DISCORD_INVITE = "https://discord.gg/rvwmFgKW";

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

        <a
          className="changelog-discord-card"
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="changelog-discord-icon" aria-hidden="true">
            <DiscordIcon style={{ fontSize: 22 }} />
          </span>
          <span className="changelog-discord-label">
            {t("changelog.joinButton")}
          </span>
        </a>
      </div>
    </div>
  );
};

export default ChangelogModal;
