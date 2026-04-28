import React, { useEffect, useRef } from "react";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import "./Background.css";

interface BackgroundProps {
  children: React.ReactNode;
  currentBackground: string;
  loading: boolean;
  backgroundFilters: BackgroundFilters;
  showWidgetEdits: boolean;
}

// Maximum offset (in pixels) the photo can shift toward the cursor.
// The CSS scales the .background-filter by enough that this offset
// never exposes a black edge of the viewport.
const PARALLAX_RANGE = 14;

export const Background: React.FC<BackgroundProps> = ({
  children,
  currentBackground,
  loading,
  backgroundFilters,
  showWidgetEdits,
}) => {
  const t = useT();
  const { isDragging, backgroundParallax } = useAppContext();
  const filterRef = useRef<HTMLDivElement | null>(null);

  // Cursor-driven parallax. Listens at the document level so the
  // photo shifts even when the cursor sits over a widget. Updates
  // CSS variables on the filter element (cheaper than re-rendering
  // React on every mousemove). rAF-throttled so we apply at most
  // one shift per frame regardless of mousemove rate.
  useEffect(() => {
    if (!backgroundParallax) {
      // Reset offsets when toggled off so the photo snaps back
      // to center via the existing CSS transition.
      filterRef.current?.style.removeProperty("--bg-shift-x");
      filterRef.current?.style.removeProperty("--bg-shift-y");
      return;
    }
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!filterRef.current) return;
        // Map cursor (0..viewport) → (-1..+1), then to pixels.
        // Sign is inverted: photo shifts AWAY from the cursor so
        // it feels like depth (foreground content moves with the
        // cursor, background moves opposite).
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        const x = -((e.clientX / w) * 2 - 1) * PARALLAX_RANGE;
        const y = -((e.clientY / h) * 2 - 1) * PARALLAX_RANGE;
        filterRef.current.style.setProperty("--bg-shift-x", `${x.toFixed(1)}px`);
        filterRef.current.style.setProperty("--bg-shift-y", `${y.toFixed(1)}px`);
      });
    };
    document.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [backgroundParallax]);

  if (loading) {
    return <div className="background-loading"></div>;
  }

  if (!currentBackground) {
    return (
      <div className="background-error">
        <p>{t("background.loadingError")}</p>
      </div>
    );
  }

  const backgroundFilterStyle: React.CSSProperties = {
    backgroundImage: `url(${currentBackground})`,
    filter: `blur(${backgroundFilters.blur}px) brightness(${backgroundFilters.brightness}%) contrast(${backgroundFilters.contrast}%) saturate(${backgroundFilters.saturation}%)`,
  };

  return (
    <div className="background">
      {/* No onContextMenu here — right-click on the empty background
          area falls through to Chrome's native menu (back / forward
          / reload / save image / inspect). Widgets still get our
          custom menu via their own onContextMenu (which calls
          stopPropagation so this never fires for widget right-clicks). */}
      {isDragging && <div className="grid-overlay" />}
      <div
        ref={filterRef}
        className={`background-filter${
          backgroundParallax ? " background-parallax" : ""
        }`}
        style={backgroundFilterStyle}
      />
      <div className="background-content">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              showDragHandle: showWidgetEdits,
            });
          }
          return child;
        })}
      </div>
    </div>
  );
};
