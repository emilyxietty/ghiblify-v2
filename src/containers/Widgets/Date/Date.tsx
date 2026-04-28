import React, { useEffect, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { getLocale, useT } from "../../../i18n/i18n";
import "./Date.css";

// Map our internal locale codes to BCP 47 tags Intl understands.
// Anything missing falls back to "en-US".
const BCP47: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  es: "es-ES",
  fr: "fr-FR",
  zh: "zh-CN",
  pt: "pt-BR",
  ko: "ko-KR",
};

export const DateDisplay: React.FC = () => {
  const { widgets } = useAppContext();
  const dateSettings = widgets.date.settings;
  // Subscribe to locale changes so the formatted date re-renders
  // when the user picks a new language. We don't actually need the
  // `t` return value — the subscription's the point.
  useT();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tag = BCP47[getLocale()] ?? "en-US";
  const formattedDate = currentDate.toLocaleDateString(tag, {
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
