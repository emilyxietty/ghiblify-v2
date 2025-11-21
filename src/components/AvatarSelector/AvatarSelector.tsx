import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import React from "react";
import { AVATAR_OPTIONS } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import "./AvatarSelector.css";

interface AvatarSelectorProps {
  selectedAvatar: string;
  onChange: (avatar: string) => void;
  avatarSize?: number;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  onChange,
  avatarSize = 120,
}) => {
  const currentIndex = AVATAR_OPTIONS.findIndex(
    (avatar) => avatar.value === selectedAvatar
  );

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex =
      currentIndex === 0 ? AVATAR_OPTIONS.length - 1 : currentIndex - 1;
    onChange(AVATAR_OPTIONS[newIndex].value);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex =
      currentIndex === AVATAR_OPTIONS.length - 1 ? 0 : currentIndex + 1;
    onChange(AVATAR_OPTIONS[newIndex].value);
  };

  const currentAvatar = AVATAR_OPTIONS[currentIndex];

  return (
    <div
      className="avatar-selector-nav"
      onMouseDown={(e: React.MouseEvent) => {
        // Only forward left-button mousedowns (button === 0).
        // This prevents right-click/contextmenu from starting a drag.
        if (e.button !== 0) return;

        // If the user clicked one of the nav buttons, don't start a drag
        const target = e.target as HTMLElement;
        if (target.closest(".avatar-nav-btn")) return;

        // Forward the mousedown to the parent widget so dragging can start
        const el = e.currentTarget as HTMLElement;
        const widgetEl = el.closest(".widget") as HTMLElement | null;
        if (!widgetEl) return;

        const evt = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: e.clientX,
          clientY: e.clientY,
          button: 0,
        });
        widgetEl.dispatchEvent(evt);
      }}
    >
      <div className="avatar-preview">
        {/* <div
          className="avatar-main-row"
          // make the wrapper exactly avatarSize x avatarSize so overlays stay inside
        > */}
        <div
          className="avatar-container"
          style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
        >
          <img
            src={currentAvatar.src}
            alt={currentAvatar.label}
            className="avatar-image"
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
          />

          <div
            className="avatar-overlay-top"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="avatar-label">{currentAvatar.label}</span>
          </div>

          <Button
            className="avatar-nav-btn avatar-nav-left"
            variant="transparent"
            size="small"
            icon={<ArrowBackIosNewIcon />}
            onClick={handlePrevious}
            onMouseDown={(e) => e.stopPropagation()}
          />

          <Button
            className="avatar-nav-btn avatar-nav-right"
            variant="transparent"
            size="small"
            icon={<ArrowForwardIosIcon />}
            onClick={handleNext}
            onMouseDown={(e) => e.stopPropagation()}
          />

          {((currentAvatar as any).source ||
            (currentAvatar as any).creator) && (
            <div
              className="avatar-overlay-bottom"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {(currentAvatar as any).source &&
              (currentAvatar as any).creator ? (
                <a
                  className="avatar-source"
                  href={(currentAvatar as any).source}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(currentAvatar as any).creator}
                </a>
              ) : (currentAvatar as any).creator ? (
                <span className="avatar-label">
                  {(currentAvatar as any).creator}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
    // </div>
  );
};
