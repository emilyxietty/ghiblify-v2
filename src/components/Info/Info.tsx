import React from "react";
import { useAppContext } from "../../contexts/AppContext";
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
  const { infoSettings, updateInfoSettings } = useAppContext();

  //   useEffect(() => {
  //     const handleSettingsChange = (e: Event) => {
  //       const customEvent = e as CustomEvent;
  //       if (customEvent.detail.fontSize) {
  //         updateInfoSettings({ fontSize: customEvent.detail.fontSize });
  //       }
  //     };
  //     window.addEventListener("infoSettingsChange", handleSettingsChange);
  //     return () => {
  //       window.removeEventListener("infoSettingsChange", handleSettingsChange);
  //     };
  //   }, [updateInfoSettings]);

  const { infoFields, fontSize } = infoSettings;

  return (
    <div className="info-container" style={{ fontSize: `${fontSize}px` }}>
      {infoFields.japaneseTitle && titlejp && (
        <div className="info-item">{titlejp}</div>
      )}
      {infoFields.title && title && <div className="info-item">{title}</div>}
      {infoFields.year && year && <div className="info-item">{year}</div>}
      {infoFields.movieLength && screentime && (
        <div className="info-item">{screentime}</div>
      )}
      {infoFields.quote && quote && <div className="info-item">{quote}</div>}
    </div>
  );
};
