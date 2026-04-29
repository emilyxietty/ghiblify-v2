import React from "react";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
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
  const { infoFields, fontSize } = settings;

  return (
    <div className="info-container" style={{ fontSize: `${fontSize}px` }}>
      {infoFields.japaneseTitle && titlejp && (
        <div className="info-item">{titlejp}</div>
      )}
      {infoFields.title && title && <div className="info-item">{title}</div>}
      {infoFields.quote && quote && <div className="info-item">{quote}</div>}
      {infoFields.year && year && <div className="info-item">{year}</div>}
      {infoFields.movieLength && screentime && (
        <div className="info-item">{screentime}</div>
      )}
    </div>
  );
};
