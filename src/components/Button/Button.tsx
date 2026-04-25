import React from "react";
import "./Button.css";

export type ButtonVariant =
  | "light"
  | "dark"
  | "outline-light"
  | "outline-dark"
  | "transparent";
export type ButtonSize = "small" | "medium" | "large";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  pill?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "light",
  size = "medium",
  fullWidth = false,
  pill = false,
  icon,
  children,
  className = "",
  disabled = false,
  ...props
}) => {
  // Only treat as icon-only when there are no text children — otherwise
  // .btn-icon's uniform padding + no-border override makes text look
  // off-center inside the button.
  const isIconOnly = !!icon && !children;
  const classes = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? "btn-full-width" : "",
    pill ? "btn-pill" : "",
    disabled ? "btn-disabled" : "",
    isIconOnly ? "btn-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled} {...props}>
      {icon && <span className="btn-icon-element">{icon}</span>}
      {children}
    </button>
  );
};
