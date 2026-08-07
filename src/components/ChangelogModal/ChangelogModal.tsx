/**
 * Changelog modal - opens from the version button at the bottom of
 * the LeftSidebar. Backdrop click and Esc both close.
 *
 * Carries the highlights of the shipped release (from
 * `config/changelog.ts`) and then points at the Discord for the rest.
 * The notes live in the extension because a user who just updated
 * wants them in the window they already have open, not one tab away;
 * they stay a short list because anything longer is a running feed,
 * and a feed can't be edited after a build without another review.
 */

import React from "react";
import { CHANGELOG } from "../../config/changelog";
import { useT } from "../../i18n/i18n";
import { DialogShell } from "../DialogShell/DialogShell";
import { DiscordIcon } from "../Icons/Icons";
import "./ChangelogModal.css";

const DISCORD_INVITE = "https://discord.gg/8re4UaZ2fX";

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  open,
  onClose,
}) => {
  const t = useT();

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      backdropClassName="changelog-backdrop"
      dialogClassName="changelog-dialog"
      labelledBy="changelog-title"
      closeClassName="changelog-close"
      closeLabel={t("modal.common.closeAria")}
    >
        <h2 id="changelog-title" className="changelog-title">
          {t("changelog.title")}
        </h2>
        <p className="changelog-intro">{t("changelog.intro")}</p>

        {/* Scrolls on its own so the Discord card below stays put -
            the dialog is height-capped, and a long release shouldn't
            push the one link off the bottom. */}
        <div className="changelog-releases">
          {CHANGELOG.map((release) => (
            <section className="changelog-release" key={release.version}>
              <h3 className="changelog-release-version">v{release.version}</h3>
              <ul className="changelog-release-items">
                {release.items.map((item) => (
                  <li key={item}>{t(`changelog.notes.${item}`)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

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
    </DialogShell>
  );
};

export default ChangelogModal;
