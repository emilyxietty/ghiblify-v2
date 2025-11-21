import React, { useEffect, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import "./Time.css";

export const Time: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { timeSettings } = useAppContext();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: !timeSettings.is24Hour,
  });

  // Split time and period (AM/PM) for 12-hour format
  const timeParts = hours.match(/^(.+?)\s*([AP]M)$/);
  const timeDigits = timeParts ? timeParts[1] : hours;
  const period = timeParts ? timeParts[2] : "";

  return (
    <div className="time-container">
      <div className="time" style={{ fontSize: `${timeSettings.fontSize}px` }}>
        {timeDigits}
        {period && (
          <span
            className="time-period"
            style={{ fontSize: `${timeSettings.fontSize * 0.2}px` }}
          >
            {period}
          </span>
        )}
      </div>
    </div>
  );
};
