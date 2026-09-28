import { useEffect, useRef, useState } from "react";

/** The side panels (left sidebar, bookmarks, right dock) never take
 *  more than this share of the viewport, so a narrow window keeps a
 *  strip of the page visible beside an open panel. Must match the
 *  `90vw` in each panel's CSS width. */
const PANEL_MAX_VIEWPORT_SHARE = 0.9;

/** A panel's on-screen width: its design width, capped at 90% of the
 *  viewport. Every edge hit-test measures against this. */
export const visiblePanelWidth = (panelWidth: number): number =>
  Math.min(panelWidth, window.innerWidth * PANEL_MAX_VIEWPORT_SHARE);

interface UseEdgePanelOptions {
  visible: boolean;
  panelWidth: number;
  edgeTrigger: number;
  interactionLocked?: boolean;
  shouldKeepOpen?: () => boolean;
  onAutoClose?: () => void;
  onEscapeBeforeClose?: () => boolean;
}

export const useEdgePanel = ({
  visible,
  panelWidth,
  edgeTrigger,
  interactionLocked = false,
  shouldKeepOpen,
  onAutoClose,
  onEscapeBeforeClose,
}: UseEdgePanelOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const wasVisible = useRef(visible);
  const callbacks = useRef({
    shouldKeepOpen,
    onAutoClose,
    onEscapeBeforeClose,
  });
  callbacks.current = {
    shouldKeepOpen,
    onAutoClose,
    onEscapeBeforeClose,
  };

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setShowCallout(true);
      const timeoutId = window.setTimeout(() => setShowCallout(false), 3500);
      wasVisible.current = visible;
      return () => window.clearTimeout(timeoutId);
    }
    wasVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) setIsOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleMouseMove = (event: MouseEvent) => {
      if (interactionLocked || callbacks.current.shouldKeepOpen?.()) return;
      const viewportWidth = window.innerWidth;
      const panelLeft = viewportWidth - visiblePanelWidth(panelWidth);
      if (event.clientX > viewportWidth - edgeTrigger) {
        setIsOpen(true);
      } else if (
        isOpen &&
        event.clientX < panelLeft
      ) {
        setIsOpen(false);
        callbacks.current.onAutoClose?.();
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [edgeTrigger, interactionLocked, isOpen, panelWidth, visible]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (callbacks.current.onEscapeBeforeClose?.()) return;
      setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, visible]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (isOpen) panel.removeAttribute("inert");
    else panel.setAttribute("inert", "");
  }, [isOpen, visible]);

  return { isOpen, setIsOpen, showCallout, panelRef };
};
