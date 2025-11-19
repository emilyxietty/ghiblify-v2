import React from "react";
import "./FieldSelector.css";

export interface FieldOption {
  value: string;
  label: string;
}

interface FieldSelectorProps {
  options: FieldOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  variant?: "light" | "dark";
  minSelected?: number;
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({
  options,
  selectedValues,
  onChange,
  variant = "dark",
  minSelected = 0,
}) => {
  const handleToggle = (value: string) => {
    const isCurrentlySelected = selectedValues.includes(value);

    // Prevent deselecting if it would go below minimum
    if (isCurrentlySelected && selectedValues.length <= minSelected) {
      return;
    }

    const newValues = isCurrentlySelected
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const isLastSelected = (value: string) => {
    return (
      selectedValues.includes(value) && selectedValues.length <= minSelected
    );
  };

  return (
    <div className={`field-selector field-selector-${variant}`}>
      {options.map((option) => (
        <button
          key={option.value}
          className={`field-pill ${
            selectedValues.includes(option.value) ? "active" : ""
          } ${isLastSelected(option.value) ? "last-selected" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(option.value);
          }}
          disabled={isLastSelected(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
