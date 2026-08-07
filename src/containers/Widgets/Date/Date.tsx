import React from "react";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { getIntlLocale, useT } from "../../../i18n/i18n";
import { useNow } from "../../../hooks/useNow";
import { useScaledPx } from "../../../utils/viewportScale";
import "./Date.css";

const slashDate = (date: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .filter((part) =>
      part.type === "year" || part.type === "month" || part.type === "day",
    )
    .map((part) => part.value)
    .join("/");

export const DateDisplay: React.FC = () => {
  const { settings: dateSettings } = useWidgetSettings("date");
  const t = useT();
  const currentDate = useNow();

  const tag = getIntlLocale();
  const fullDate = currentDate.toLocaleDateString(tag, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const displayStyle = dateSettings.displayStyle ?? "long";
  const formattedDate =
    displayStyle === "slash"
      ? slashDate(currentDate, tag)
      : currentDate.toLocaleDateString(
          tag,
          displayStyle === "short"
            ? { year: "numeric", month: "short", day: "numeric" }
            : {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              },
        );

  const scaledFontSize = useScaledPx(dateSettings.fontSize);
  const calendarScale = Math.max(0.72, Math.min(1.35, scaledFontSize / 24));
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstWeekday = new globalThis.Date(year, month, 1).getDay();
  const daysInMonth = new globalThis.Date(year, month + 1, 0).getDate();
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(tag, { weekday: "narrow" }).format(
      new globalThis.Date(2021, 7, index + 1),
    ),
  );

  return (
    <div
      className={`date-container${
        displayStyle === "calendar" ? " is-calendar" : ""
      }`}
      style={{
        fontSize: `${scaledFontSize}px`,
        ["--text-shadow-strength" as never]: `${(dateSettings.textShadow ?? 100) / 100}`,
        ["--date-calendar-width" as never]: `${Math.round(238 * calendarScale)}px`,
        ["--date-calendar-font" as never]: `${Math.max(9, 11 * calendarScale)}px`,
      }}
    >
      {displayStyle === "calendar" ? (
        <div className="date-calendar" aria-label={fullDate}>
          <div className="date-calendar-header">
            {currentDate.toLocaleDateString(tag, {
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="date-calendar-grid date-calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="date-calendar-grid date-calendar-days" aria-hidden="true">
            {Array.from({ length: firstWeekday }, (_, index) => (
              <span className="date-calendar-empty" key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              return (
                <span
                  className={`date-calendar-day${
                    day === currentDate.getDate() ? " is-today" : ""
                  }`}
                  key={day}
                >
                  {day}
                </span>
              );
            })}
          </div>
          <span className="date-calendar-today-label">
            {t("widgets.edit.dateToday")}
          </span>
        </div>
      ) : (
        <div className="date">{formattedDate}</div>
      )}
    </div>
  );
};
