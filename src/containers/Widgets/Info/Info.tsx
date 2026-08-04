import React from "react";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useScaledPx } from "../../../utils/viewportScale";
import "./Info.css";

interface InfoProps {
  titlejp: string;
  title: string;
  year: string;
  screentime: string;
  quote: string;
}

export const Info: React.FC<InfoProps> = ({
  titlejp,
  title,
  year,
  screentime,
  quote,
}) => {
  // Reads canvas settings on canvas, dock-merged settings in the
  // dock — so the user can show different fields in each surface
  // (e.g. just title + quote on the canvas, full breakdown in the
  // dock) without forking the component.
  const { settings } = useWidgetSettings("info");
  const { infoFields, fontSize, textShadow } = settings;
  // settings.fontSize is reference-viewport px (1920 baseline);
  // useScaledPx converts to current-viewport px and re-renders on
  // window resize.
  const scaledFontSize = useScaledPx(fontSize);

  return (
    <div
      className="info-container"
      style={{
        fontSize: `${scaledFontSize}px`,
        // Drives the calc() multiplier on text-shadow alpha in Info.css.
        ["--text-shadow-strength" as never]: `${(textShadow ?? 100) / 100}`,
      }}
    >
      {/* Each field's text is wrapped in an inline <span> so the
          optional highlight can hug the words (and each wrapped line
          of them) instead of painting the full-width row box. Flex
          children are blockified, so the inline box has to be a level
          deeper than the row itself. */}
      {infoFields.japaneseTitle && titlejp && (
        <div className="info-item">
          <span className="info-item-text">{titlejp}</span>
        </div>
      )}
      {infoFields.title && title && (
        <div className="info-item">
          <span className="info-item-text">{title}</span>
        </div>
      )}
      {infoFields.quote && quote && (
        <div className="info-item">
          <span className="info-item-text">{quote}</span>
        </div>
      )}
      {infoFields.year && year && (
        <div className="info-item">
          <span className="info-item-text">{year}</span>
        </div>
      )}
      {infoFields.movieLength && screentime && (
        <div className="info-item">
          <span className="info-item-text">{screentime}</span>
        </div>
      )}
    </div>
  );
};
