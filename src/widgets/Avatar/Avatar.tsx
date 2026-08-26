import React from "react";
import { AVATAR_OPTIONS } from "../../config/avatarConfig";
import { useWidgetSettings } from "../../hooks/useWidgetSettings";
import { useScaledPx } from "../../utils/viewportScale";
import { hexToRgbChannels } from "../../utils/textHighlight";
import "./Avatar.css";

interface AvatarProps {
  selectedAvatar?: string;
}

export const Avatar: React.FC<AvatarProps> = () => {
  // Reads canvas settings on canvas, dock-merged settings in the
  // dock - so each surface keeps its own selectedAvatar.
  const { settings } = useWidgetSettings("avatar");
  const { selectedAvatar: avatar, size: avatarSizeRef } = settings;
  // Optional surface behind the sprite - same colour + opacity model
  // every other widget's Background control writes. At 0 the padding
  // collapses too, so a background-less avatar keeps the footprint it
  // has always had.
  const surfaceAlpha = (settings.opacity ?? 0) / 100;
  const surfaceRgb =
    typeof settings.surfaceColor === "string"
      ? hexToRgbChannels(settings.surfaceColor)
      : null;
  // settings.size is reference-px (1920 baseline); scale to current-
  // viewport px so the avatar stays proportional to the screen.
  const avatarSize = useScaledPx(avatarSizeRef);

  const currentIndex = AVATAR_OPTIONS.findIndex((a) => a.value === avatar);
  const avatarData =
    currentIndex >= 0 ? AVATAR_OPTIONS[currentIndex] : AVATAR_OPTIONS[0];

  return (
    <div
      className="avatar-container"
      style={
        {
          width: `${avatarSize}px`,
          height: `${avatarSize}px`,
          "--avatar-opacity": surfaceAlpha,
          ...(surfaceRgb ? { "--avatar-surface-rgb": surfaceRgb } : {}),
        } as React.CSSProperties
      }
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

          {/* Credit chip. Single rendering - CSS reveals it both on
              D hold AND in edit mode, so the same DOM element
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
