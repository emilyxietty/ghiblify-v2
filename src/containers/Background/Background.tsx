import React from "react";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
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
  const t = useT();
  const { isDragging } = useAppContext();

  if (loading) {
    return <div className="background-loading"></div>;
  }

  if (!currentBackground) {
    return (
      <div className="background-error">
        <p>{t("background.loadingError")}</p>
      </div>
    );
  }

  const backgroundFilterStyle: React.CSSProperties = {
    backgroundImage: `url(${currentBackground})`,
    filter: `blur(${backgroundFilters.blur}px) brightness(${backgroundFilters.brightness}%) contrast(${backgroundFilters.contrast}%) saturate(${backgroundFilters.saturation}%)`,
  };

  return (
    <div className="background">
      {/* No onContextMenu here — right-click on the empty background
          area falls through to Chrome's native menu (back / forward
          / reload / save image / inspect). Widgets still get our
          custom menu via their own onContextMenu (which calls
          stopPropagation so this never fires for widget right-clicks). */}
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
