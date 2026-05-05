import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRightIcon } from "../Icons/Icons";
import { CheckIcon, RadioButtonCheckedIcon } from "../Icons/Icons";
import "./ContextMenu.css";

// A right-click menu used by widgets and the background. Supports
// flat actions, mutually-exclusive radios (single-pick), checkboxes
// (multi-select), and cascading submenus that open on hover. The
// component is positioning-only — closing is the parent's
// responsibility (we expose onClose for outside-click / Escape).
export type ContextMenuItem =
  | {
      type: "action";
      label: string;
      onClick: () => void;
      // Optional leading icon — replaces the empty icon slot on
      // action rows. Selected radios/checks always show their own
      // marker so they ignore this.
      icon?: React.ReactNode;
    }
  | {
      // Non-interactive informational row (e.g., the resolved
      // location on the Weather widget's right-click menu). Renders
      // muted, no hover affordance, no click handler.
      type: "info";
      label: string;
      icon?: React.ReactNode;
    }
  | { type: "separator" }
  | {
      type: "radio";
      label: string;
      selected: boolean;
      onClick: () => void;
    }
  | {
      type: "checkbox";
      label: string;
      checked: boolean;
      onClick: () => void;
      disabled?: boolean;
    }
  | {
      type: "submenu";
      label: string;
      items: ContextMenuItem[];
      icon?: React.ReactNode;
    };

interface ContextMenuProps {
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

const SubmenuRow: React.FC<{
  item: Extract<ContextMenuItem, { type: "submenu" }>;
  isOpen: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}> = ({ item, isOpen, onEnter, onLeave, onClose }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  // "right" = submenu opens to the right of the row (default);
  // "left" = it would overflow the viewport, flip leftward.
  const [side, setSide] = useState<"right" | "left">("right");
  // Vertical offset (px) applied to the submenu's `top`. Defaults to
  // -5 so the first item visually aligns with the parent row. Shifted
  // upward when the submenu would overflow the bottom of the viewport.
  const [topOffset, setTopOffset] = useState<number>(-5);
  // Pin the cascade's min-width to the parent menu's measured width
  // so a short-labeled parent + long-labeled cascade still look like
  // they belong together. Without this, content-sized menus can end
  // up at mismatched widths next to each other.
  const [minWidth, setMinWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !rowRef.current || !subRef.current) return;
    const rowRect = rowRef.current.getBoundingClientRect();
    const parentMenu = rowRef.current.closest(".ctx-menu") as HTMLElement | null;
    const parentWidth = parentMenu?.getBoundingClientRect().width ?? 0;
    setMinWidth(parentWidth || null);
    // Re-measure AFTER min-width applies so the side/top calculations
    // account for the cascade's final size.
    const subRect = subRef.current.getBoundingClientRect();
    const margin = 8;

    // Horizontal: prefer right; flip left if the right side overflows.
    const fitsRight =
      rowRect.right + subRect.width + margin <= window.innerWidth;
    setSide(fitsRight ? "right" : "left");

    // Vertical: with default top:-5 the submenu opens at rowTop-5 and
    // extends downward. If that bottom edge spills past the viewport,
    // shift the submenu up by the overflow. Cap so the submenu top
    // never floats above the viewport (when the submenu is taller
    // than the available space, pin to the top with margin).
    const defaultTop = -5;
    const submenuBottomAbs = rowRect.top + defaultTop + subRect.height;
    const maxBottom = window.innerHeight - margin;
    if (submenuBottomAbs > maxBottom) {
      const overflow = submenuBottomAbs - maxBottom;
      const minTopOffset = -rowRect.top + margin; // keeps top ≥ margin
      setTopOffset(Math.max(defaultTop - overflow, minTopOffset));
    } else {
      setTopOffset(defaultTop);
    }
  }, [isOpen]);

  return (
    <div
      ref={rowRef}
      className={`ctx-menu-row ctx-menu-submenu-row${
        isOpen ? " is-open" : ""
      }`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      <span className="ctx-menu-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="ctx-menu-label">{item.label}</span>
      <ChevronRightIcon className="ctx-menu-chevron" />
      {isOpen && (
        <div
          ref={subRef}
          className={`ctx-menu ctx-menu-submenu ctx-menu-submenu-${side}`}
          role="menu"
          style={{ top: topOffset, ...(minWidth ? { minWidth } : {}) }}
          // Outside-click is handled by the root listener; the
          // stopPropagation here keeps mousedown inside the submenu
          // from being mis-classified as outside.
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Items items={item.items} onClose={onClose} />
        </div>
      )}
    </div>
  );
};

