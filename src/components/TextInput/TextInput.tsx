import React from "react";
import "./TextInput.css";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mode?: "light" | "dark";
  inputSize?: "small" | "medium" | "large";
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ mode = "light", inputSize = "medium", className = "", ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        className={`custom-input custom-input-${mode} ${
          inputSize ? `custom-input-${inputSize}` : ""
        } ${className}`.trim()}
      />
    );
  }
);

export default TextInput;
