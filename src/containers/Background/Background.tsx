import React, { useState } from "react";
import { ReactComponent as IconSettings } from "../../assets/icons/IconSettings.svg";
import "./Background.css";

interface BackgroundProps {
  children: React.ReactNode;
  currentBackground: string;
  loading: boolean;
}

export const Background: React.FC<BackgroundProps> = ({
  children,
  currentBackground,
  loading,
}) => {
  const [showDragHandles, setShowDragHandles] = useState(false);

  if (loading) {
    return (
      <div className="background-loading">
        <p>Loading Ghiblify...</p>
      </div>
    );
  }

  if (!currentBackground) {
    return (
      <div className="background-error">
        <p>No background found. Check console for errors.</p>
      </div>
    );
  }

  const backgroundStyle: React.CSSProperties = {
    backgroundImage: `url(${currentBackground})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  const toggleSettings = () => {
    setShowDragHandles(!showDragHandles);
  };

  const resetAllPositions = () => {
    // Clear all widget positions from localStorage
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.includes("_position_")) {
        localStorage.removeItem(key);
      }
    });
    console.log("All widget positions reset");
    // Reload the page to apply the reset
    window.location.reload();
  };

  return (
    <div className="background" style={backgroundStyle}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            showDragHandle: showDragHandles,
          });
        }
        return child;
      })}
      <div className="settings-controls">
        <button className="settings-button" onClick={toggleSettings}>
          <IconSettings className="settings-icon" />
        </button>
        {showDragHandles && (
          <button className="reset-all-button" onClick={resetAllPositions}>
            ↺ Reset All
          </button>
        )}
      </div>
    </div>
  );
};