const Items: React.FC<{
  items: ContextMenuItem[];
  onClose: () => void;
}> = ({ items, onClose }) => {
  const [openSubIdx, setOpenSubIdx] = useState<number | null>(null);

  return (
    <>
      {items.map((item, idx) => {
        if (item.type === "separator") {
          return <div key={idx} className="ctx-menu-sep" />;
        }
        if (item.type === "submenu") {
          return (
            <SubmenuRow
              key={idx}
              item={item}
              isOpen={openSubIdx === idx}
              onEnter={() => setOpenSubIdx(idx)}
              onLeave={() => setOpenSubIdx(null)}
              onClose={onClose}
            />
          );
        }
        if (item.type === "action") {
          return (
            <button
              key={idx}
              type="button"
              role="menuitem"
              className="ctx-menu-row"
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              <span className="ctx-menu-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="ctx-menu-label">{item.label}</span>
            </button>
          );
        }
        if (item.type === "info") {
          return (
            <div
              key={idx}
              role="presentation"
              className="ctx-menu-row ctx-menu-info"
            >
              <span className="ctx-menu-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="ctx-menu-label">{item.label}</span>
            </div>
          );
        }
        // radio | checkbox
        const isSelected =
          item.type === "radio" ? item.selected : item.checked;
        const disabled = item.type === "checkbox" && item.disabled;
        return (
          <button
            key={idx}
            type="button"
            role={item.type === "radio" ? "menuitemradio" : "menuitemcheckbox"}
            aria-checked={isSelected}
            disabled={disabled}
            className={`ctx-menu-row${isSelected ? " is-selected" : ""}${
              disabled ? " is-disabled" : ""
            }`}
            onClick={() => {
              if (disabled) return;
              item.onClick();
              // Radios close the menu (single-pick UX); checkboxes
              // stay open so the user can flip several without
              // re-opening.
              if (item.type === "radio") onClose();
            }}
          >
            <span className="ctx-menu-icon" aria-hidden="true">
              {isSelected &&
                (item.type === "radio" ? (
                  <RadioButtonCheckedIcon style={{ fontSize: 12 }} />
                ) : (
                  <CheckIcon style={{ fontSize: 14 }} />
                ))}
            </span>
            <span className="ctx-menu-label">{item.label}</span>
          </button>
        );
      })}
    </>
  );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  items,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("scroll", onClose, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("scroll", onClose, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Flip the menu off-screen edges so it always sits inside the
  // viewport even when the cursor is near the right/bottom border.
  const [adjusted, setAdjusted] = useState(position);
  useEffect(() => {
    if (!ref.current) {
      setAdjusted(position);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    let x = position.x;
    let y = position.y;
    const margin = 8;
    if (x + rect.width > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    setAdjusted({ x, y });
  }, [position]);

  // Portal to <body> so the menu escapes any ancestor with `transform`
  // / `filter` / `perspective` (e.g., the .widget shell uses
  // `transform: translate(-50%, 0)`, which would otherwise make
  // position:fixed resolve relative to the widget instead of the
  // viewport, dragging the menu off-cursor).
  return createPortal(
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      style={{ position: "fixed", top: adjusted.y, left: adjusted.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Items items={items} onClose={onClose} />
    </div>,
    document.body
  );
};
