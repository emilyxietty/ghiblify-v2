import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Z_FLOATING } from "../../utils/zLayers";
import "./Dropdown.css";

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const MENU_MAX_HEIGHT = 300;

export interface DropdownOption {
  value: string;
  /** A node, not just a string, so an option can preview what it does - *
  a font name rendered in its own family, a chip drawn at its own
   *  corner radius. */
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Plain-text form for the accessible name, needed when `label` is a
   *  node rather than a string. */
  labelText?: string;
  /** What the closed trigger shows when this option is selected. The
   *  list needs to name every choice; the trigger only has to identify
   *  the current one, which a specimen ("Aa", a corner chip) often does
   *  better than a word. Falls back to `label`. */
  triggerLabel?: React.ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: "primary" | "outline-light" | "outline-dark";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  className?: string;
  /** Render the open menu in a body-level portal with `position: fixed`
   *  so it escapes any ancestor's `overflow: hidden | auto`. Use this
   *  when the dropdown lives inside a scrollable modal/sidebar panel
   *  where the menu would otherwise be clipped or trigger scrolling. */
  portal?: boolean;
  /** Vertical direction the menu opens. Default "down" matches the
   *  classic select behavior; pass "up" for pickers anchored at the
   *  bottom of a panel. */
  direction?: "up" | "down";
  onOptionPreview?: (value: string) => void;
  onPreviewEnd?: () => void;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  variant = "outline-light",
  size = "medium",
  disabled = false,
  className = "",
  portal = false,
  direction = "down",
  onOptionPreview,
  onPreviewEnd,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  // Position (viewport-relative, used only in portal mode) for the
  // floating menu. Calculated from the toggle's bounding rect on open
  // and on viewport changes.
  const [menuPos, setMenuPos] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
    opensUp: boolean;
  } | null>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      // In portal mode the menu lives in a sibling of the toggle, so
      // also tolerate clicks inside the menu itself.
      if (menuRef.current && menuRef.current.contains(target)) return;
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

  // Reposition the portaled menu against the toggle. Runs synchronously
  // after layout (useLayoutEffect) so the menu doesn't flicker at
  // (0,0) for one frame before snapping into place.
  useLayoutEffect(() => {
    if (!portal || !isOpen) return;
    const reposition = () => {
      const toggle = dropdownRef.current?.querySelector(
        ".dropdown-toggle"
      ) as HTMLElement | null;
      const menu = menuRef.current;
      if (!toggle || !menu) return;
      const rect = toggle.getBoundingClientRect();
      const measuredHeight = Math.min(menu.scrollHeight, MENU_MAX_HEIGHT);
      const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
      const spaceBelow =
        window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
      const opensUp =
        direction === "up"
          ? spaceAbove >= measuredHeight || spaceAbove >= spaceBelow
          : spaceBelow < measuredHeight && spaceAbove > spaceBelow;
      const availableHeight = opensUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(
        48,
        Math.min(MENU_MAX_HEIGHT, availableHeight),
      );
      const renderedHeight = Math.min(measuredHeight, maxHeight);
      const unclampedTop = opensUp
        ? rect.top - MENU_GAP - renderedHeight
        : rect.bottom + MENU_GAP;
      const top = Math.min(
        Math.max(VIEWPORT_MARGIN, unclampedTop),
        window.innerHeight - VIEWPORT_MARGIN - renderedHeight,
      );
      const menuWidth = Math.min(
        280,
        Math.max(rect.width, menu.scrollWidth),
      );
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, rect.left),
        Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - menuWidth),
      );
      setMenuPos({
        left,
        top,
        width: rect.width,
        maxHeight,
        opensUp,
      });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [portal, isOpen, direction, options.length]);

  const handleToggle = () => {
    if (!disabled) {
      if (isOpen) onPreviewEnd?.();
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    onPreviewEnd?.();
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      onPreviewEnd?.();
    } else if (e.key === "ArrowDown" && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex((opt) => opt.value === value);
      const nextIndex = (currentIndex + 1) % options.length;
      onChange(options[nextIndex].value);
    } else if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex((opt) => opt.value === value);
      const prevIndex =
        currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
      onChange(options[prevIndex].value);
    }
  };

  const menu = isOpen ? (
    <ul
      ref={menuRef}
      className={`dropdown-menu ${className}${
        portal ? " dropdown-menu-portal" : ""
      } dropdown-menu-${menuPos?.opensUp ? "up" : direction}`}
      role="listbox"
      style={
        portal && menuPos
          ? {
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              // The base .dropdown-menu CSS sets `right: 0`, which on
              // a portaled+fixed menu would stretch it to the
              // viewport's right edge. Explicitly clear it.
              right: "auto",
              minWidth: menuPos.width,
              width: "max-content",
              maxWidth: 280,
              maxHeight: menuPos.maxHeight,
              zIndex: Z_FLOATING,
            }
          : undefined
      }
    >
      {options.map((option) => (
        <li
          key={option.value}
          className={`dropdown-option ${
            option.value === value ? "selected" : ""
          }`}
          onClick={() => handleSelect(option.value)}
          onMouseEnter={() => onOptionPreview?.(option.value)}
          onMouseLeave={onPreviewEnd}
          role="option"
          aria-selected={option.value === value}
          aria-label={option.labelText}
        >
          {option.icon && (
            <span className="dropdown-icon">{option.icon}</span>
          )}
          {option.label}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div
      ref={dropdownRef}
      className={`dropdown ${className} dropdown-${variant} dropdown-${size} ${
        disabled ? "dropdown-disabled" : ""
      } ${isOpen ? "dropdown-open" : ""}`}
    >
      <button
        type="button"
        className="dropdown-toggle"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="dropdown-selected">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="dropdown-icon">{selectedOption.icon}</span>
              )}
              {selectedOption.triggerLabel ?? selectedOption.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className={`dropdown-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {portal ? menu && createPortal(menu, document.body) : menu}
    </div>
  );
};
