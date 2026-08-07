/**
 * Right Dock - slide-in right rail that hosts widgets, mirroring the
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
 * The compact footer separates adding widgets from panel settings.
 * Widget-specific controls remain on each widget's right-click menu.
 */

import React, { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { EdgePanelCallout } from "../../components/EdgePanelCallout/EdgePanelCallout";
import {
  AddIcon,
  HelpOutlineIcon,
  RestoreIcon,
  SettingsIcon,
} from "../../components/Icons/Icons";
import { RightDockGuide } from "../../components/RightDockGuide/RightDockGuide";
import {
  SurfaceStylePicker,
  type SurfaceStyleValue,
} from "../../components/SurfaceStylePicker/SurfaceStylePicker";
import { WidgetIcon } from "../../components/WidgetIcon/WidgetIcon";
import { Time } from "../Widgets/Time/Time";
import { DockWidget } from "./DockWidget";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import { DOCK_WIDGET_KEYS } from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import {
  RightDockGuideContext,
  type RightDockGuideStep,
} from "../../contexts/RightDockGuideContext";
import { useEdgePanel } from "../../hooks/useEdgePanel";
import { useT } from "../../i18n/i18n";
import "./RightDock.css";

// Slightly narrower than the bookmarks panel (360). The dock hosts
// widget cards; 350 was the tightest the user wanted while still
// fitting two half-width cells side-by-side (~150 each after the
// gutter / padding). Mutually exclusive with bookmarks at the
// toggle level. Must match --right-dock-width in RightDock.css.
const DOCK_WIDTH = 350;
const DOCK_EDGE_TRIGGER = 10;

const panelSurfaceSettings = (style: SurfaceStyleValue) => ({
  frosted: style === "frost" || style === "frostDark",
  frostDark: style === "frostDark",
});

const getPanelSurface = (settings: {
  frosted?: boolean;
  frostDark?: boolean;
}): SurfaceStyleValue =>
  settings.frosted
    ? settings.frostDark
      ? "frostDark"
      : "frost"
    : "clear";

type FooterPanel = "widgets" | "settings";

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
    widgetsCommitted,
    previewWidgetSettings,
    setWidgetInRightSidebar,
    updateWidgetSettings,
    resetRightSidebar,
  } = useAppContext();
  const [footerPanel, setFooterPanel] = useState<FooterPanel | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState<RightDockGuideStep>("edit");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const {
    isOpen,
    setIsOpen,
    showCallout,
    panelRef: dockRef,
  } = useEdgePanel({
    visible,
    panelWidth: DOCK_WIDTH,
    edgeTrigger: DOCK_EDGE_TRIGGER,
    interactionLocked: isDragging,
    shouldKeepOpen: () =>
      resetConfirmOpen ||
      guideOpen ||
      !!document.querySelector(
        ".ctx-menu, .edit-panel[data-edit-surface='dock']",
      ),
    onAutoClose: () => setFooterPanel(null),
    onEscapeBeforeClose: () => {
      if (guideOpen) {
        setGuideOpen(false);
        return true;
      }
      if (!footerPanel) return false;
      setFooterPanel(null);
      return true;
    },
  });

  useEffect(() => {
    if (!visible) {
      setFooterPanel(null);
      setGuideOpen(false);
      setGuideStep("edit");
      setResetConfirmOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (footerPanel !== "settings") {
      previewWidgetSettings("rightSidebar", null);
    }
  }, [footerPanel, previewWidgetSettings]);

  useEffect(() => {
    if (guideOpen) setIsOpen(true);
  }, [guideOpen, setIsOpen]);

  // Peek-open trigger - fired by AppContext.setWidgetInRightSidebar
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

  const showTemporaryGuideTime = guideOpen && !widgets.time.inRightSidebar;
  const panelSurface = getPanelSurface(widgets.rightSidebar.settings);
  const selectedPanelSurface = getPanelSurface(
    widgetsCommitted.rightSidebar.settings,
  );

  return (
    <RightDockGuideContext.Provider
      value={{
        open: guideOpen,
        step: guideStep,
        onWidgetEdit: (key) => {
          if (guideOpen && guideStep === "edit" && key === "time") {
            setGuideStep("order");
          }
        },
      }}
    >
      <EdgePanelCallout
        visible={showCallout}
        message={t("rightDock.callout")}
      />
      <aside
        ref={dockRef}
        className={`right-dock${isOpen ? " open" : ""} panel-${panelSurface}`}
        aria-label={t("widgets.names.rightSidebar")}
      >
        <div className="right-dock-body">
          {showTemporaryGuideTime && (
            <DockWidget storageKey="time" visible guidePreview>
              <Time />
            </DockWidget>
          )}
          {hasWidgets && children}
          {!hasWidgets && !showTemporaryGuideTime && (
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
          {footerPanel && (
            <div
              id="right-dock-footer-panel"
              className={`right-dock-settings-panel panel-${footerPanel}`}
            >
              <div className="right-dock-panel-title">
                {t(
                  footerPanel === "widgets"
                    ? "rightDock.addWidgetsLabel"
                    : "rightDock.settingsLabel",
                )}
              </div>
              {footerPanel === "widgets" ? (
                <div
                  className="right-dock-picker"
                  role="group"
                  aria-label={t("rightDock.pickerLabel")}
                >
                  {DOCK_WIDGET_KEYS.map((key) => {
                    const active = widgets[key].inRightSidebar;
                    const name = t(`widgets.names.${key}`);
                    let renderedIcon: React.ReactElement = (
                      <WidgetIcon storageKey={key} />
                    );
                    if (key === "avatar") {
                      const dockOverride = widgets.avatar.dockSettings as {
                        selectedAvatar?: string;
                      };
                      const selected =
                        dockOverride.selectedAvatar ??
                        widgets.avatar.settings.selectedAvatar;
                      const avatarData = AVATAR_OPTIONS.find(
                        (avatar) => avatar.value === selected,
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
              ) : (
                <div className="right-dock-settings-list">
                  <div className="right-dock-setting-row">
                    <span>{t("rightDock.panelBackgroundLabel")}</span>
                    <SurfaceStylePicker
                      value={selectedPanelSurface}
                      options={["clear", "frost", "frostDark"]}
                      ariaLabel={t("rightDock.panelBackgroundLabel")}
                      onChange={(style) =>
                        updateWidgetSettings(
                          "rightSidebar",
                          panelSurfaceSettings(style),
                        )
                      }
                      onPreviewChange={(style) =>
                        previewWidgetSettings(
                          "rightSidebar",
                          style ? panelSurfaceSettings(style) : null,
                        )
                      }
                    />
                  </div>
                  <div className="right-dock-setting-row">
                    <span>{t("rightDock.resetLabel")}</span>
                    <Button
                      className="right-dock-reset-btn"
                      variant="transparent"
                      size="small"
                      icon={<RestoreIcon style={{ fontSize: 15 }} />}
                      onClick={() => setResetConfirmOpen(true)}
                      aria-label={t("rightDock.resetLabel")}
                      data-tooltip={t("rightDock.resetLabel")}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="right-dock-footer-actions">
            <Button
              className="right-dock-footer-btn right-dock-add-btn"
              variant="transparent"
              size="medium"
              icon={<AddIcon style={{ fontSize: 20 }} />}
              onClick={() => {
                setGuideOpen(false);
                setFooterPanel((panel) =>
                  panel === "widgets" ? null : "widgets",
                );
              }}
              aria-controls="right-dock-footer-panel"
              aria-expanded={footerPanel === "widgets"}
              aria-label={t("rightDock.addWidgetsLabel")}
              data-tooltip={t("rightDock.addWidgetsLabel")}
            />
            <Button
              className="right-dock-footer-btn"
              variant="transparent"
              size="medium"
              icon={<HelpOutlineIcon style={{ fontSize: 18 }} />}
              onClick={() => {
                setFooterPanel(null);
                setGuideStep("edit");
                setGuideOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={guideOpen}
              aria-label={t("rightDock.guide.button")}
              data-tooltip={t("rightDock.guide.button")}
            />
            <Button
              className="right-dock-footer-btn"
              variant="transparent"
              size="medium"
              icon={<SettingsIcon style={{ fontSize: 18 }} />}
              onClick={() => {
                setGuideOpen(false);
                setFooterPanel((panel) =>
                  panel === "settings" ? null : "settings",
                );
              }}
              aria-controls="right-dock-footer-panel"
              aria-expanded={footerPanel === "settings"}
              aria-label={t("rightDock.settingsLabel")}
              data-tooltip={t("rightDock.settingsLabel")}
            />
          </div>
        </footer>
      </aside>
      <ConfirmDialog
        open={resetConfirmOpen}
        title={t("rightDock.resetLabel")}
        message={t("rightDock.resetConfirm")}
        confirmLabel={t("rightDock.resetLabel")}
        cancelLabel={t("settings.resetConfirmCancel")}
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          setResetConfirmOpen(false);
          setFooterPanel(null);
          resetRightSidebar();
        }}
      />
      <RightDockGuide
        open={guideOpen}
        step={guideStep}
        onStepChange={setGuideStep}
        onClose={() => setGuideOpen(false)}
      />
    </RightDockGuideContext.Provider>
  );
};
