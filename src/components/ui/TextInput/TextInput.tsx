import React from "react";
import "./TextInput.css";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "small" | "medium" | "large";
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ inputSize = "medium", className = "", ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        className={`custom-input ${
          inputSize ? `custom-input-${inputSize}` : ""
        } ${className}`.trim()}
      />
    );
  }
);

export default TextInput;
