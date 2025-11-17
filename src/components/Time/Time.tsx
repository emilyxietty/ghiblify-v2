import React, { useEffect, useState } from "react";
import "./Time.css";

export const Time: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("time_fontSize");
    return saved ? parseInt(saved) : 48;
  });
  const [is24Hour, setIs24Hour] = useState(() => {
    const saved = localStorage.getItem("time_is24Hour");
    return saved === "true";
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.fontSize !== undefined) {
        setFontSize(customEvent.detail.fontSize);
      }
      if (customEvent.detail.is24Hour !== undefined) {
        setIs24Hour(customEvent.detail.is24Hour);
      }
    };

    window.addEventListener("timeSettingsChange", handleSettingsChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener("timeSettingsChange", handleSettingsChange);
    };
  }, []);

  const hours = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: !is24Hour,
  });

  // Split time and period (AM/PM) for 12-hour format
  const timeParts = hours.match(/^(.+?)\s*([AP]M)$/);
  const timeDigits = timeParts ? timeParts[1] : hours;
  const period = timeParts ? timeParts[2] : "";

  return (
    <div className="time-container">
      <div className="time" style={{ fontSize: `${fontSize}px` }}>
        {timeDigits}
        {period && (
          <span
            className="time-period"
            style={{ fontSize: `${fontSize * 0.2}px` }}
          >
            {period}
          </span>
        )}
      </div>
    </div>
  );
};
