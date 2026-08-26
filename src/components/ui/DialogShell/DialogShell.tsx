import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../Icons/Icons";

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  backdropClassName: string;
  dialogClassName: string;
  labelledBy: string;
  closeClassName?: string;
  closeLabel?: string;
  portal?: boolean;
  role?: "dialog" | "alertdialog";
  children: React.ReactNode;
}

export const DialogShell: React.FC<DialogShellProps> = ({
  open,
  onClose,
  backdropClassName,
  dialogClassName,
  labelledBy,
  closeClassName,
  closeLabel,
  portal = false,
  role = "dialog",
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div className={backdropClassName} onClick={onClose}>
      <div
        ref={dialogRef}
        className={dialogClassName}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        {closeClassName && closeLabel && (
          <button
            type="button"
            className={closeClassName}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </button>
        )}
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(content, document.body) : content;
};
