import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "./WelcomeModal.css";

interface Slide {
  id: string;
  title: string;
  body: React.ReactNode;
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="welcome-kbd">{children}</kbd>
);

const SLIDES: Slide[] = [
  {
    id: "welcome",
    title: "Welcome to Ghiblify",
    body: (
      <>
        <p>
          A Studio Ghibli–inspired new tab page. Drop in a clock, todo list,
          quick links, search, a pomodoro timer — over a rotating gallery of
          Ghibli film backgrounds.
        </p>
        <p className="welcome-hint">
          Use <Key>←</Key> <Key>→</Key> or the dots to flip through this guide.
        </p>
      </>
    ),
  },
  {
    id: "widgets",
    title: "Show or hide widgets",
    body: (
      <>
        <p>
          Hover the left edge of the screen (or press{" "}
          <Key>Cmd</Key>/<Key>Ctrl</Key>+<Key>K</Key>) to open the sidebar.
        </p>
        <p>
          Tap any of the widget icons to show or hide it. Active widgets glow
          with the current palette's accent color.
        </p>
      </>
    ),
  },
  {
    id: "drag",
    title: "Move widgets around",
    body: (
      <>
        <p>
          Hold <Key>Shift</Key> and click‑drag any widget to reposition it.
          Widgets snap to grid lines (left edge, center, right edge) so they
          stay tidy.
        </p>
        <p className="welcome-hint">
          The cursor turns into a grab hand when Shift is down — that's your
          cue.
        </p>
      </>
    ),
  },
  {
    id: "edit",
    title: "Customize each widget",
    body: (
      <>
        <p>
          Click <em>Edit Widgets</em> in the sidebar (or use the floating
          Done button) to enter edit mode. Each widget exposes its own
          controls — font size, dark mode, 12/24 hour, which fields to show,
          which avatar.
        </p>
        <p>
          A handle in the bottom‑right corner resizes the widget. Press{" "}
          <Key>Esc</Key> or click outside any widget to leave edit mode.
        </p>
      </>
    ),
  },
  {
    id: "appearance",
    title: "Themes &amp; appearance",
    body: (
      <>
        <p>
          The <em>Appearance</em> section has 13 palettes — Ghibli, Spirited
          Away, Howl's, Totoro, Ponyo, Sky, Sakura, Meadow, Bloom, Pastel,
          Cream, Mint, Mono. Pick one and the entire UI retints.
        </p>
        <p>
          The "Widget background" slider tints the inner surfaces (Todo
          rows, SearchBar input, QuickLinks tiles). High contrast forces
          everything to a readable minimum.
        </p>
      </>
    ),
  },
  {
    id: "background",
    title: "Backgrounds &amp; filters",
    body: (
      <>
        <p>
          Adjust blur, brightness, contrast, and saturation of the rotating
          photo background — useful when text gets hard to read against a
          busy frame.
        </p>
        <p>
          Click <em>Select Backgrounds</em> to limit the rotation to your
          favorite Ghibli films.
        </p>
      </>
    ),
  },
  {
    id: "quicklinks",
    title: "Quick links",
    body: (
      <>
        <p>
          Click <strong>+</strong> to add a bookmark — optionally with a
          label, or just the URL. Drag tiles to reorder. The X icon enters
          delete mode; click any link to remove it, then click the check to
          finish.
        </p>
        <p>
          Switch between grid and list layouts from the widget's edit
          controls.
        </p>
      </>
    ),
  },
  {
    id: "pomodoro",
    title: "Pomodoro across tabs",
    body: (
      <p>
        The pomodoro timer stays in sync across every open tab. Only one tab
        actually runs the countdown — the others mirror it via storage
        events. Close the leader tab and another tab silently takes over.
      </p>
    ),
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    body: (
      <ul className="welcome-shortcut-list">
        <li>
          <span className="welcome-shortcut-keys">
            <Key>Cmd</Key>/<Key>Ctrl</Key>+<Key>K</Key>
          </span>
          <span>Open or close the sidebar</span>
        </li>
        <li>
          <span className="welcome-shortcut-keys">
            <Key>Shift</Key> + drag
          </span>
          <span>Move a widget around</span>
        </li>
        <li>
          <span className="welcome-shortcut-keys">
            <Key>Esc</Key>
          </span>
          <span>
            Close the sidebar, popovers, edit mode, or this guide
          </span>
        </li>
        <li>
          <span className="welcome-shortcut-keys">
            <Key>Enter</Key>
          </span>
          <span>Confirm an edit, or exit edit mode</span>
        </li>
        <li>
          <span className="welcome-shortcut-keys">
            <Key>←</Key> <Key>→</Key>
          </span>
          <span>Navigate slides in this guide</span>
        </li>
      </ul>
    ),
  },
];

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ open, onClose }) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= SLIDES.length) return;
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

  const slide = SLIDES[index];
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="welcome-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="welcome-close"
          aria-label="Close guide"
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <div className="welcome-slide-area">
          <div
            key={slide.id}
            className={`welcome-slide ${direction === "back" ? "from-left" : "from-right"}`}
          >
            <h2 id="welcome-title" className="welcome-title">
              {slide.title}
            </h2>
            <div className="welcome-body">{slide.body}</div>
          </div>
        </div>

        <div className="welcome-footer">
          <button
            type="button"
            className="welcome-nav-btn"
            onClick={() => go(index - 1)}
            disabled={isFirst}
            aria-label="Previous slide"
          >
            <ChevronLeftIcon fontSize="small" />
          </button>

          <div className="welcome-dots" role="tablist" aria-label="Guide pages">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.title}
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
              Done
            </button>
          ) : (
            <button
              type="button"
              className="welcome-nav-btn"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
            >
              <ChevronRightIcon fontSize="small" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
