import React, { useEffect, useRef, useState } from "react";
import "./EditWidget.css";

interface EditWidgetProps {
  children: React.ReactNode;
  previewComponent?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export const EditWidget: React.FC<EditWidgetProps> = ({
  children,
  previewComponent,
  isOpen,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (dialog && e.target === dialog) {
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="edit-widget-dialog"
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="edit-widget-content">
        <div className="edit-widget-header">
          <h2>Edit Widget</h2>
          <button className="close-button" onClick={handleClose}>
            ✕
          </button>
        </div>
        {previewComponent && (
          <div className="edit-widget-preview">
            <div className="preview-content">{previewComponent}</div>
          </div>
        )}
        <div className="edit-widget-controls">{children}</div>
      </div>
    </dialog>
  );
};

export const DateEdit: React.FC = () => {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("date_fontSize");
    return saved ? parseInt(saved) : 24;
  });

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem("date_fontSize", newSize.toString());
    window.dispatchEvent(
      new CustomEvent("dateSettingsChange", {
        detail: { fontSize: newSize },
      })
    );
  };

  return (
    <>
      <label>
        Font Size:
        <span>
        <input
          type="range"
          min="12"
          max="48"
          step="2"
          value={fontSize}
          onChange={handleFontSizeChange}
        />
        <span className="font-size-value">{fontSize}px</span>
        </span>
      </label>
    </>
  );
};

export const TimeEdit: React.FC = () => {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("time_fontSize");
    return saved ? parseInt(saved) : 48;
  });
  const [is24Hour, setIs24Hour] = useState(() => {
    const saved = localStorage.getItem("time_is24Hour");
    return saved === "true";
  });

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem("time_fontSize", newSize.toString());
    window.dispatchEvent(
      new CustomEvent("timeSettingsChange", {
        detail: { fontSize: newSize, is24Hour },
      })
    );
  };

  const handleTimeFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const is24 = e.target.value === "24";
    setIs24Hour(is24);
    localStorage.setItem("time_is24Hour", is24.toString());
    window.dispatchEvent(
      new CustomEvent("timeSettingsChange", {
        detail: { fontSize, is24Hour: is24 },
      })
    );
  };

  return (
    <>
      <label>
        Time Format:
        <select
          value={is24Hour ? "24" : "12"}
          onChange={handleTimeFormatChange}
        >
          <option value="12">12-hour</option>
          <option value="24">24-hour</option>
        </select>
      </label>
      <label>
        Font Size:
        <span>
          <input
            type="range"
            min="20"
            max="160"
            step="5"
            value={fontSize}
            onChange={handleFontSizeChange}
          />
          <span className="font-size-value">{fontSize}px</span>
        </span>
      </label>
    </>
  );
};

export const InfoEdit: React.FC = () => {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("info_fontSize");
    return saved ? parseInt(saved) : 16;
  });

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem("info_fontSize", newSize.toString());
    window.dispatchEvent(
      new CustomEvent("infoSettingsChange", {
        detail: { fontSize: newSize },
      })
    );
  };

  return (
    <>
      <label>
        Font Size:
        <span>
        <input
          type="range"
          min="10"
          max="20"
          step="2"
          value={fontSize}
          onChange={handleFontSizeChange}
        />
        <span className="font-size-value">{fontSize}px</span>
        </span>
      </label>
    </>
  );
};
