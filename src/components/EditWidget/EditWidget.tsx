import React from "react";
import { Button } from "../../components/Button/Button";
import { ListIcon, ViewModuleIcon } from "../Icons/Icons";
import {
  AvatarSettings,
  getWidgetConfig,
  InfoFields,
  InfoSettings,
  isWidgetKey,
  QuicklinksSettings,
  NotesSettings,
  TimeSettings,
  WeatherSettings,
} from "../../config/widgetConfig";
import { useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import { Dropdown } from "../Dropdown/Dropdown";
import { MultiSelectDropdown } from "../MultiSelectDropdown/MultiSelectDropdown";
import "./EditWidget.css";

interface EditWidgetProps {
  showWidgetEdits: boolean;
  isResizing: boolean;
  storageKey?: string;
}

const INFO_FIELD_VALUES = [
  "japaneseTitle",
  "title",
  "year",
  "movieLength",
  "quote",
] as const;

const EditWidget: React.FC<EditWidgetProps> = ({
  showWidgetEdits,
  isResizing,
  storageKey,
}) => {
  const t = useT();
  const { widgets, updateWidgetSettings, appearance } = useAppContext();

  if (!showWidgetEdits || isResizing || !isWidgetKey(storageKey)) return null;

  const widgetConfig = getWidgetConfig(storageKey);
  const settings = widgets[storageKey].settings as Record<string, unknown>;
  const controls = widgetConfig.customControls;

  const setTimeFormat = (fmt: "12h" | "24h" | "analog") => {
    if (fmt === "analog") {
      updateWidgetSettings("time", { analog: true });
    } else {
      updateWidgetSettings("time", {
        analog: false,
        is24Hour: fmt === "24h",
      });
    }
  };

  const toggleQuicklinksGrid = () => {
    const cur = (widgets.quicklinks.settings as QuicklinksSettings).gridMode;
    updateWidgetSettings("quicklinks", { gridMode: !cur });
  };

  const handleWeatherSectionsChange = (selected: string[]) => {
    if (selected.length === 0) return;
    updateWidgetSettings("weather", {
      sections: {
        now: selected.includes("now"),
        hourly: selected.includes("hourly"),
        daily: selected.includes("daily"),
      },
    });
  };

  const handleInfoFieldsChange = (fields: string[]) => {
    if (fields.length === 0) return;
    const infoFields: InfoFields = {
      japaneseTitle: fields.includes("japaneseTitle"),
      title: fields.includes("title"),
      year: fields.includes("year"),
      movieLength: fields.includes("movieLength"),
      quote: fields.includes("quote"),
    };
    updateWidgetSettings("info", { infoFields });
  };

  const handleAvatarChange = (avatar: string) => {
    updateWidgetSettings("avatar", { selectedAvatar: avatar });
  };

  // Source-of-truth is the static widget config — not the merged
  // settings, since legacy localStorage may carry opacity for widgets
  // that no longer support it.
  const isFrost = appearance.theme === "frost";
  // The single slider drives `blur` on Frost (since the widget renders
  // as glass with no surface alpha to tune), and `opacity` everywhere
  // else (where the surface alpha is the visible knob).
  const sliderField: "blur" | "opacity" = isFrost ? "blur" : "opacity";
  let supportsSlider =
    sliderField in (widgetConfig.settings as Record<string, unknown>);
  // Weather's opacity slider only tints the hourly/daily forecast cells.
  // If neither strip is enabled, opacity is a no-op — hide it. Blur
  // applies to the widget shell on Frost regardless.
  if (
    supportsSlider &&
    !isFrost &&
    storageKey === "weather" &&
    !(widgets.weather.settings as WeatherSettings).sections.hourly &&
    !(widgets.weather.settings as WeatherSettings).sections.daily
  ) {
    supportsSlider = false;
  }
  const sliderValue = supportsSlider
    ? Math.round(Number(settings[sliderField]) || 0)
    : 50;
  const handleSliderChange = (value: number) => {
    updateWidgetSettings(storageKey, { [sliderField]: value } as never);
  };

  // Text-shadow strength slider — auto-renders for any widget whose
  // settings include `textShadow` (currently Time, Date, Greeting).
  // Range 0-200; 100 = the historical default. Drives the
  // --text-shadow-strength CSS variable on each widget root.
  const supportsTextShadow = "textShadow" in (widgetConfig.settings as Record<string, unknown>);
  // `??` not `||` — `||` would snap-back to 100 when the user drags
  // to 0 (since 0 is falsy), making the slider appear locked at the
  // bottom of the range.
  const rawTextShadow = settings.textShadow;
  const textShadowValue = supportsTextShadow
    ? Math.round(typeof rawTextShadow === "number" ? rawTextShadow : 100)
    : 100;
  const handleTextShadowChange = (value: number) => {
    updateWidgetSettings(storageKey, { textShadow: value } as never);
  };

  const hasAnyControls = !!(
    widgetConfig.fontSize ||
    widgetConfig.size ||
    widgetConfig.width ||
    widgetConfig.height ||
    controls?.timeFormat ||
    controls?.infoFields ||
    controls?.avatarSelector ||
    controls?.gridMode ||
    controls?.weatherUnit ||
    controls?.weatherSections ||
    controls?.weatherIconStyle ||
    controls?.weatherCard ||
    controls?.notesShowBorder ||
    controls?.pomodoroSize ||
    supportsSlider
  );

  if (!hasAnyControls) {
    return (
      <div className="widget-overlay widget-overlay-empty">
        <span className="widget-overlay-empty-message">
          {t("widgets.edit.noCustomization")}
        </span>
      </div>
    );
  }

  const timeSettings = widgets.time.settings as TimeSettings;
  const timeIs24Hour = timeSettings.is24Hour;
  const timeIsAnalog = !!timeSettings.analog;
  const currentTimeFormat: "12h" | "24h" | "analog" = timeIsAnalog
    ? "analog"
    : timeIs24Hour
      ? "24h"
      : "12h";
  const quicklinksGrid = (widgets.quicklinks.settings as QuicklinksSettings).gridMode;
  const infoFields = (widgets.info.settings as InfoSettings).infoFields;
  const avatarSettings = widgets.avatar.settings as AvatarSettings;
  const weatherSettings = widgets.weather.settings as WeatherSettings;

  return (
    <div className="widget-overlay">
      <div className="widget-controls-container">
        {controls?.timeFormat && (() => {
          const FORMATS: Array<{ key: "12h" | "24h" | "analog"; label: string }> = [
            { key: "12h", label: t("widgets.edit.timeFormat12") },
            { key: "24h", label: t("widgets.edit.timeFormat24") },
            { key: "analog", label: t("widgets.edit.timeFormatAnalog") },
          ];
          return (
            <div
              className="widget-pomodoro-size"
              role="radiogroup"
              aria-label={t("widgets.edit.timeFormatAria")}
              onClick={(e) => e.stopPropagation()}
            >
              {FORMATS.map((f) => (
                <Button
                  key={f.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeFormat(f.key);
                  }}
                  variant={currentTimeFormat === f.key ? "light" : "dark"}
                  size="small"
                  className="btn-text-toggle"
                  icon={f.label}
                  aria-pressed={currentTimeFormat === f.key}
                />
              ))}
            </div>
          );
        })()}
        {controls?.gridMode && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              toggleQuicklinksGrid();
            }}
            title={quicklinksGrid ? t("widgets.edit.gridShowList") : t("widgets.edit.gridShow")}
            variant="dark"
            size="small"
            icon={quicklinksGrid ? <ListIcon /> : <ViewModuleIcon />}
          />
        )}
        {controls?.notesShowBorder && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              const cur =
                (widgets.notes.settings as NotesSettings).showBorder !== false;
              updateWidgetSettings("notes", { showBorder: !cur });
            }}
            title={
              (widgets.notes.settings as NotesSettings).showBorder !== false
                ? t("widgets.edit.notesHideBorderAria")
                : t("widgets.edit.notesShowBorderAria")
            }
            variant={
              (widgets.notes.settings as NotesSettings).showBorder !== false
                ? "light"
                : "dark"
            }
            size="small"
            className="btn-text-toggle"
            icon={
              (widgets.notes.settings as NotesSettings).showBorder !== false
                ? t("widgets.edit.notesHideBorder")
                : t("widgets.edit.notesShowBorder")
            }
          />
        )}
        {controls?.pomodoroSize && (() => {
          // Pomodoro size pill — three-segment selector (S / M / L)
          // that mirrors the right-click radio. Reads the stored
          // value (with legacy "compact" / "regular" mapping) so
          // the active segment shows correctly for older users.
          const raw = (
            widgets.pomodoro.settings as { size?: string }
          ).size ?? "medium";
          // Default-to-medium for any non-current value (covers
          // legacy "compact" / "regular" and any other stale label).
          const cur: "small" | "medium" | "large" =
            raw === "small" || raw === "medium" || raw === "large"
              ? raw
              : "medium";
          const SIZES: Array<{
            key: "small" | "medium" | "large";
            label: string;
          }> = [
            { key: "small", label: t("widgets.edit.pomodoroSizeSmall") },
            { key: "medium", label: t("widgets.edit.pomodoroSizeMedium") },
            { key: "large", label: t("widgets.edit.pomodoroSizeLarge") },
          ];
          return (
            <div
              className="widget-pomodoro-size"
              role="radiogroup"
              aria-label={t("widgets.edit.pomodoroSizeLabel")}
              onClick={(e) => e.stopPropagation()}
            >
              {SIZES.map((s) => (
                <Button
                  key={s.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateWidgetSettings("pomodoro", {
                      size: s.key,
                    } as never);
                  }}
                  variant={cur === s.key ? "light" : "dark"}
                  size="small"
                  className="btn-text-toggle"
                  icon={s.label}
                  aria-pressed={cur === s.key}
                />
              ))}
            </div>
          );
        })()}
        {controls?.weatherUnit && (
          <div onClick={(e) => e.stopPropagation()}>
            {/* Direct two-option select, parity with the icon-style
                Dropdown — the previous click-flip Button forced users
                to remember which way the label pointed (current vs.
                opposite). */}
            <Dropdown
              size="small"
              variant="outline-light"
              portal
              options={(["C", "F"] as const).map((v) => ({
                value: v,
                label: t(`widgets.edit.weatherUnit${v}`),
              }))}
              value={weatherSettings.unit}
              onChange={(v) =>
                updateWidgetSettings("weather", {
                  unit: v as "C" | "F",
                })
              }
            />
          </div>
        )}
        {controls?.weatherIconStyle && (
          <div onClick={(e) => e.stopPropagation()}>
            {/* Pulls the same two options as the right-click cascader so
                the surfaces stay symmetric — picking from either
                writes through updateWidgetSettings the same way. */}
            <Dropdown
              size="small"
              variant="outline-light"
              portal
              options={(["animated", "still"] as const).map((v) => ({
                value: v,
                label: t(`widgets.edit.weatherIconStyle.${v}`),
              }))}
              value={weatherSettings.iconStyle}
              onChange={(v) =>
                updateWidgetSettings("weather", {
                  iconStyle: v as "animated" | "still",
                })
              }
            />
          </div>
        )}
        {controls?.weatherIconsOnly && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              const cur = !!weatherSettings.iconsOnly;
              updateWidgetSettings("weather", { iconsOnly: !cur });
            }}
            title={
              weatherSettings.iconsOnly
                ? t("widgets.edit.weatherIconsOnlyOnAria")
                : t("widgets.edit.weatherIconsOnlyOffAria")
            }
            // Same "variant reflects current state" pattern as
            // weatherCard above — light = on, dark = off.
            variant={weatherSettings.iconsOnly ? "light" : "dark"}
            size="small"
            className="btn-text-toggle"
            icon={t("widgets.edit.weatherIconsOnly")}
          />
        )}
        {controls?.weatherCard && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              const cur = !!weatherSettings.showCard;
              updateWidgetSettings("weather", { showCard: !cur });
            }}
            title={
              weatherSettings.showCard
                ? t("widgets.edit.weatherHideCardAria")
                : t("widgets.edit.weatherShowCardAria")
            }
            variant={weatherSettings.showCard ? "light" : "dark"}
            size="small"
            className="btn-text-toggle"
            icon={
              weatherSettings.showCard
                ? t("widgets.edit.weatherHideCard")
                : t("widgets.edit.weatherShowCard")
            }
          />
        )}
        {controls?.weatherSections && (
          <div onClick={(e) => e.stopPropagation()}>
            <MultiSelectDropdown
              options={(["now", "hourly", "daily"] as const).map((v) => ({
                value: v,
                label: t(`widgets.edit.weatherSections.${v}`),
              }))}
              selectedValues={(["now", "hourly", "daily"] as const).filter(
                (k) => weatherSettings.sections[k]
              )}
              onChange={(vals) => {
                // Enforce min 1 selection (FieldSelector did this for us;
                // MultiSelectDropdown doesn't, so we wrap the handler).
                if (vals.length === 0) return;
                handleWeatherSectionsChange(vals);
              }}
              buttonText={t("widgets.edit.weatherSectionsLabel")}
            />
          </div>
        )}
        {controls?.infoFields && (
          <div onClick={(e) => e.stopPropagation()}>
            <MultiSelectDropdown
              options={INFO_FIELD_VALUES.map((v) => ({
                value: v,
                label: t(`widgets.edit.infoFields.${v}`),
              }))}
              selectedValues={Object.entries(infoFields)
                .filter(([_, v]) => v)
                .map(([k]) => k)}
              onChange={(vals) => {
                if (vals.length === 0) return;
                handleInfoFieldsChange(vals);
              }}
              buttonText={t("widgets.edit.infoFieldsLabel")}
            />
          </div>
        )}
      </div>
      {supportsSlider && (
        <div
          className="widget-opacity-control"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="widget-opacity-label">
            <span>
              {isFrost ? t("widgets.edit.blur") : t("widgets.edit.opacity")}
            </span>
            <span>{sliderValue}%</span>
          </label>
          <input
            id={`widget-${storageKey}-${sliderField}`}
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            aria-valuetext={`${sliderValue} percent`}
            aria-label={
              isFrost
                ? t("widgets.edit.blurAria")
                : t("widgets.edit.opacityAria")
            }
            onChange={(e) => handleSliderChange(parseInt(e.target.value))}
            className="widget-opacity-slider"
          />
        </div>
      )}
      {supportsTextShadow && (
        <div
          className="widget-opacity-control"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="widget-opacity-label">
            <span>{t("widgets.edit.textShadow")}</span>
            <span>{textShadowValue}%</span>
          </label>
          <input
            id={`widget-${storageKey}-textShadow`}
            type="range"
            min={0}
            max={200}
            step={10}
            value={textShadowValue}
            aria-valuetext={`${textShadowValue} percent`}
            aria-label={t("widgets.edit.textShadowAria")}
            onChange={(e) => handleTextShadowChange(parseInt(e.target.value))}
            className="widget-opacity-slider"
          />
        </div>
      )}
    </div>
  );
};

export default EditWidget;
