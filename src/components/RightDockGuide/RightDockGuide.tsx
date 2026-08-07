import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "../Icons/Icons";
import type { RightDockGuideStep } from "../../contexts/RightDockGuideContext";
import { useT } from "../../i18n/i18n";
import "./RightDockGuide.css";

const GUIDE_STEPS = ["edit", "order", "size"] as const;

interface RightDockGuideProps {
  open: boolean;
  onClose: () => void;
  step: RightDockGuideStep;
  onStepChange: (step: RightDockGuideStep) => void;
}

export const RightDockGuide: React.FC<RightDockGuideProps> = ({
  open,
  onClose,
  step,
  onStepChange,
}) => {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const index = GUIDE_STEPS.indexOf(step);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= GUIDE_STEPS.length) return;
      setDirection(next > index ? "forward" : "back");
      onStepChange(GUIDE_STEPS[next]);
    },
    [index, onStepChange],
  );

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.stopPropagation();
        go(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.stopPropagation();
        go(index - 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [go, index, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const stepClass = `right-dock-guide-${step}`;
    document.body.classList.add("right-dock-guide-open", stepClass);
    return () => {
      document.body.classList.remove("right-dock-guide-open", stepClass);
    };
  }, [open, step]);

  if (!open) return null;

  const isFirst = index === 0;
  const isLast = index === GUIDE_STEPS.length - 1;
  const title = t(`rightDock.guide.${step}Title`);
  const body = t(`rightDock.guide.${step}Body`);

  return createPortal(
    <>
      <div className="right-dock-guide-scrim" aria-hidden="true" />
      <div className="right-dock-guide-backdrop">
        <div
          ref={dialogRef}
          className="right-dock-guide-dialog"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <button
            type="button"
            className="right-dock-guide-close"
            aria-label={t("modal.common.closeAria")}
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </button>

          <div
            key={step}
            className={`right-dock-guide-slide ${
              direction === "back" ? "from-left" : "from-right"
            }`}
          >
            <h2 id={titleId} className="right-dock-guide-title">
              {title}
            </h2>
            {isFirst && (
              <p className="right-dock-guide-intro">
                {t("rightDock.guide.intro")}
              </p>
            )}
            <p className="right-dock-guide-body">{body}</p>
          </div>

          <div className="right-dock-guide-footer">
            <button
              type="button"
              className="right-dock-guide-nav"
              disabled={isFirst}
              onClick={() => go(index - 1)}
              aria-label={t("welcome.previousAria")}
            >
              <ChevronLeftIcon fontSize="small" />
            </button>

            <div
              className="right-dock-guide-dots"
              role="tablist"
              aria-label={t("welcome.tabsAria")}
            >
              {GUIDE_STEPS.map((guideStep, stepIndex) => (
                <button
                  key={guideStep}
                  type="button"
                  role="tab"
                  aria-selected={stepIndex === index}
                  aria-label={t(`rightDock.guide.${guideStep}Title`)}
                  className={`right-dock-guide-dot${
                    stepIndex === index ? " is-active" : ""
                  }`}
                  onClick={() => go(stepIndex)}
                />
              ))}
            </div>

            {isLast ? (
              <button
                type="button"
                className="right-dock-guide-done"
                onClick={onClose}
              >
                {t("welcome.doneButton")}
              </button>
            ) : (
              <button
                type="button"
                className="right-dock-guide-nav"
                onClick={() => go(index + 1)}
                aria-label={t("welcome.nextAria")}
              >
                <ChevronRightIcon fontSize="small" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};
