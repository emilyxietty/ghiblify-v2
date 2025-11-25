import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

interface InlinePopoverProps {
  open?: boolean;
  anchorEl?: HTMLElement | null;
  placement?: "left" | "right";
  offset?: number;
  onClose?: () => void;
  onOpen?: () => void;
  isOpen?: boolean; // New prop to handle open state externally
  // When `trigger` is provided, InlinePopover will render it inline and
  // manage opening/closing internally instead of relying on `open`/`anchorEl`.
  trigger?: React.ReactNode;
  // when true the trigger will be inert and won't toggle the popover
  disabled?: boolean;
  // vertical alignment relative to the anchor when placed "left" or "right"
  // - "center" (default) centers the popover vertically on the anchor
  // - "start" aligns the popover's top to the anchor's top
  // - "end" aligns the popover's bottom to the anchor's bottom
  align?: "center" | "start" | "end";
  // whether clicking outside should trigger `onClose` (default true)
  closeOnOutsideClick?: boolean;
  // when true, render the popover as a normal div in the document flow
  // (no fixed positioning). Useful when you want the popover to sit
  // immediately below the header inside the same DOM subtree so events
  // bubble normally (prevents portal-like interference).
  inline?: boolean;
  children?: React.ReactNode;
}

const InlinePopover: React.FC<InlinePopoverProps> = ({
  open,
  anchorEl,
  placement = "right",
  offset = 30,
  onClose,
  onOpen,
  isOpen, // Destructure the new prop
  align = "center",
  closeOnOutsideClick = true,
  inline = false,
  trigger,
  disabled = false,
  children,
}) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    visibility: isOpen ? "visible" : "hidden",
  });
  const [internalOpen, setInternalOpen] = useState<boolean>(false);

  const effectiveOpen =
    isOpen !== undefined ? isOpen : trigger ? internalOpen : open;

  // Layout effect: compute geometry before paint to avoid flicker.
  useLayoutEffect(() => {
    const popup = elRef.current;
    const effectiveAnchor = trigger ? triggerRef.current : anchorEl;

    if (!effectiveOpen || !popup) {
      setStyle({ visibility: effectiveOpen ? "visible" : "hidden" });
      return;
    }

    // Helper: find nearest positioned ancestor (non-static) for inline mode.
    const findPositionedAncestor = (el: HTMLElement | null) => {
      let p = el?.parentElement || null;
      while (p && getComputedStyle(p).position === "static") {
        p = p.parentElement;
      }
      return p || document.body;
    };

    let ro: ResizeObserver | null = null;
    let container: HTMLElement | null = null;

    const update = () => {
      if (!effectiveAnchor || !popup) return;

      const viewportHeight = window.innerHeight;
      const anchorRect = effectiveAnchor.getBoundingClientRect();
      const isBottomHalf = anchorRect.top > viewportHeight / 2;
      const viewportWidth = window.innerWidth;
      const isLeftHalf = anchorRect.left < viewportWidth / 3;
      const isRightHalf = anchorRect.left > (2 * viewportWidth) / 3;

      if (inline) {
        setStyle({
          position: "absolute",
          top: isBottomHalf ? "auto" : "50px",
          bottom: isBottomHalf ? "50px" : "auto",
          left: isLeftHalf ? "0px" : isRightHalf ? "auto" : "50%",
          right: isLeftHalf ? "auto" : isRightHalf ? "0px" : "auto",
          transform: isLeftHalf || isRightHalf ? "none" : "translateX(-50%)",
          zIndex: 1001,
          visibility: "visible",
        });
      } else {
        setStyle({
          position: "fixed",
          top: isBottomHalf ? "auto" : "50px",
          bottom: isBottomHalf ? "50px" : "auto",
          left: isLeftHalf ? "0px" : isRightHalf ? "auto" : "50%",
          right: isLeftHalf ? "auto" : isRightHalf ? "0px" : "auto",
          transform: isLeftHalf || isRightHalf ? "none" : "translateX(-50%)",
          zIndex: 1001,
          visibility: "visible",
        });
      }
    };

    // Initial update
    update();

    // Observe size changes and reposition on resize/scroll
    try {
      ro = new ResizeObserver(update);
      ro.observe(document.documentElement);
      if (elRef.current) ro.observe(elRef.current);
      if (anchorEl) ro.observe(anchorEl);
    } catch (err) {
      // ResizeObserver may not be available; ignore
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [
    effectiveOpen,
    anchorEl,
    placement,
    offset,
    align,
    inline,
    trigger,
    internalOpen,
  ]);

  // Handle outside clicks for both controlled and internal-open modes.
  useEffect(() => {
    const effectiveOpen = trigger ? internalOpen : open;
    const effectiveAnchor = trigger ? triggerRef.current : anchorEl;
    if (!effectiveOpen) return;
    if (!closeOnOutsideClick) return;

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (elRef.current && elRef.current.contains(target)) return;
      if (effectiveAnchor && effectiveAnchor.contains(target)) return;
      if (trigger) {
        setInternalOpen(false);
        onClose && onClose();
      } else {
        onClose && onClose();
      }
    };

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorEl, onClose, closeOnOutsideClick, internalOpen, trigger]);

  // Sync open -> internalOpen when trigger is not used (no-op when trigger provided)
  useEffect(() => {
    if (!trigger) return;
    // when the internal open state changes, call onOpen/onClose
    if (internalOpen) onOpen && onOpen();
    else onClose && onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalOpen]);

  // Toggle handler when a trigger is provided
  const handleTriggerToggle = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) return;
    setInternalOpen((v) => !v);
  };

  useEffect(() => {
    if (isOpen !== undefined) {
      if (isOpen) onOpen && onOpen();
      else onClose && onClose();
    }
  }, [isOpen, onOpen, onClose]);

  return (
    <>
      {trigger ? (
        <div
          ref={triggerRef}
          tabIndex={0}
          onClick={handleTriggerToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTriggerToggle(e);
            }
          }}
        >
          {trigger}
        </div>
      ) : null}

      {effectiveOpen ? (
        <div ref={elRef} style={style}>
          {children}
        </div>
      ) : null}
    </>
  );
};

export default InlinePopover;
