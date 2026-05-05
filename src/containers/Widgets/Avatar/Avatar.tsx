import React from "react";
import { AVATAR_OPTIONS } from "../../../config/avatarConfig";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import { ArrowBackIosNewIcon, ArrowForwardIosIcon } from "../../../components/Icons/Icons";
import "./Avatar.css";

interface AvatarProps {
  selectedAvatar?: string;
}

export const Avatar: React.FC<AvatarProps> = () => {
  // Reads canvas settings on canvas, dock-merged settings in the
  // dock — so each surface keeps its own selectedAvatar without
  // forking the component. Cycle arrows write to whichever surface
  // they're on.
  const { settings, updateSettings } = useWidgetSettings("avatar");
  const { selectedAvatar: avatar, size: avatarSize } = settings;

  const currentIndex = AVATAR_OPTIONS.findIndex((a) => a.value === avatar);
  const avatarData =
    currentIndex >= 0 ? AVATAR_OPTIONS[currentIndex] : AVATAR_OPTIONS[0];

  const cyclePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next =
      currentIndex <= 0 ? AVATAR_OPTIONS.length - 1 : currentIndex - 1;
    updateSettings({ selectedAvatar: AVATAR_OPTIONS[next].value });
  };

  const cycleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next =
      currentIndex === AVATAR_OPTIONS.length - 1 ? 0 : currentIndex + 1;
    updateSettings({ selectedAvatar: AVATAR_OPTIONS[next].value });
  };

  return (
    <div
      className="avatar-container"
      style={{
        width: `${avatarSize}px`,
        height: `${avatarSize}px`,
      }}
    >
      {avatarData && (
        <>
          <img
            src={avatarData.src}
            alt={avatarData.label}
            className="avatar-image"
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
            title={avatarData.source}
          />

          {/* Nav arrows for cycling avatars. Always present in the DOM,
              hidden via CSS unless the widget is in edit mode (so the
              same physical buttons live in one place — no duplicate
              picker rendered by EditWidget). */}
          <button
            type="button"
            className="avatar-nav-btn avatar-nav-left"
            onClick={cyclePrev}
            aria-label="Previous avatar"
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </button>
          <button
            type="button"
            className="avatar-nav-btn avatar-nav-right"
            onClick={cycleNext}
            aria-label="Next avatar"
          >
            <ArrowForwardIosIcon fontSize="small" />
          </button>

          {/* Credit chip. Single rendering — CSS reveals it both on
              Shift hold AND in edit mode, so the same DOM element
              shows in both contexts (no overlap, no duplicates). */}
          <div className="avatar-credit">
            <span className="avatar-credit-name">{avatarData.label}</span>
            {avatarData.creator && (
              <>
                <span className="avatar-credit-sep" aria-hidden="true">
                  ·
                </span>
                {avatarData.source ? (
                  <a
                    className="avatar-credit-creator"
                    href={avatarData.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {avatarData.creator}
                  </a>
                ) : (
                  <span className="avatar-credit-creator">
                    {avatarData.creator}
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
