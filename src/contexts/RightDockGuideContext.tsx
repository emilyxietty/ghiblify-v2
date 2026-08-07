import React, { createContext, useContext } from "react";
import type { DockWidgetKey } from "../config/widgetConfig";

export type RightDockGuideStep = "edit" | "order" | "size";

interface RightDockGuideContextValue {
  open: boolean;
  step: RightDockGuideStep;
  onWidgetEdit: (key: DockWidgetKey) => void;
}

export const RightDockGuideContext =
  createContext<RightDockGuideContextValue>({
    open: false,
    step: "edit",
    onWidgetEdit: () => undefined,
  });

export const useRightDockGuide = (): RightDockGuideContextValue =>
  useContext(RightDockGuideContext);
