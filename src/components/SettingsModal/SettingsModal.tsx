import React, { useEffect, useMemo, useRef, useState } from "react";
import { clearWeatherLocation } from "../../hooks/useWeather";
import {
  CORNER_STYLES,
  useAppContext,
  type CornerStyle,
} from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import { WeatherSettings } from "../../config/widgetConfig";
import { DEFAULT_FILTERS } from "../../storage/backgroundStorage";
import {
  clearAll,
  listStoredEntries,
  remove as hybridRemove,
  type StoredEntry,
} from "../../storage/hybridStorage";
import {
  useOptionalPermission,
  type OptionalPermission,
} from "../../utils/chromePermissions";
import { CloseIcon, DeleteOutlineIcon, ExpandMoreIcon } from "../Icons/Icons";
import "./SettingsModal.css";

/** Which slice of settings the dialog opens on. Each sidebar section
 *  heading opens its own; the footer button opens "all". */
export type SettingsSection =
  | "all"
  | "widgets"
  | "appearance"
  | "background"
  | "cursor";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  section?: SettingsSection;
}

/**
 * Which storage keys belong to which section.
 *
 * Every key the extension writes is claimed by exactly one group in the
 * "all" view (anything unrecognised falls into `other`), so the list is
 * a complete picture of what's on disk rather than a curated subset - *
 * that's the whole point of an inspector. Scoped dialogs additionally
 * show keys they merely *read*: cursor lives inside `ghiblify_appearance`,
 * so the cursor section lists that key too.
 */
const STORAGE_GROUPS: Array<{ id: string; keys: string[] }> = [
  {
    id: "widgets",
    keys: [
      "ghiblify_widgets",
      "ghiblify_widgets_schema_version",
      "ghiblify_todo",
      "ghiblify_pomodoro",
      "ghiblify_weather",
      "ghiblify_dock_show_bg",
      "ghiblify_recent_colors",
      "ghiblify_search_history",
    ],
  },
  {
    id: "background",
    keys: [
      "ghiblify_background",
      "ghiblify:lastBg",
      "ghiblify_favorites",
      "ghiblify_blacklist",
      "background_selection",
      "background_filters",
    ],
  },
  { id: "appearance", keys: ["ghiblify_appearance", "ghiblify_locale"] },
  {
    id: "other",
    keys: ["ghiblify_setup_done", "ghiblify_guide_seen"],
  },
];

/** Keys a scoped dialog shows, including ones it only reads. */
const SECTION_KEYS: Record<Exclude<SettingsSection, "all">, string[]> = {
  widgets: STORAGE_GROUPS[0].keys,
  background: STORAGE_GROUPS[1].keys,
  appearance: [...STORAGE_GROUPS[2].keys, "ghiblify_recent_colors"],
  cursor: ["ghiblify_appearance"],
};

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${bytes} B`;

/** Pretty-print JSON values; leave plain strings alone. */
const formatValue = (raw: string): string => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

const PermissionRow: React.FC<{
  name: OptionalPermission;
  label: string;
  description: string;
}> = ({ name, label, description }) => {
  const { granted, request, revoke } = useOptionalPermission(name);
  return (
    // A <button>, not a checkbox inside a <label>. Clicking a label
    // forwards a synthetic click to the input, and Chrome doesn't treat
    // that as the user gesture `permissions.request()` demands - the
    // call fails and the switch silently refuses to move. A direct
    // click handler on a real button keeps the gesture intact.
    <button
      type="button"
      role="switch"
      // `granted === null` is "still checking" - render as off rather
      // than flipping the switch under the user a beat later.
      aria-checked={granted === true}
      className="settings-toggle-row"
      onClick={() => {
        if (granted) void revoke();
        else void request();
      }}
    >
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-sub">{description}</span>
      </span>
      <span
        className={`settings-switch${granted ? " is-on" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
};

/** Row with a plain on/off switch, for app state (no Chrome grant
 *  involved, so a label-wrapped checkbox is fine here). */
const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="settings-toggle-row">
    <span className="settings-row-text">
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-sub">{description}</span>
    </span>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="settings-switch" aria-hidden="true" />
  </label>
);

/** Row of mutually-exclusive choices - label + description on the left,
 *  a segmented control on the right. */
