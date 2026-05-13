import React, { useEffect, useRef } from "react";
import { useT } from "../../i18n/i18n";
import { CloseIcon, DiscordIcon, GitHubIcon, InstagramIcon, LinkedInIcon, TikTokIcon } from "../Icons/Icons";
import "./SocialsModal.css";

interface SocialLink {
  key: string;
  href: string;
  icon: React.ReactElement;
  label: string;
  handle: string;
}

const SOCIALS: SocialLink[] = [
  {
    key: "github",
    href: "https://github.com/emilyxietty",
    icon: <GitHubIcon />,
    label: "GitHub",
    handle: "@emilyxietty",
  },
  {
    key: "instagram",
    href: "https://instagram.com/emily.xietty",
    icon: <InstagramIcon />,
    label: "Instagram",
    handle: "@emily.xietty",
  },
  {
    key: "tiktok",
    href: "https://tiktok.com/@pianokaisen",
    icon: <TikTokIcon />,
    label: "TikTok",
    handle: "@pianokaisen",
  },
  {
    key: "linkedin",
    href: "https://www.linkedin.com/in/emilyxietty/",
    icon: <LinkedInIcon />,
    label: "LinkedIn",
    handle: "emilyxietty",
  },
  {
    key: "discord",
    href: "https://discord.gg/8re4UaZ2fX",
    icon: <DiscordIcon />,
    label: "Discord",
    handle: "Join the community",
  },
];

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
                <span className="socials-icon">{s.icon}</span>
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
