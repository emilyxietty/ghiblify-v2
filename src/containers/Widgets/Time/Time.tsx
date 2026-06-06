import React, { useEffect, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { getLocale, useT } from "../../../i18n/i18n";
import { useScaledPx } from "../../../utils/viewportScale";
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

  // settings.fontSize is reference-viewport px (designed for 1920);
  // useScaledPx converts to current-viewport px and re-renders on
  // window resize so the clock stays proportional to the screen.
  const scaledFontSize = useScaledPx(timeSettings.fontSize);

  if (timeSettings.analog) {
    // Dial diameter tracks the same fontSize knob digital uses, so
    // the single slider in EditWidget sizes both modes consistently.
    const diameter = scaledFontSize * 1.6;
    const h = currentTime.getHours() % 12;
    const m = currentTime.getMinutes();
    const s = currentTime.getSeconds();
    // 30° per hour, 6° per minute — plus a continuous offset so the
    // hour and minute hands creep smoothly between ticks instead of
    // snapping. No second hand by design (calmer Ghibli vibe).
    const hourAngle = h * 30 + m * 0.5;
    const minuteAngle = m * 6 + s * 0.1;
    return (
      <div className="time-container" style={shadowStyle}>
        <svg
          className="time-analog"
          width={diameter}
          height={diameter}
          viewBox="0 0 100 100"
          aria-label={timeDigits}
          role="img"
        >
          {/* Frosted face — fully transparent fill; the wrapper's
              backdrop-filter blurs the wallpaper behind it. */}
          <circle cx="50" cy="50" r="48" className="time-analog-face" />
          {/* Twelve numeral dots — chunky cardinal dots at 12/3/6/9
              and smaller ones in between, like little soot sprite eyes. */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const cx = 50 + Math.sin(angle) * 36;
            const cy = 50 - Math.cos(angle) * 36;
            const isCardinal = i % 3 === 0;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isCardinal ? 2.4 : 1.4}
                className={`time-analog-tick${
                  isCardinal ? " time-analog-tick-cardinal" : ""
                }`}
              />
            );
          })}
          <line
            x1="50"
            y1="56"
            x2="50"
            y2="26"
            className="time-analog-hand time-analog-hand-hour"
            transform={`rotate(${hourAngle} 50 50)`}
          />
          <line
            x1="50"
            y1="56"
            x2="50"
            y2="14"
            className="time-analog-hand time-analog-hand-minute"
            transform={`rotate(${minuteAngle} 50 50)`}
          />
          {/* Center pin: outer blush + inner ink dot, like a little
              flower button. */}
          <circle cx="50" cy="50" r="3.4" className="time-analog-pin-outer" />
          <circle cx="50" cy="50" r="1.6" className="time-analog-pin" />
        </svg>
      </div>
    );
  }

  return (
    <div className="time-container" style={shadowStyle}>
      <div className="time" style={{ fontSize: `${scaledFontSize}px` }}>
        {timeDigits}
        {period && (
          <span
            className="time-period"
            style={{ fontSize: `${scaledFontSize * 0.2}px` }}
          >
            {period}
          </span>
        )}
      </div>
    </div>
  );
};
