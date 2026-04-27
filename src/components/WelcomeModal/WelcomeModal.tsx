import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import BookmarksIcon from "@mui/icons-material/Bookmarks";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import LinkIcon from "@mui/icons-material/Link";
import SearchIcon from "@mui/icons-material/Search";
import TimerIcon from "@mui/icons-material/Timer";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundSettingsModal } from "../BackgroundSettingsModal/BackgroundSettingsModal";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import {
  TimeSettings,
  WidgetKey,
  getWidgetConfig,
} from "../../config/widgetConfig";
import { THEME_NAMES, ThemeName, useAppContext } from "../../contexts/AppContext";
import { LANGUAGES, getLocale, setLocale, useT } from "../../i18n/i18n";
import { Dropdown } from "../Dropdown/Dropdown";
import "./WelcomeModal.css";

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="welcome-kbd">{children}</kbd>
);

// Each slide refers to keys under `welcome.slides.<id>` in the locale dict.
// Interactive slides (widgets / palette / adjustTime / background) embed the
// real controls so changes persist immediately, while spotlight slides also
// pulse the equivalent area in the sidebar so the user learns where the
// control lives long-term.
const SLIDE_IDS = [
  "welcome",
  "findGuide",
  "widgets",
  "palette",
  "adjustTime",
  "drag",
  "rightClick",
  "background",
  "shortcuts",
] as const;

type SlideId = (typeof SLIDE_IDS)[number];

