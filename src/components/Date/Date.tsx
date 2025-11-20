import React, { useEffect, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import "./Date.css";

export const DateDisplay: React.FC = () => {
  const { dateSettings, updateDateSettings } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());

  //   useEffect(() => {
  //     const handleSettingsChange = (e: Event) => {
  //       const customEvent = e as CustomEvent;
  //       if (customEvent.detail.fontSize) {
  //         updateDateSettings({ fontSize: customEvent.detail.fontSize });
  //       }
  //     };
  //     window.addEventListener("dateSettingsChange", handleSettingsChange);
  //     return () => {
  //       window.removeEventListener("dateSettingsChange", handleSettingsChange);
  //     };
  //   }, [updateDateSettings]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="date-container"
      style={{ fontSize: `${dateSettings.fontSize}px` }}
    >
      <div className="date">{formattedDate}</div>
    </div>
  );
};
