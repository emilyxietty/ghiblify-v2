import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Z_FLOATING } from "../../../utils/zLayers";
import "./MultiSelectDropdown.css";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  buttonText?: string;
  onOptionPreview?: (value: string) => void;
  onPreviewEnd?: () => void;
  /** Render the menu into <body> at fixed coordinates. Needed inside
   *  scrolling or transformed containers - in the widget edit panel the
   *  in-flow menu was clipped by the panel's own overflow. */
  portal?: boolean;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select fields...",
  buttonText = "Fields",
  onOptionPreview,
  onPreviewEnd,
  portal = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );

  // Position the portalled menu under the toggle, clamped to the
  // viewport. Right-aligned with the toggle, matching the in-flow
  // variant's `right: 0`.
  useLayoutEffect(() => {
    if (!portal || !isOpen) return;
    const place = () => {
      const trigger = toggleRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!trigger || !menu) return;
      const left = Math.min(
        Math.max(8, trigger.right - menu.width),
        window.innerWidth - menu.width - 8
      );
      const below = trigger.bottom + 4;
      const top =
        below + menu.height + 8 <= window.innerHeight
          ? below
          : Math.max(8, trigger.top - menu.height - 4);
      setMenuPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [portal, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // The portalled menu isn't a DOM descendant of the trigger, so
      // it needs its own containment check or clicking an option would
      // read as an outside click and close the menu mid-selection.
      if (dropdownRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
      onPreviewEnd?.();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onPreviewEnd]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) onPreviewEnd?.();
    setIsOpen(!isOpen);
  };

  const handleOptionToggle = (value: string) => {
    onPreviewEnd?.();
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <div ref={dropdownRef} className="multi-select-dropdown">
      <button
        ref={toggleRef}
        type="button"
        className="multi-select-toggle"
        onClick={handleToggle}
      >
        <span>{buttonText}</span>
        <span className={`multi-select-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {isOpen &&
        (() => {
          const menu = (
        <div
          ref={menuRef}
          className={`multi-select-menu${portal ? " is-portalled" : ""}`}
          role="menu"
          style={
            portal
              ? {
                  position: "fixed",
                  top: menuPos?.top ?? -9999,
                  left: menuPos?.left ?? -9999,
                  zIndex: Z_FLOATING,
                }
              : undefined
          }
        >
          {options.map((option) => {
            const checked = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className={`multi-select-option${checked ? " is-selected" : ""}`}
                onMouseEnter={() => onOptionPreview?.(option.value)}
                onMouseLeave={onPreviewEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionToggle(option.value);
                }}
              >
                <span className="multi-select-check" aria-hidden="true">
                  {checked ? "✓" : ""}
                </span>
                <span className="multi-select-label">{option.label}</span>
              </button>
            );
          })}
        </div>
          );
          return portal ? createPortal(menu, document.body) : menu;
        })()}
    </div>
  );
};
