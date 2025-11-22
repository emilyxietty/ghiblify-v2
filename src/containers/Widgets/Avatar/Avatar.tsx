import React from "react";
import { AVATAR_OPTIONS } from "../../../config/avatarConfig";
import { useAppContext } from "../../../contexts/AppContext";
import "./Avatar.css";

interface AvatarProps {
  selectedAvatar?: string;
}

export const Avatar: React.FC<AvatarProps> = () => {
  const { avatarSettings } = useAppContext();

  const avatar = avatarSettings.selectedAvatar;
  const avatarSize = avatarSettings.size;

  const avatarData = AVATAR_OPTIONS.find((a) => a.value === avatar);

  return (
    <div
      className="avatar-container"
      style={{
        width: `${avatarSize}px`,
        height: `${avatarSize}px`,
      }}
    >
      {avatarData && (
        <img
          src={avatarData.src}
          alt={avatarData.label}
          className="avatar-image"
          style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
        />
      )}
    </div>
  );
};