const WIDGET_TUTORIAL_TOGGLES: Array<{
  key: WidgetKey;
  icon: React.ReactElement;
}> = [
  { key: "time", icon: <AccessTimeFilledIcon /> },
  { key: "date", icon: <CalendarTodayIcon /> },
  { key: "greeting", icon: <EmojiEmotionsIcon /> },
  { key: "info", icon: <FormatQuoteIcon /> },
  { key: "todo", icon: <CheckBoxIcon /> },
  { key: "quicklinks", icon: <LinkIcon /> },
  { key: "searchbar", icon: <SearchIcon /> },
  { key: "pomodoro", icon: <TimerIcon /> },
  { key: "bookmarks", icon: <BookmarksIcon /> },
  { key: "weather", icon: <WbSunnyIcon /> },
];

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ open, onClose }) => {
  const t = useT();
  const {
    setSidebarSpotlight,
    widgets,
    toggleWidgetVisibility,
    appearance,
    updateAppearance,
    updateWidgetSettings,
    setEditingWidgetKey,
  } = useAppContext();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
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
    if (slide === "findGuide") {
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

  // Drop the Time widget into edit mode while the adjustTime slide is
  // showing, so the user sees the widget's actual edit-mode chrome
  // (resize handle + EditWidget overlay) on the page above the dialog.
  // Cleanup runs when the slide changes or the modal closes.
  // Also flips a body class so CSS can pulse the 12/24h toggle and
  // the resize handle on the Time widget — pure visual cue that lives
  // alongside the existing sidebar spotlight rules.
  useEffect(() => {
    if (!open) return;
    if (SLIDE_IDS[index] !== "adjustTime") return;
    setEditingWidgetKey("time");
    document.body.classList.add("tutorial-adjust-time");
    return () => {
      setEditingWidgetKey(null);
      document.body.classList.remove("tutorial-adjust-time");
    };
  }, [open, index, setEditingWidgetKey]);

  // On the "right-click for quick actions" slide, programmatically
  // open the Time widget's context menu so the user can see it as a
  // live demo. Widget.tsx listens for these custom events.
  useEffect(() => {
    if (!open) return;
    if (SLIDE_IDS[index] !== "rightClick") return;
    // Defer one frame so the cornered modal layout is committed
    // first, otherwise the widget's bounding rect could be stale.
    const raf = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("ghiblify:open-context-menu", {
          detail: { key: "time" },
        })
      );
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.dispatchEvent(
        new CustomEvent("ghiblify:close-context-menu", {
          detail: { key: "time" },
        })
      );
    };
  }, [open, index]);

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

  const renderWidgetTutorial = () => {
    return (
      <div
        className="welcome-widget-grid"
        role="group"
        aria-label={t("welcome.slides.widgets.title")}
      >
        {WIDGET_TUTORIAL_TOGGLES.map(({ key, icon }) => {
          const visible = widgets[key].visible;
          const name = t(`widgets.names.${key}`);
          return (
            <button
              key={key}
              type="button"
              className={`welcome-widget-toggle${visible ? " is-active" : ""}`}
              onClick={() => toggleWidgetVisibility(key)}
              aria-pressed={visible}
              aria-label={t(
                visible ? "widgets.tooltip.hide" : "widgets.tooltip.show",
                { name }
              )}
              data-tooltip={name}
            >
              <span className="welcome-widget-toggle-icon">{icon}</span>
              <span className="welcome-widget-toggle-label">{name}</span>
            </button>
          );
        })}
        {(() => {
          const visible = widgets.avatar.visible;
          const avatarData = AVATAR_OPTIONS.find(
            (a) => a.value === widgets.avatar.settings.selectedAvatar
          );
          const name = t("widgets.names.avatar");
          return (
            <button
              type="button"
              className={`welcome-widget-toggle${visible ? " is-active" : ""}`}
              onClick={() => toggleWidgetVisibility("avatar")}
              aria-pressed={visible}
              aria-label={t(
                visible ? "widgets.tooltip.hide" : "widgets.tooltip.show",
                { name }
              )}
              data-tooltip={name}
            >
              <span className="welcome-widget-toggle-icon">
                {avatarData ? <img src={avatarData.src} alt="" /> : "A"}
              </span>
              <span className="welcome-widget-toggle-label">{name}</span>
            </button>
          );
        })()}
      </div>
    );
  };

  const renderPaletteTutorial = () => (
    <div
      className="welcome-theme-swatches"
      role="radiogroup"
      aria-label={t("welcome.slides.palette.title")}
    >
      {THEME_NAMES.map((name: ThemeName) => {
        const selected = appearance.theme === name;
        const label = t(`themes.${name}`);
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            data-tooltip={label}
            className={`welcome-theme-swatch theme-${name}${
              selected ? " is-selected" : ""
            }`}
            onClick={() => updateAppearance({ theme: name })}
          />
        );
      })}
    </div>
  );

  const renderAdjustTimeTutorial = () => {
    const time = widgets.time.settings as TimeSettings;
    const cfg = getWidgetConfig("time");
    const bound = cfg.fontSize!;
    return (
      <div className="welcome-adjust-time">
        <div className="welcome-adjust-row">
          <div
            className="welcome-format-toggle"
            role="radiogroup"
            aria-label={t("welcome.slides.adjustTime.fontSizeLabel")}
          >
            <button
              type="button"
              role="radio"
              aria-checked={!time.is24Hour}
              className={`welcome-format-btn${
                !time.is24Hour ? " is-selected" : ""
              }`}
              onClick={() =>
                updateWidgetSettings("time", { is24Hour: false })
              }
            >
              {t("welcome.slides.adjustTime.format12")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={time.is24Hour}
              className={`welcome-format-btn${
                time.is24Hour ? " is-selected" : ""
              }`}
              onClick={() =>
                updateWidgetSettings("time", { is24Hour: true })
              }
            >
              {t("welcome.slides.adjustTime.format24")}
            </button>
          </div>
        </div>
        <label className="welcome-slider-row">
          <span className="welcome-slider-label">
            <span>{t("welcome.slides.adjustTime.fontSizeLabel")}</span>
            <span>{time.fontSize}px</span>
          </span>
          <input
            id="welcome-time-fontsize"
            type="range"
            min={bound.min}
            max={bound.max}
            step={bound.step}
            value={time.fontSize}
            onChange={(e) =>
              updateWidgetSettings("time", {
                fontSize: parseInt(e.target.value),
              })
            }
            className="welcome-slider"
          />
        </label>
      </div>
    );
  };

  const renderBackgroundTutorial = () => (
    <div className="welcome-bg-actions">
      <button
        type="button"
        className="welcome-bg-btn welcome-bg-btn-primary"
        onClick={() => setShowBackgroundPicker(true)}
      >
        {t("welcome.slides.background.open")}
      </button>
    </div>
  );

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
            {renderWidgetTutorial()}
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
            {renderPaletteTutorial()}
            <p className="welcome-hint">{t("welcome.slides.palette.hint")}</p>
          </>
        );
      case "adjustTime":
        return (
          <>
            <p>{t("welcome.slides.adjustTime.body1")}</p>
            {renderAdjustTimeTutorial()}
            <p>
              {t("welcome.slides.adjustTime.body2Pre")}
              <Key>Shift</Key>
              {t("welcome.slides.adjustTime.body2Post")}
            </p>
          </>
        );
      case "drag":
        return (
          <>
            <p>
              {t("welcome.slides.drag.body1Pre")}
              <Key>Shift</Key>
              {t("welcome.slides.drag.body1Post")}
            </p>
            <p>{t("welcome.slides.drag.body2")}</p>
            <p className="welcome-hint">{t("welcome.slides.drag.hint")}</p>
          </>
        );
      case "rightClick":
        return (
          <>
            <p>{t("welcome.slides.rightClick.body1")}</p>
            <p>{t("welcome.slides.rightClick.body2")}</p>
          </>
        );
      case "background":
        return (
          <>
            <p>{t("welcome.slides.background.body1")}</p>
            <p>{t("welcome.slides.background.body2")}</p>
            {renderBackgroundTutorial()}
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
                <Key>Cmd</Key>/<Key>Ctrl</Key>+<Key>B</Key>
              </span>
              <span>{t("welcome.slides.shortcuts.openBookmarks")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>Shift</Key> + drag
              </span>
              <span>{t("welcome.slides.shortcuts.moveWidget")}</span>
            </li>
            <li>
              <span className="welcome-shortcut-keys">
                <Key>Shift</Key> +{" "}
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

  // adjustTime, drag, and rightClick all need the dialog moved out of
  // the viewport center so the Time widget (and its open context
  // menu) is fully visible above the dialog.
  const isAdjustTime = slideId === "adjustTime";
  const isDragSlide = slideId === "drag";
  const isRightClickSlide = slideId === "rightClick";
  const isPaletteSlide = slideId === "palette";
  const isBackgroundSlide = slideId === "background";
  const isCorneredMode = isAdjustTime || isDragSlide || isRightClickSlide;
  // Passthrough lets clicks land on the underlying surfaces (Time
  // widget edit chrome, sidebar, demo context menu) instead of the
  // backdrop. Palette and background slides keep their dim/blur
  // visually but need passthrough so the user can click the spotlit
  // sidebar regions.
  const isPassthrough =
    isCorneredMode || isPaletteSlide || isBackgroundSlide;

  return (
    <>
    <div
      className={`welcome-backdrop${
        isCorneredMode ? " is-cornered-mode" : ""
      }${isPassthrough ? " is-passthrough" : ""}${
        isRightClickSlide ? " is-right-click-spotlight" : ""
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
              className="welcome-nav-btn"
              onClick={() => go(index + 1)}
              aria-label={t("welcome.nextAria")}
            >
              <ChevronRightIcon fontSize="small" />
            </button>
          )}
        </div>
      </div>
    </div>
    {/* Rendered as a sibling (not a child) of the welcome-backdrop so
        that pointer-events: none on the backdrop during passthrough
        slides doesn't cascade into the picker and make it un-clickable. */}
    {showBackgroundPicker && (
      <BackgroundSettingsModal
        showBackgroundSettings={showBackgroundPicker}
        setShowBackgroundSettings={setShowBackgroundPicker}
      />
    )}
    </>
  );
};

export default WelcomeModal;
