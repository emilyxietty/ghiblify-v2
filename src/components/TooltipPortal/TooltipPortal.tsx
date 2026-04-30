import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./TooltipPortal.css";

interface TooltipState {
  text: string;
  x: number;
  y: number;
  placement: "top" | "bottom";
}

/**
 * Mount once at the app root. Listens for hover/focus on any element with
 * a `data-tooltip="..."` attribute and renders the tooltip via a portal
 * attached to document.body — so the tooltip can never be clipped by an
 * ancestor `overflow: hidden/auto` container (which is the limitation of
 * the older `[data-tooltip]::after`/`::before` pseudo-element approach).
 */
export const TooltipPortal: React.FC = () => {
  const [tip, setTip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let timeoutId: number | null = null;
    let currentTarget: HTMLElement | null = null;

    const positionFor = (target: HTMLElement): TooltipState | null => {
      const text = target.getAttribute("data-tooltip");
      if (!text) return null;
      const rect = target.getBoundingClientRect();
      // Prefer below; flip above when the target sits in the bottom half
      // of the viewport so the tooltip stays on-screen.
      const placement = rect.bottom > window.innerHeight - 80 ? "top" : "bottom";
      // x is the trigger center. The render-time effect below
      // measures the tooltip's ACTUAL width and clamps if needed —
      // doing it here with the CSS max-width over-clamps short
      // tooltips (e.g. "Default") so they end up shifted far from
      // their trigger.
      const x = rect.left + rect.width / 2;
      const y = placement === "bottom" ? rect.bottom + 8 : rect.top - 8;
      return { text, x, y, placement };
    };

    const show = (target: HTMLElement) => {
      currentTarget = target;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const next = positionFor(target);
        if (next) setTip(next);
      }, 100);
    };

    const hide = () => {
      currentTarget = null;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setTip(null);
    };

    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(
        "[data-tooltip]"
      ) as HTMLElement | null;
      if (!target || target === currentTarget) return;
      show(target);
    };

    const onOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(
        "[data-tooltip]"
      ) as HTMLElement | null;
      if (!target) return;
      // Only hide if leaving the tooltip-bearing element entirely.
      const related = e.relatedTarget as HTMLElement | null;
      if (related && target.contains(related)) return;
      hide();
    };

    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("[data-tooltip]")) show(target);
    };

    const onBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("[data-tooltip]")) hide();
    };

    const onScroll = () => {
      // Reposition while still hovered (or hide if scrolled away).
      if (!currentTarget) return;
      const next = positionFor(currentTarget);
      if (next) setTip(next);
    };

    // Hide the tooltip if its trigger element is removed from the DOM
    // mid-hover (e.g. the user clicks a button that unmounts the widget
    // it sits on — no mouseout fires because the element disappears
    // rather than the cursor leaving it). Without this the tooltip
    // would orphan and stay on screen until the next pointer move.
    const removalObserver = new MutationObserver(() => {
      if (currentTarget && !document.body.contains(currentTarget)) {
        hide();
      }
    });
    removalObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      removalObserver.disconnect();
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return <TooltipBody tip={tip} />;
};

// Measure-and-clamp pass: render at the trigger's center, then in a
// useLayoutEffect grab the actual rendered width and shift the
// tooltip back inside the viewport if it overflows. Using the
// MEASURED width (not max-width) means short tooltips stay anchored
// on their trigger and only long, wrapped ones get clamped.
const TooltipBody: React.FC<{ tip: TooltipState | null }> = ({ tip }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) {
      setAdjusted(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const half = rect.width / 2;
    const margin = 8;
    const minX = half + margin;
    const maxX = window.innerWidth - half - margin;
    const clampedX = Math.max(minX, Math.min(maxX, tip.x));
    setAdjusted({ x: clampedX, y: tip.y });
  }, [tip?.x, tip?.y, tip?.text]);

  if (!tip) return null;
  const x = adjusted?.x ?? tip.x;
  const y = adjusted?.y ?? tip.y;
  return createPortal(
    <div
      ref={ref}
      className={`tooltip-portal is-${tip.placement}`}
      style={{ left: `${x}px`, top: `${y}px` }}
      role="tooltip"
    >
      {tip.text}
    </div>,
    document.body
  );
};

export default TooltipPortal;
