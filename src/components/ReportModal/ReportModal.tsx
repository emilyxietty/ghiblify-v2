import React, { useEffect, useState } from "react";
import { useT } from "../../i18n/i18n";
import { Button } from "../Button/Button";
import { DialogShell } from "../DialogShell/DialogShell";
import { ContentCopyIcon, DiscordIcon, EmailIcon } from "../Icons/Icons";
import "./ReportModal.css";

const CONTACT_EMAIL = "emily.xietty@gmail.com";
const DISCORD_INVITE = "https://discord.gg/8re4UaZ2fX";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ open, onClose }) => {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore - clipboard may be blocked in some contexts */
    }
  };

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      backdropClassName="report-backdrop"
      dialogClassName="report-dialog"
      labelledBy="report-title"
      closeClassName="report-close"
      closeLabel={t("modal.common.closeAria")}
    >
        <h2 id="report-title" className="report-title">
          {t("report.modalTitle")}
        </h2>
        <p className="report-intro">{t("report.modalIntro")}</p>

        <div className="report-email-row">
          <span className="report-email-label">{t("report.emailLabel")}</span>
          <a className="report-email" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="report-actions">
          <Button
            variant="dark"
            size="small"
            onClick={handleCopy}
            aria-label={t("report.copyAria")}
          >
            <ContentCopyIcon style={{ fontSize: 14 }} />
            {copied ? t("report.copied") : t("report.copyLabel")}
          </Button>
          <Button
            variant="dark"
            size="small"
            onClick={() => {
              window.open(`mailto:${CONTACT_EMAIL}`, "_self");
            }}
            aria-label={t("report.openMailAria")}
          >
            <EmailIcon style={{ fontSize: 14 }} />
            {t("report.openMail")}
          </Button>
        </div>

        {/* Secondary path - chatty users prefer Discord over email
            for "I noticed this", "what about a feature for...", etc.
            Sits below the email block as an alternative, separated
            by a thin divider so the dialog reads as
            "primary + alternative" rather than two equally-weighted
            options. */}
        <div className="report-divider" aria-hidden="true">
          <span>{t("report.orLabel")}</span>
        </div>

        <a
          className="report-discord-card"
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="report-discord-icon" aria-hidden="true">
            <DiscordIcon style={{ fontSize: 20 }} />
          </span>
          <span className="report-discord-meta">
            <span className="report-discord-title">
              {t("report.discordTitle")}
            </span>
            <span className="report-discord-sub">
              {t("report.discordSub")}
            </span>
          </span>
        </a>
    </DialogShell>
  );
};

export default ReportModal;
