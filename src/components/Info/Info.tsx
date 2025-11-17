import React, { useEffect, useState } from "react";
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
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("info_fontSize");
    return saved ? parseInt(saved) : 16;
  });

  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.fontSize) {
        setFontSize(customEvent.detail.fontSize);
      }
    };

    window.addEventListener("infoSettingsChange", handleSettingsChange);

    return () => {
      window.removeEventListener("infoSettingsChange", handleSettingsChange);
    };
  }, []);

  return (
    <div className="info-container" style={{ fontSize: `${fontSize}px` }}>
      {titlejp && <div className="info-item">{titlejp}</div>}
      {title && <div className="info-item">{title}</div>}
      {year && <div className="info-item">{year}</div>}
      {screentime && <div className="info-item">{screentime}</div>}
      {quote && <div className="info-item ">{quote}</div>}
    </div>
  );
};
