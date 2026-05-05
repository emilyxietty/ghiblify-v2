/**
 * Right Dock — slide-in right rail that hosts widgets, mirroring the
 * bookmarks panel's edge-hover UX. Always mounted at the App root so
 * we can detect when the user toggles the rightSidebar widget on
 * (and show a transient hint callout the same way bookmarks does).
 *
 * Visibility flow:
 *   visible=false → nothing rendered (and no edge-hover listener
 *     attached, so the closed state is fully passive).
 *   visible=true  → off-screen by default; reveals when the cursor
 *     reaches the right edge, hides again when the cursor moves
 *     clear of the dock. Esc also closes.
 *
 * Membership picker — a footer "Settings" button reveals a small
 * grid of widget icons (mirrors the LeftSidebar widgets row).
 * Clicking each icon toggles `inRightSidebar` for that widget. This
 * is the only place to add/remove dock widgets — keeps the per-
 * widget right-click menu short and discoverable in one spot.
 */

import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button/Button";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import { WidgetKey } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import { FormatQuoteIcon, RestoreIcon, StickyNote2Icon, WbSunnyIcon } from "../../components/Icons/Icons";
import { AccessTimeFilledIcon, CalendarTodayIcon, CheckBoxIcon, FaceIcon, SettingsIcon } from "../../components/Icons/Icons";
import "./RightDock.css";

// Slightly narrower than the bookmarks panel (360). The dock hosts
// widget cards; 350 was the tightest the user wanted while still
// fitting two half-width cells side-by-side (~150 each after the
// gutter / padding). Mutually exclusive with bookmarks at the
// toggle level. Must match --right-dock-width in RightDock.css.
const DOCK_WIDTH = 350;
const DOCK_EDGE_TRIGGER = 10;

// Widgets the dock can host. Excludes:
//  - rightSidebar (the dock toggle itself)
//  - bookmarks (mutually exclusive with the dock at the toggle level)
//  - greeting + quicklinks + searchbar (their canvas layouts don't
//    compress cleanly into the dock column — name input wraps
//    awkwardly, link grid clips, search input gets stubby).
//  - pomodoro (the timer card has fixed internals + a wide shadow
//    that don't reflow gracefully into the column; canvas-only).
const PICKER_WIDGETS: Array<{ key: WidgetKey; icon: React.ReactElement }> = [
  { key: "time", icon: <AccessTimeFilledIcon /> },
  { key: "date", icon: <CalendarTodayIcon /> },
  { key: "info", icon: <FormatQuoteIcon /> },
  { key: "todo", icon: <CheckBoxIcon /> },
  { key: "weather", icon: <WbSunnyIcon /> },
  { key: "notes", icon: <StickyNote2Icon /> },
  { key: "avatar", icon: <FaceIcon /> },
];

interface RightDockProps {
  /** Drives mounting + the first-toggle hint callout. */
  visible: boolean;
  /** True when at least one widget is routed into the dock. Drives
   *  the empty-state vs widget-stack render. */
  hasWidgets: boolean;
  children?: React.ReactNode;
}

