import React from "react";
import "./EdgePanelCallout.css";

interface EdgePanelCalloutProps {
  visible: boolean;
  message: string;
}

export const EdgePanelCallout: React.FC<EdgePanelCalloutProps> = ({
  visible,
  message,
}) => {
  if (!visible) return null;

  return (
    <div className="edge-panel-callout" role="status" aria-live="polite">
      {message}
    </div>
  );
};
