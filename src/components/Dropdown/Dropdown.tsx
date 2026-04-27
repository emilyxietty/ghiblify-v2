import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Dropdown.css";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
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
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reposition the portaled menu against the toggle. Runs synchronously
  // after layout (useLayoutEffect) so the menu doesn't flicker at
  // (0,0) for one frame before snapping into place.
  useLayoutEffect(() => {
    if (!portal || !isOpen) return;
    const reposition = () => {
      const toggle = dropdownRef.current?.querySelector(
        ".dropdown-toggle"
      ) as HTMLElement | null;
      if (!toggle) return;
      const rect = toggle.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const top =
        direction === "up" ? rect.top - menuHeight - 4 : rect.bottom + 4;
      setMenuPos({ left: rect.left, top, width: rect.width });
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
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
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
      } dropdown-menu-${direction}`}
      role="listbox"
      style={
        portal && menuPos
          ? {
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              minWidth: menuPos.width,
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
          role="option"
          aria-selected={option.value === value}
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
              {selectedOption.label}
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
