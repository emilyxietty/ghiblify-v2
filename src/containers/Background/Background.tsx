import React from "react";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import "./Background.css";

interface BackgroundProps {
  children: React.ReactNode;
  currentBackground: string;
  loading: boolean;
  backgroundFilters: BackgroundFilters;
  showWidgetEdits: boolean;
}

export const Background: React.FC<BackgroundProps> = ({
  children,
  currentBackground,
  loading,
  backgroundFilters,
  showWidgetEdits,
}) => {
  const { isDragging } = useAppContext();

  if (loading) {
    return <div className="background-loading"></div>;
  }

  if (!currentBackground) {
    return (
      <div className="background-error">
        <p>No background found. Check console for errors.</p>
      </div>
    );
  }

  const backgroundFilterStyle: React.CSSProperties = {
    backgroundImage: `url(${currentBackground})`,
    filter: `blur(${backgroundFilters.blur}px) brightness(${backgroundFilters.brightness}%) contrast(${backgroundFilters.contrast}%) saturate(${backgroundFilters.saturation}%)`,
  };

  return (
    <div className="background">
      {isDragging && <div className="grid-overlay" />}
      <div className="background-filter" style={backgroundFilterStyle} />
      <div className="background-content">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              showDragHandle: showWidgetEdits,
            });
          }
          return child;
        })}
      </div>
    </div>
  );
};