export const RightDock: React.FC<RightDockProps> = ({
  visible,
  hasWidgets,
  children,
}) => {
  const t = useT();
  const {
    isDragging,
    widgets,
    setWidgetInRightSidebar,
    resetRightSidebar,
    dockShowBackgrounds,
    setDockShowBackgrounds,
  } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dockRef = useRef<HTMLElement | null>(null);

  // Show a transient "swipe to right edge" hint the first time the
  // user toggles the dock on (mirrors RightSidebar's bookmarks
  // callout). Tracks previous visible so a reload of an
  // already-enabled dock doesn't re-fire the hint.
  const wasVisible = useRef(visible);
  const [showCallout, setShowCallout] = useState(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setShowCallout(true);
      const id = window.setTimeout(() => setShowCallout(false), 3500);
      wasVisible.current = visible;
      return () => window.clearTimeout(id);
    }
    wasVisible.current = visible;
  }, [visible]);

  // When the widget is toggled off, also close the slide-in.
  useEffect(() => {
    if (!visible) {
      setIsOpen(false);
      setPickerOpen(false);
    }
  }, [visible]);

  // Edge-hover open + outside close. While a widget drag is in
  // flight, suspend the edge trigger so swinging the cursor past the
  // right edge during a drag can't hijack it with a sidebar reveal.
  // While a right-click context menu is active anywhere, also
  // suspend auto-close — the menu portal renders outside the dock's
  // bounds, so moving the cursor onto its items would otherwise
  // close the dock and unmount the menu's owner.
  useEffect(() => {
    if (!visible) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) return;
      // Don't auto-close while any context menu is open. The
      // ContextMenu component portals into <body> with class
      // `.ctx-menu`; a presence check is cheaper than wiring a
      // pubsub between every DockWidget menu and the dock.
      if (document.querySelector(".ctx-menu")) return;
      const w = window.innerWidth;
      const dockWidth = Math.min(DOCK_WIDTH, w);
      if (e.clientX > w - DOCK_EDGE_TRIGGER) setIsOpen(true);
      else if (isOpen && e.clientX < w - dockWidth) {
        setIsOpen(false);
        // Auto-close the picker when the dock itself closes — keeps
        // the next open clean rather than reopening to a stale picker.
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [visible, isOpen, isDragging]);

  // Escape closes the dock so keyboard users can dismiss it without
  // chasing the cursor off-screen.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickerOpen) setPickerOpen(false);
        else setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, pickerOpen]);

  // Mark the dock inert while closed so its contents don't grab
  // keyboard focus or screen reader attention while invisible.
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    if (isOpen) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [isOpen]);

  // Peek-open trigger — fired by AppContext.setWidgetInRightSidebar
  // whenever a widget is routed into the dock. Auto-closes after a
  // short window so the user sees the widget land but the dock
  // doesn't permanently take over the right edge.
  useEffect(() => {
    if (!visible) return;
    const handler = () => {
      setIsOpen(true);
      window.setTimeout(() => setIsOpen(false), 2200);
    };
    window.addEventListener("ghiblify:rightDock:peek", handler);
    return () =>
      window.removeEventListener("ghiblify:rightDock:peek", handler);
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {showCallout && (
        <div
          className="right-dock-callout"
          role="status"
          aria-live="polite"
        >
          {t("rightDock.callout")}
        </div>
      )}
      <aside
        ref={dockRef}
        className={`right-dock${isOpen ? " open" : ""}`}
        aria-label={t("widgets.names.rightSidebar")}
      >
        <div className="right-dock-body">
          {hasWidgets ? (
            children
          ) : (
            <div className="right-dock-empty" aria-hidden="true">
              <div className="right-dock-empty-title">
                {t("rightDock.emptyTitle")}
              </div>
              <div className="right-dock-empty-hint">
                {t("rightDock.emptyHint")}
              </div>
            </div>
          )}
        </div>

        <footer className="right-dock-footer">
          {pickerOpen && (
            <div
              className="right-dock-picker"
              role="group"
              aria-label={t("rightDock.pickerLabel")}
            >
              {PICKER_WIDGETS.map(({ key, icon }) => {
                const active = widgets[key].inRightSidebar;
                const name = t(`widgets.names.${key}`);
                // Mirror the LeftSidebar's avatar tile — show the
                // chosen avatar's image instead of the generic Face
                // glyph so the picker reflects the user's selection.
                let renderedIcon = icon;
                if (key === "avatar") {
                  // Prefer the dock's selectedAvatar override (from
                  // dockSettings) so the picker thumbnail matches
                  // what the dock instance is actually rendering;
                  // fall back to the canvas selection.
                  const dockOverride = widgets.avatar.dockSettings as {
                    selectedAvatar?: string;
                  };
                  const selected =
                    dockOverride.selectedAvatar ??
                    widgets.avatar.settings.selectedAvatar;
                  const avatarData = AVATAR_OPTIONS.find(
                    (a) => a.value === selected,
                  );
                  if (avatarData) {
                    renderedIcon = <img src={avatarData.src} alt="" />;
                  }
                }
                return (
                  <Button
                    key={key}
                    className={`widget-icon${
                      key === "avatar" ? " avatar-with-overlay" : ""
                    }${active ? " active" : ""}`}
                    icon={renderedIcon}
                    size="medium"
                    variant="transparent"
                    onClick={() => setWidgetInRightSidebar(key, !active)}
                    aria-pressed={active}
                    aria-label={name}
                    data-tooltip={name}
                  />
                );
              })}
            </div>
          )}
          {pickerOpen && (
            <>
              <label className="contrast-toggle right-dock-toggle-row">
                <span>{t("rightDock.showBackgroundsLabel")}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={dockShowBackgrounds}
                  onChange={(e) =>
                    setDockShowBackgrounds(e.target.checked)
                  }
                />
                <span className="contrast-switch" aria-hidden="true" />
              </label>
              <Button
                className="right-dock-reset-btn"
                variant="transparent"
                size="small"
                onClick={() => {
                  if (window.confirm(t("rightDock.resetConfirm")))
                    resetRightSidebar();
                }}
                aria-label={t("rightDock.resetLabel")}
                data-tooltip={t("rightDock.resetLabel")}
              >
                <RestoreIcon style={{ fontSize: 14 }} />
                <span>{t("rightDock.resetLabel")}</span>
              </Button>
            </>
          )}
          <Button
            className="right-dock-settings-btn"
            variant="transparent"
            size="medium"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label={t("rightDock.settingsLabel")}
            data-tooltip={t("rightDock.settingsLabel")}
          >
            <SettingsIcon style={{ fontSize: 16 }} />
            <span>{t("rightDock.settingsLabel")}</span>
          </Button>
        </footer>
      </aside>
    </>
  );
};
