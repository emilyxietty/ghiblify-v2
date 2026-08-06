import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
} from "../Icons/Icons";
import { useAppContext } from "../../contexts/AppContext";
import { LANGUAGES, getLocale, setLocale, useT } from "../../i18n/i18n";
import { Dropdown } from "../Dropdown/Dropdown";
import "./WelcomeModal.css";

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="welcome-kbd">{children}</kbd>
);

// Each slide refers to keys under `welcome.slides.<id>` in the locale dict.
// Every slide is a SPOTLIGHT: it points at the real control - pulsing
// the sidebar region, or putting a widget into edit mode and glowing
// its actual chrome - rather than embedding a copy of it. Embedded
// duplicates taught a control that doesn't exist outside the tour, and
// drifted from the real one as it changed.
const SLIDE_IDS = [
  "welcome",
  "findGuide",
  "widgets",
  "palette",
  "adjustTime",
  "drag",
  "background",
  "shortcuts",
] as const;

type SlideId = (typeof SLIDE_IDS)[number];

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ open, onClose }) => {
  const t = useT();
  const {
    setSidebarSpotlight,
    setEditingWidgetKey,
  } = useAppContext();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Toggle the sidebar spotlight based on which slide is showing. Each
  // interactive slide that mirrors a sidebar region also pulses that
  // region so users learn where the control lives long-term.
  useEffect(() => {
    if (!open) {
      setSidebarSpotlight(null);
      return;
    }
    const slide = SLIDE_IDS[index];
    if (slide === "welcome") {
      // Not a highlight target - this value tells the sidebar to stay
      // shut for the opening slide.
      setSidebarSpotlight("welcome");
    } else if (slide === "findGuide") {
      setSidebarSpotlight("guide");
    } else if (slide === "widgets") {
      setSidebarSpotlight("widgets");
    } else if (slide === "palette") {
      setSidebarSpotlight("palette");
    } else if (slide === "background") {
      setSidebarSpotlight("background");
    } else {
      setSidebarSpotlight(null);
    }
    return () => setSidebarSpotlight(null);
  }, [open, index, setSidebarSpotlight]);

  // Marks the whole guide session, so CSS can lift any widget edit
  // panel opened during the tour above the guide dialog (see the
  // --z-tutorial-panel note in App.css). Separate from the per-slide
  // class below because right-clicking a widget to edit it is
  // possible on every slide, not just adjustTime.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("guide-open");
    return () => document.body.classList.remove("guide-open");
  }, [open]);

  // Drop the Time widget into edit mode while the adjustTime slide is
  // showing, so the user sees the widget's actual edit-mode chrome
  // (resize handle + EditWidget overlay) on the page above the dialog.
  // Cleanup runs when the slide changes or the modal closes.
  // Also flips a body class so CSS can pulse the 12/24h toggle and
  // the resize handle on the Time widget - pure visual cue that lives
  // alongside the existing sidebar spotlight rules.
  useEffect(() => {
    if (!open) return;
    if (SLIDE_IDS[index] !== "adjustTime") return;
    setEditingWidgetKey("time");
    document.body.classList.add("tutorial-adjust-time");
    // Also open the sidebar toggle's right-click menu for Time - the
    // third route into editing a widget, and the one nobody discovers
    // on their own. Deferred a frame so the sidebar has finished
    // sliding in and the toggle's rect is final.
    const raf = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("ghiblify:open-toggle-menu", {
          detail: { key: "time" },
        }),
      );
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.dispatchEvent(new CustomEvent("ghiblify:close-toggle-menu"));
      setEditingWidgetKey(null);
      document.body.classList.remove("tutorial-adjust-time");
    };
  }, [open, index, setEditingWidgetKey]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= SLIDE_IDS.length) return;
      setDirection(next > index ? "forward" : "back");
      setIndex(next);
    },
    [index]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        go(index - 1);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, index, onClose, go]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const slideId: SlideId = SLIDE_IDS[index];
  const title = t(`welcome.slides.${slideId}.title`);
  const isFirst = index === 0;
  const isLast = index === SLIDE_IDS.length - 1;

  const renderBody = () => {
    switch (slideId) {
      case "welcome":
        return (
          <>
            <div className="welcome-language-row">
              <Dropdown
                className="welcome-language-picker"
                size="small"
                variant="outline-light"
                portal
                direction="down"
                options={LANGUAGES.map((l) => ({
                  value: l.code,
                  label: l.label,
                }))}
                value={getLocale()}
                onChange={(code) => setLocale(code)}
              />
            </div>
            <p>{t("welcome.slides.welcome.body1")}</p>
            <p>{t("welcome.slides.welcome.body2")}</p>
            <p>{t("welcome.slides.welcome.body3")}</p>
            <p className="welcome-hint">
              {t("welcome.slides.welcome.hint")
                .split(/(\s+)/)
                .map((part, i) =>
                  part === "←" || part === "→" ? <Key key={i}>{part}</Key> : part
                )}
            </p>
          </>
        );
      case "findGuide":
        return (
          <>
            <p>
              {t("welcome.slides.findGuide.body1Pre")}
              <Key>Cmd</Key>/<Key>Ctrl</Key>+<Key>K</Key>
              {t("welcome.slides.findGuide.body1Post")}
            </p>
            <p className="welcome-hint">
              {t("welcome.slides.findGuide.hint")}
            </p>
          </>
        );
      case "widgets":
        return (
          <>
            <p>{t("welcome.slides.widgets.body1")}</p>
            <p className="welcome-hint">
              {t("welcome.slides.widgets.body2Pre")}
              <Key>Cmd</Key>/<Key>Ctrl</Key>+<Key>K</Key>
              {t("welcome.slides.widgets.body2Post")}
            </p>
          </>
        );
      case "palette":
        return (
          <>
            <p>{t("welcome.slides.palette.body1")}</p>
            <p>{t("welcome.slides.palette.body2")}</p>
            <p className="welcome-hint">{t("welcome.slides.palette.hint")}</p>
          </>
        );
      case "adjustTime":
        return (
          <>
            <p>{t("welcome.slides.adjustTime.body1")}</p>
            <p>
              {t("welcome.slides.adjustTime.body2Pre")}
              <Key>d</Key>
              {t("welcome.slides.adjustTime.body2Post")}
            </p>
          </>
        );
      case "drag":
        return (
          <>
            <p>
              {t("welcome.slides.drag.body1Pre")}
              <Key>d</Key>
              {t("welcome.slides.drag.body1Sep")}
              <Key>shift</Key>
              {t("welcome.slides.drag.body1Post")}
            </p>
            <p>{t("welcome.slides.drag.body2")}</p>
            <p className="welcome-hint">{t("welcome.slides.drag.hint")}</p>
          </>
        );
      case "background":
        return (
          <>
            <p>{t("welcome.slides.background.body1")}</p>
            <p>{t("welcome.slides.background.body2")}</p>
            <p className="welcome-hint">{t("welcome.slides.background.hint")}</p>
          </>
        );
      case "shortcuts":
        return (
          <ul className="welcome-shortcut-list">
            <li>
              <span className="welcome-shortcut-keys">
                <Key>Cmd</Key>/<Key>Ctrl</Key>+<Key>K</Key>
              </span>
              <span>{t("welcome.slides.shortcuts.openSidebar")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>d</Key> {t("welcome.slides.shortcuts.orSep")}{" "}
                <Key>shift</Key> + drag
              </span>
              <span>{t("welcome.slides.shortcuts.moveWidget")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>d</Key> {t("welcome.slides.shortcuts.orSep")}{" "}
                <Key>shift</Key> +{" "}
                <span className="welcome-icon-key" aria-label="edit pencil icon">
                  <EditIcon style={{ fontSize: 14 }} />
                </span>
              </span>
              <span>{t("welcome.slides.shortcuts.editWidget")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>Esc</Key>
              </span>
              <span>{t("welcome.slides.shortcuts.escape")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>Enter</Key>
              </span>
              <span>{t("welcome.slides.shortcuts.enter")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>←</Key> <Key>→</Key>
              </span>
              <span>{t("welcome.slides.shortcuts.navigateGuide")}</span>
            </li>
          </ul>
        );
    }
  };

  // Slide-specific styling hooks.
  const isAdjustTime = slideId === "adjustTime";
  const isDragSlide = slideId === "drag";
  const isPaletteSlide = slideId === "palette";
  const isBackgroundSlide = slideId === "background";
  // Every slide now uses the cornered (bottom-right) layout so the
  // guide reads as a persistent companion instead of a center-screen
  // modal that obscures the widgets / sidebar / canvas it's pointing
  // at. Passthrough goes hand-in-hand with cornered so the user can
  // interact with the rest of the page (sidebar spotlight, time
  // widget demo, palette pulse) while the guide stays put.
  const isCorneredMode = true;
  const isPassthrough = true;
  // Suppress unused warnings - these are kept for slide-specific
  // styling hooks even though they no longer gate cornered mode.
  void isAdjustTime;
  void isDragSlide;
  void isPaletteSlide;
  void isBackgroundSlide;

  return (
    <>
    <div
      className={`welcome-backdrop${
        isCorneredMode ? " is-cornered-mode" : ""
      }${isPassthrough ? " is-passthrough" : ""}${
        slideId === "welcome" ? " is-welcome-slide" : ""
      }`}
    >
      <div
        ref={dialogRef}
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabIndex={-1}
      >
        <button
          type="button"
          className="welcome-close"
          aria-label={t("welcome.closeAria")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <div className="welcome-slide-area">
          <div
            key={slideId}
            className={`welcome-slide ${direction === "back" ? "from-left" : "from-right"}`}
          >
            <h2 id="welcome-title" className="welcome-title">
              {title}
            </h2>
            <div className="welcome-body">{renderBody()}</div>
          </div>
        </div>

        <div className="welcome-footer">
          <button
            type="button"
            className="welcome-nav-btn"
            onClick={() => go(index - 1)}
            disabled={isFirst}
            aria-label={t("welcome.previousAria")}
          >
            <ChevronLeftIcon fontSize="small" />
          </button>

          <div className="welcome-dots" role="tablist" aria-label={t("welcome.tabsAria")}>
            {SLIDE_IDS.map((id, i) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t(`welcome.slides.${id}.title`)}
                className={`welcome-dot ${i === index ? "is-active" : ""}`}
                onClick={() => go(i)}
              />
            ))}
          </div>

          {isLast ? (
            <button
              type="button"
              className="welcome-done-btn"
              onClick={onClose}
            >
              {t("welcome.doneButton")}
            </button>
          ) : (
            <button
              type="button"
              // Pulses until the first advance - on the opening slide
              // there's nothing else asking to be clicked, and people
              // were sitting on it waiting for something to happen.
              className={`welcome-nav-btn${index === 0 ? " is-pulsing" : ""}`}
              onClick={() => go(index + 1)}
              aria-label={t("welcome.nextAria")}
            >
              <ChevronRightIcon fontSize="small" />
            </button>
          )}
        </div>
      </div>
    </div>
    {/* Pinned to the bottom of the page rather than tucked in the
        dialog's corner: the guide sits in the bottom-right, and a way
        out that lives inside the thing you want to leave is easy to
        miss. Sibling of the backdrop so passthrough's
        pointer-events: none can't cascade into it. */}
    <button
      type="button"
      className="welcome-exit-btn"
      onClick={onClose}
    >
      <CloseIcon style={{ fontSize: 13 }} />
      {t("welcome.exitButton")}
    </button>
    </>
  );
};

export default WelcomeModal;
