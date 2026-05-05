import React, { useEffect, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { getLocale, useT } from "../../../i18n/i18n";
import "./Time.css";

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

export const Time: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { widgets } = useAppContext();
  const timeSettings = widgets.time.settings;
  // Subscribe to locale changes so the time re-renders when the
  // user picks a new language (only matters in 12h mode where the
  // dayPeriod label is locale-specific: AM/PM vs 午前/午後 etc.).
  useT();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Use Intl.DateTimeFormat.formatToParts so we can pull the
  // dayPeriod component out by NAME, not by regex. The previous
  // /^(.+?)\s*([AP]M)$/ only matched Latin "AM"/"PM" and would have
  // left "午後1:45" / "오후 1:45" / "下午1:45" untouched (period would
  // never get split into the small chip). With formatToParts the
  // period chip works in every locale.
  const tag = BCP47[getLocale()] ?? "en-US";
  const fmt = new Intl.DateTimeFormat(tag, {
    hour: "numeric",
    minute: "2-digit",
    hour12: !timeSettings.is24Hour,
  });
  const parts = fmt.formatToParts(currentTime);
  // Digits = everything except the dayPeriod, preserving the
  // separator literals (":") between hour and minute. Trim any
  // leading/trailing whitespace left behind by the period removal.
  const timeDigits = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  const period = parts.find((p) => p.type === "dayPeriod")?.value ?? "";

  // CSS custom property — multiplied into every text-shadow alpha in
  // Time.css. settings.textShadow is 0-200 (% of base); divide by 100
  // to get the multiplier.
  const shadowStyle = {
    "--text-shadow-strength": `${(timeSettings.textShadow ?? 100) / 100}`,
  } as React.CSSProperties;

  return (
    <div className="time-container" style={shadowStyle}>
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