const SegmentedRow: React.FC<{
  label: string;
  description: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}> = ({ label, description, options, value, onChange }) => (
  <div className="settings-toggle-row">
    <span className="settings-row-text">
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-sub">{description}</span>
    </span>
    <div className="settings-segmented" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`settings-segment${
            value === opt.value ? " is-active" : ""
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

/**
 * Destructive action button.
 *
 * Everything that deletes goes through a real confirmation dialog
 * rather than an inline "are you sure?" row - an inline prompt is easy
 * to hit twice by accident when the second click lands where the first
 * one did.
 */
const DangerButton: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <button
    type="button"
    className="settings-btn settings-btn-danger"
    onClick={onClick}
  >
    {label}
  </button>
);

interface PendingAction {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => void;
}

const ConfirmDialog: React.FC<{
  action: PendingAction;
  cancelLabel: string;
  onCancel: () => void;
}> = ({ action, cancelLabel, onCancel }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Captured before the settings dialog's own Escape handler so
        // cancelling the confirm doesn't also close everything behind it.
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="settings-confirm-backdrop" onClick={onCancel}>
      <div
        ref={ref}
        className="settings-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="settings-confirm-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="settings-confirm-title" className="settings-confirm-title">
          {action.title}
        </h3>
        <p className="settings-confirm-message">{action.message}</p>
        <div className="settings-confirm-actions">
          <button type="button" className="settings-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-danger"
            onClick={() => action.run()}
          >
            {action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The stored-data list for one area.
 *
 * Every section carries its own copy rather than there being a single
 * list at the bottom: "which of these keys is the background one?" is
 * exactly the question the panel should answer without being asked.
 */
const StorageBlock: React.FC<{
  entries: StoredEntry[];
  expanded: string | null;
  setExpanded: (key: string | null) => void;
  onDelete: (entry: StoredEntry) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}> = ({ entries, expanded, setExpanded, onDelete, t }) => {
  const total = entries.reduce((sum, e) => sum + e.bytes, 0);
  return (
    <div className="settings-storage">
      <div className="settings-storage-head">
        <span className="settings-storage-head-label">
          {t("settings.storedDataLabel")}
        </span>
        <span className="settings-storage-head-meta">
          {t("settings.storageSub", {
            count: entries.length,
            size: formatBytes(total),
          })}
        </span>
      </div>
      <div className="settings-storage-list">
        {entries.length === 0 && (
          <p className="settings-empty">{t("settings.storageEmpty")}</p>
        )}
        {entries.map((entry) => {
          const isOpen = expanded === entry.key;
          return (
            <div className="settings-storage-item" key={entry.key}>
              <div className="settings-storage-row">
                <button
                  type="button"
                  className="settings-storage-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : entry.key)}
                >
                  <ExpandMoreIcon
                    className={`settings-storage-chevron${
                      isOpen ? " is-open" : ""
                    }`}
                    style={{ fontSize: 16 }}
                  />
                  <span className="settings-storage-key">{entry.key}</span>
                </button>
                <span className="settings-storage-size">
                  {formatBytes(entry.bytes)}
                </span>
                <button
                  type="button"
                  className="settings-storage-delete"
                  aria-label={t("settings.deleteKeyAria", { key: entry.key })}
                  data-tooltip={t("settings.deleteKey")}
                  onClick={() => onDelete(entry)}
                >
                  <DeleteOutlineIcon style={{ fontSize: 15 }} />
                </button>
              </div>
              {isOpen && (
                <pre className="settings-storage-value">
                  {formatValue(entry.value)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * App Settings - the one place where saved state can be inspected,
 * toggled and thrown away.
 *
 * The storage list is deliberately raw (real keys, real sizes, real
 * values): it's an inspector, not a curated summary, so a user who
 * wants to know exactly what the extension keeps can see all of it and
 * delete any piece.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  section = "all",
}) => {
  const t = useT();
  const {
    appearance,
    updateAppearance,
    backgroundParallax,
    setBackgroundParallax,
    updateBackgroundFilters,
    dockShowBackgrounds,
    setDockShowBackgrounds,
    resetAllWidgets,
    resetRightSidebar,
    widgets,
    updateWidgetSettings,
  } = useAppContext();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [entries, setEntries] = useState<StoredEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (open) {
      setEntries(listStoredEntries());
      setPending(null);
      dialogRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  const visibleEntries = useMemo(() => {
    if (section === "all") return entries;
    const allowed = new Set(SECTION_KEYS[section]);
    return entries.filter((e) => allowed.has(e.key));
  }, [entries, section]);

  /** Entries bucketed by area, so each section can show the data it
   *  actually owns. Anything unrecognised lands in `other`, which is
   *  what keeps the panel an honest picture of storage rather than a
   *  curated subset. */
  const grouped = useMemo(() => {
    const claimed = new Set<string>();
    const byId: Record<string, StoredEntry[]> = {};
    for (const group of STORAGE_GROUPS) {
      byId[group.id] = visibleEntries.filter((e) => {
        if (!group.keys.includes(e.key)) return false;
        claimed.add(e.key);
        return true;
      });
    }
    byId.other = [
      ...(byId.other ?? []),
      ...visibleEntries.filter((e) => !claimed.has(e.key)),
    ];
    // Cursor has no key of its own - it lives inside the appearance
    // blob, so its section points at that same row.
    byId.cursor = visibleEntries.filter((e) => e.key === "ghiblify_appearance");
    return byId;
  }, [visibleEntries]);

  if (!open) return null;

  const showAll = section === "all";

  const deleteEntry = (entry: StoredEntry) => {
    // Hybrid keys live in chrome.storage too - removing only the
    // localStorage mirror would be undone on the next sync tick.
    if (entry.hybrid) hybridRemove(entry.key);
    else {
      try {
        localStorage.removeItem(entry.key);
      } catch {
        /* ignore */
      }
    }
    setEntries(listStoredEntries());
  };

  const confirmDelete = (entry: StoredEntry) =>
    confirm(
      t("settings.deleteKey"),
      t("settings.deleteKeyConfirm", { key: entry.key }),
      () => deleteEntry(entry),
      t("settings.deleteKey")
    );

  const resetEverything = async () => {
    await clearAll();
    // Reload rather than trying to reset React state in place: half the
    // app read its initial state from storage at mount, so a reload is
    // the only way to guarantee what's on screen matches what's stored.
    window.location.reload();
  };

  const resetBackground = () => {
    updateBackgroundFilters(DEFAULT_FILTERS);
    setBackgroundParallax(false);
  };

  const resetAppearance = () => {
    updateAppearance({
      theme: "ghibli",
      highContrast: false,
      font: "default",
      proportionalScaling: true,
      corners: "rounded",
    });
  };

  /** Route a destructive action through the confirm dialog. */
  const confirm = (
    title: string,
    message: string,
    run: () => void,
    confirmLabel = t("settings.resetConfirmYes")
  ) =>
    setPending({
      title,
      message,
      confirmLabel,
      run: () => {
        setPending(null);
        run();
      },
    });

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          type="button"
          className="settings-close"
          aria-label={t("modal.common.closeAria")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </button>

        <h2 id="app-settings-title" className="settings-title">
          {showAll ? t("settings.title") : t(`settings.section.${section}`)}
        </h2>

        {(showAll || section === "widgets") && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              {t("settings.widgetsTitle")}
            </h3>
            <ToggleRow
              label={t("widgetSettings.proportionalScaling")}
              description={t("widgetSettings.proportionalScalingSub")}
              checked={appearance.proportionalScaling !== false}
              onChange={(v) => updateAppearance({ proportionalScaling: v })}
            />
            <ToggleRow
              label={t("settings.dockBackgrounds")}
              description={t("settings.dockBackgroundsSub")}
              checked={dockShowBackgrounds}
              onChange={setDockShowBackgrounds}
            />
            <div className="settings-actions">
              <DangerButton
                label={t("settings.resetWidgets")}
                onClick={() =>
                  confirm(t("settings.resetWidgets"), t("settings.resetWidgetsConfirm"), resetAllWidgets)
                }
              />
              <DangerButton
                label={t("settings.resetDock")}
                onClick={() =>
                  confirm(t("settings.resetDock"), t("settings.resetDockConfirm"), resetRightSidebar)
                }
              />
            </div>
            <StorageBlock
              entries={grouped.widgets ?? []}
              expanded={expanded}
              setExpanded={setExpanded}
              onDelete={confirmDelete}
              t={t}
            />
          </section>
        )}

        {(showAll || section === "appearance") && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              {t("settings.appearanceTitle")}
            </h3>
            <ToggleRow
              label={t("sidebar.filters.highContrast")}
              description={t("settings.highContrastSub")}
              checked={appearance.highContrast}
              onChange={(v) => updateAppearance({ highContrast: v })}
            />
            <SegmentedRow
              label={t("settings.corners")}
              description={t("settings.cornersSub")}
              options={CORNER_STYLES.map((c) => ({
                value: c,
                label: t(`settings.cornerStyle.${c}`),
              }))}
              value={appearance.corners ?? "rounded"}
              onChange={(v) => updateAppearance({ corners: v as CornerStyle })}
            />
            <div className="settings-actions">
              <DangerButton
                label={t("settings.resetAppearance")}
                onClick={() =>
                  confirm(t("settings.resetAppearance"), t("settings.resetAppearanceConfirm"), resetAppearance)
                }
              />
            </div>
            <StorageBlock
              entries={grouped.appearance ?? []}
              expanded={expanded}
              setExpanded={setExpanded}
              onDelete={confirmDelete}
              t={t}
            />
          </section>
        )}

        {(showAll || section === "background") && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              {t("settings.backgroundTitle")}
            </h3>
            <ToggleRow
              label={t("sidebar.filters.parallax")}
              description={t("settings.parallaxSub")}
              checked={backgroundParallax}
              onChange={setBackgroundParallax}
            />
            <div className="settings-actions">
              <DangerButton
                label={t("settings.resetBackground")}
                onClick={() =>
                  confirm(t("settings.resetBackground"), t("settings.resetBackgroundConfirm"), resetBackground)
                }
              />
            </div>
            <StorageBlock
              entries={grouped.background ?? []}
              expanded={expanded}
              setExpanded={setExpanded}
              onDelete={confirmDelete}
              t={t}
            />
          </section>
        )}

        {(showAll || section === "cursor") && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              {t("settings.cursorTitle")}
            </h3>
            <p className="settings-section-sub">{t("settings.cursorSub")}</p>
            <div className="settings-actions">
              <DangerButton
                label={t("settings.resetCursor")}
                onClick={() =>
                  confirm(t("settings.resetCursor"), t("settings.resetCursorConfirm"), () => updateAppearance({ cursor: "default" }))
                }
              />
            </div>
            {/* Only when the dialog is scoped to cursor: in the full
                view the same `ghiblify_appearance` row already appears
                under Appearance, and listing it twice reads as two
                separate things. */}
            {!showAll && (
            <StorageBlock
              entries={grouped.cursor ?? []}
              expanded={expanded}
              setExpanded={setExpanded}
              onDelete={confirmDelete}
              t={t}
            />
            )}
          </section>
        )}

        {showAll && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              {t("settings.permissionsTitle")}
            </h3>
            <p className="settings-section-sub">
              {t("settings.permissionsSub")}
            </p>
            {/* Not a PermissionRow: Chrome refuses to make `geolocation`
                optional, so there's no runtime grant to flip. This is an
                app-level switch that decides whether the Weather widget
                ever calls the API. */}
            <ToggleRow
              label={t("settings.permissionGeolocation")}
              description={t("settings.permissionGeolocationSub")}
              checked={
                (widgets.weather.settings as WeatherSettings)
                  .useDeviceLocation !== false
              }
              onChange={(v) => {
                updateWidgetSettings("weather", { useDeviceLocation: v });
                // Off must also FORGET: the device coords are cached
                // with a TTL, so without clearing them the widget kept
                // showing your location long after the toggle flipped.
                if (!v) {
                  clearWeatherLocation();
                  window.dispatchEvent(
                    new CustomEvent("ghiblify:weather:refresh")
                  );
                }
              }}
            />
            <PermissionRow
              name="bookmarks"
              label={t("settings.permissionBookmarks")}
              description={t("settings.permissionBookmarksSub")}
            />
            <PermissionRow
              name="audioCapture"
              label={t("settings.permissionMicrophone")}
              description={t("settings.permissionMicrophoneSub")}
            />
            <PermissionRow
              name="identity.email"
              label={t("settings.permissionEmail")}
              description={t("settings.permissionEmailSub")}
            />
          </section>
        )}

        {showAll && (
          <section className="settings-section">
            <h3 className="settings-section-title">
              {t("settings.storageGroup.other")}
            </h3>
            <p className="settings-section-sub">{t("settings.otherSub")}</p>
            <StorageBlock
              entries={grouped.other ?? []}
              expanded={expanded}
              setExpanded={setExpanded}
              onDelete={confirmDelete}
              t={t}
            />
          </section>
        )}

        {showAll && (
          <section className="settings-section settings-danger">
            <h3 className="settings-section-title">
              {t("settings.resetTitle")}
            </h3>
            <p className="settings-section-sub">{t("settings.resetSub")}</p>
            <DangerButton
              label={t("settings.resetButton")}
              onClick={() =>
                confirm(
                  t("settings.resetButton"),
                  t("settings.resetSub"),
                  () => void resetEverything()
                )
              }
            />
          </section>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          action={pending}
          cancelLabel={t("settings.resetConfirmCancel")}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
};

export default SettingsModal;
