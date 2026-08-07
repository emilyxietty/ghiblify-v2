import React from "react";
import { useT } from "../../i18n/i18n";
import "./SurfaceStylePicker.css";

export type SurfaceStyleValue = "clear" | "frost" | "frostDark" | "weather";

interface SurfaceStylePickerProps {
  value: SurfaceStyleValue;
  options: readonly SurfaceStyleValue[];
  ariaLabel: string;
  onChange: (value: SurfaceStyleValue) => void;
  onPreviewChange?: (value: SurfaceStyleValue | null) => void;
}

const LABEL_KEYS: Record<SurfaceStyleValue, string> = {
  clear: "widgets.edit.styleClear",
  frost: "widgets.edit.styleFrost",
  frostDark: "widgets.edit.styleFrostDark",
  weather: "widgets.edit.styleWeather",
};

export const SurfaceStylePicker: React.FC<SurfaceStylePickerProps> = ({
  value,
  options,
  ariaLabel,
  onChange,
  onPreviewChange,
}) => {
  const t = useT();

  return (
    <div
      className="surface-style-picker"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const label = t(LABEL_KEYS[option]);
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            aria-label={label}
            data-tooltip={label}
            className={`surface-style-option surface-style-${option}${
              value === option ? " is-active" : ""
            }`}
            onMouseEnter={() => onPreviewChange?.(option)}
            onMouseLeave={() => onPreviewChange?.(null)}
            onFocus={() => onPreviewChange?.(option)}
            onBlur={() => onPreviewChange?.(null)}
            onClick={(event) => {
              event.stopPropagation();
              onPreviewChange?.(null);
              onChange(option);
            }}
          />
        );
      })}
    </div>
  );
};
