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
  const classes = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? "btn-full-width" : "",
    pill ? "btn-pill" : "",
    disabled ? "btn-disabled" : "",
    icon && "btn-icon",
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
