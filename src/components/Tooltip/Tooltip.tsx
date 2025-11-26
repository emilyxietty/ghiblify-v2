import React from "react";
import "./Tooltip.css";

interface TooltipProps {
  children: React.ReactNode;
  className?: string;
  /** position of the tooltip relative to the trigger */
  position?: "top" | "bottom" | "left" | "right";
  /** optional inline style */
  style?: React.CSSProperties;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  className = "",
  position = "top",
  style,
}) => {
  return (
    <div className={`tooltip tooltip-${position} ${className}`} style={style}>
      <div className="tooltip-inner">{children}</div>
    </div>
  );
};

export default Tooltip;
