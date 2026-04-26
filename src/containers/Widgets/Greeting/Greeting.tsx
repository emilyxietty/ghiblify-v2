import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import "./Greeting.css";

// Time-of-day buckets. Local time, no timezone gymnastics.
const greetingKeyForHour = (hour: number): string => {
  if (hour < 12) return "greeting.morning";
  if (hour < 18) return "greeting.afternoon";
  return "greeting.evening";
};

export const Greeting: React.FC = () => {
  const t = useT();
  const { widgets, updateWidgetSettings } = useAppContext();
  const { fontSize, name } = widgets.greeting.settings;

  // Re-render on hour boundaries so "Good morning" rolls over to
  // "Good afternoon" without needing a manual refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const now = new Date();
    const msToNextHour =
      (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000;
    const id = window.setTimeout(() => setTick((v) => v + 1), msToNextHour);
    return () => window.clearTimeout(id);
  });

  const hour = new Date().getHours();
  const greeting = t(greetingKeyForHour(hour));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the local draft in sync if `name` changes from elsewhere
  // (e.g. Reset All Widgets).
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) {
      // Small delay so the input is mounted before focus.
      const id = window.setTimeout(() => inputRef.current?.select(), 0);
      return () => window.clearTimeout(id);
    }
  }, [editing]);

  const commit = () => {
    updateWidgetSettings("greeting", { name: draft.trim() });
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  return (
    <div
      className="greeting-widget widget-header"
      style={{ fontSize: `${fontSize}px` }}
    >
      <span className="greeting-text">
        {greeting}
        {", "}
        {editing ? (
          <input
            ref={inputRef}
            className="greeting-name-input"
            type="text"
            value={draft}
            placeholder={t("greeting.namePlaceholder")}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            style={{ fontSize: `${fontSize}px` }}
          />
        ) : (
          <button
            type="button"
            className={`greeting-name${name ? "" : " greeting-name-empty"}`}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            aria-label={t("greeting.editNameAria")}
          >
            {/* When empty, render a non-breaking space so the dashed
                underline still has visible width to click on. */}
            {name || "     "}
          </button>
        )}
      </span>
    </div>
  );
};

export default Greeting;
