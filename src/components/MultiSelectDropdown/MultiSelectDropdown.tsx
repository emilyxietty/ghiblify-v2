import React, { useEffect, useRef, useState } from "react";
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
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select fields...",
  buttonText = "Fields",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleOptionToggle = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <div ref={dropdownRef} className="multi-select-dropdown">
      <button
        type="button"
        className="multi-select-toggle"
        onClick={handleToggle}
      >
        <span>{buttonText}</span>
        <span className={`multi-select-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {isOpen && (
        <div className="multi-select-menu" role="menu">
          {options.map((option) => {
            const checked = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className={`multi-select-option${checked ? " is-selected" : ""}`}
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
      )}
    </div>
  );
};
