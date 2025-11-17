import React, { useEffect, useState } from "react";
import "./Date.css";

export const DateDisplay: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("date_fontSize");
    return saved ? parseInt(saved) : 24;
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.fontSize) {
        setFontSize(customEvent.detail.fontSize);
      }
    };

    window.addEventListener("dateSettingsChange", handleSettingsChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener("dateSettingsChange", handleSettingsChange);
    };
  }, []);

  const formattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="date-container">
      <div className="date" style={{ fontSize: `${fontSize}px` }}>
        {formattedDate}
      </div>
    </div>
  );
};
