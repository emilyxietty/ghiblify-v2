import React, { useEffect, useRef } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import { CloseIcon } from "../Icons/Icons";
import "./WidgetSettingsModal.css";

interface WidgetSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Widget Settings modal — small dialog opened from the WIDGETS
 * heading in the LeftSidebar. Holds toggles that affect widget
 * behavior globally. Single option today (proportional resize); the
 * shape is set up so future toggles drop in as additional rows.
 */
export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const { appearance, updateAppearance } = useAppContext();
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
    <div className="widget-settings-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="widget-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-settings-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="widget-settings-close"
          aria-label={t("modal.common.closeAria")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <h2 id="widget-settings-title" className="widget-settings-title">
          {t("widgetSettings.modalTitle")}
        </h2>
        <p className="widget-settings-intro">{t("widgetSettings.modalIntro")}</p>

        <div className="widget-settings-row">
          <label className="contrast-toggle">
            <span className="widget-settings-row-text">
              <span className="widget-settings-row-label">
                {t("widgetSettings.proportionalScaling")}
              </span>
              <span className="widget-settings-row-sub">
                {t("widgetSettings.proportionalScalingSub")}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={appearance.proportionalScaling !== false}
              onChange={(e) =>
                updateAppearance({ proportionalScaling: e.target.checked })
              }
            />
            <span className="contrast-switch" aria-hidden="true" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default WidgetSettingsModal;
