import React, { useEffect, useRef, useState } from "react";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { useScaledPx } from "../../../utils/viewportScale";
import "./Info.css";

interface InfoProps {
  titlejp: string;
  title: string;
  year: string;
  screentime: string;
  quote: string;
}

/** Milliseconds per character. Matches the 55ms the other type-in
 *  widgets use, so a film title types at the same pace as the clock. */
const TYPE_MS = 55;
/** Beat between one line finishing and the next starting, in ticks.
 *  It's what makes the caret hand-off between lines visible. */
const LINE_GAP_TICKS = 2;

interface LineReveal {
  /** Characters of each line that have been typed so far. */
  counts: number[];
  /** Index of the line currently typing, or -1 when nothing is. */
  activeIndex: number;
}

/**
 * Per-line reveal for the type-in option.
 *
 * Counted in JS rather than animated as a clip width in CSS (which is how
 * Time / Date / Greeting do it). Those are one short line whose box IS the
 * text; Info's rows are full-width blocks holding text of wildly different
 * lengths, so `width: 0 -> 100%` typed "1988" in its first two steps and
 * then walked the caret across the rest of an empty 700px row - and a quote
 * wider than the row was clipped by the `nowrap` that effect needs, so its
 * tail never appeared at all.
 *
 * Counting characters ends each line exactly where its text ends and lets
 * the text wrap normally. The untyped remainder stays in the DOM as a
 * hidden span, so the block reserves its finished size from the first
 * frame and nothing reflows as the words fill in.
 */
const useLineTypeIn = (
  lines: string[],
  enabled: boolean,
  /** Restarts the reveal when it changes. The film, not the rows: with
   *  the rows as the trigger, switching a field on from the edit panel
   *  would retype the whole block. A line switched on mid-reveal simply
   *  picks up wherever the count has got to. */
  resetKey: string,
): LineReveal => {
  // Each line starts once the one above it has finished, plus the beat.
  const starts: number[] = [];
  let total = 0;
  for (const line of lines) {
    starts.push(total);
    total += line.length + LINE_GAP_TICKS;
  }

  const [tick, setTick] = useState(0);
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    setTick(0);
    if (!enabled) return;
    // An animated reveal is exactly what this preference is about.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTick(Number.MAX_SAFE_INTEGER);
      return;
    }
    timer.current = window.setInterval(() => setTick((t) => t + 1), TYPE_MS);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, enabled]);

  useEffect(() => {
    if (tick >= total) stop();
  }, [tick, total]);

  if (!enabled) {
    return { counts: lines.map((line) => line.length), activeIndex: -1 };
  }
  const counts = lines.map((line, i) =>
    Math.max(0, Math.min(line.length, tick - starts[i])),
  );
  return {
    counts,
    activeIndex: counts.findIndex((count, i) => count < lines[i].length),
  };
};

export const Info: React.FC<InfoProps> = ({
  titlejp,
  title,
  year,
  screentime,
  quote,
}) => {
  // Reads canvas settings on canvas, dock-merged settings in the
  // dock - so the user can show different fields in each surface
  // (e.g. just title + quote on the canvas, full breakdown in the
  // dock) without forking the component.
  const { settings, inDock } = useWidgetSettings("info");
  const { infoFields, fontSize, textShadow } = settings;
  // settings.fontSize is reference-viewport px (1920 baseline);
  // useScaledPx converts to current-viewport px and re-renders on
  // window resize.
  const scaledFontSize = useScaledPx(fontSize);

  // The rows that will actually render, in reveal order. Built as a list
  // rather than as inline conditionals so the type-in timing below can
  // be computed from the visible lines - with fields switchable off, DOM
  // position is not reveal order.
  const rows = [
    infoFields.japaneseTitle && titlejp ? { key: "titlejp", text: titlejp } : null,
    infoFields.title && title ? { key: "title", text: title } : null,
    infoFields.quote && quote ? { key: "quote", text: quote } : null,
    infoFields.year && year ? { key: "year", text: year } : null,
    infoFields.movieLength && screentime
      ? { key: "screentime", text: screentime }
      : null,
  ].filter((row): row is { key: string; text: string } => row !== null);

  // Type-in is a canvas affordance: the dock copy has never typed (the
  // shell only opts the canvas in), and a dock column re-typing the
  // film blurb next to the canvas one would read as a glitch.
  const { counts, activeIndex } = useLineTypeIn(
    rows.map((row) => row.text),
    settings.typeIn === true && !inDock,
    [titlejp, title, quote, year, screentime].join("|"),
  );

  return (
    <div
      className="info-container"
      style={{
        fontSize: `${scaledFontSize}px`,
        // Drives the calc() multiplier on text-shadow alpha in Info.css.
        ["--text-shadow-strength" as never]: `${(textShadow ?? 100) / 100}`,
      }}
    >
      {/* Each field's text is wrapped in an inline <span> so the
          optional highlight can hug the words (and each wrapped line
          of them) instead of painting the full-width row box. Flex
          children are blockified, so the inline box has to be a level
          deeper than the row itself. */}
      {rows.map((row, i) => (
        <div className="info-item" key={row.key}>
          <span className="info-item-text">
            <span
              className={`info-item-typed${
                activeIndex === i ? " is-typing" : ""
              }`}
            >
              {row.text.slice(0, counts[i])}
            </span>
            {counts[i] < row.text.length && (
              <span className="info-item-pending">
                {row.text.slice(counts[i])}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};
