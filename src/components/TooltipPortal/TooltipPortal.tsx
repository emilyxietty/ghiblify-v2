import React, { useEffect, useState } from "react";
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

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      className={`tooltip-portal is-${tip.placement}`}
      style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
      role="tooltip"
    >
      {tip.text}
    </div>,
    document.body
  );
};

export default TooltipPortal;
