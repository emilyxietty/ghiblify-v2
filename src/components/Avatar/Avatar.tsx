import React, { useEffect, useState } from "react";
import "./Avatar.css";

// Use public folder paths - Vite copies these to dist automatically
export const AVATAR_OPTIONS = [
  { value: "calcifer", label: "Calcifer", src: "/assets/avatars/calcifer.gif" }, // Fire demon
  { value: "kiki", label: "Kiki", src: "/assets/avatars/kiki.gif" }, // Not shown in images
  { value: "chihiro", label: "Chihiro", src: "/assets/avatars/chihiro.gif" }, // Girl with Jiji
  { value: "ponyo", label: "Ponyo", src: "/assets/avatars/ponyo.gif" }, // Pink fish character
  {
    value: "sootsprite",
    label: "Soot Sprite",
    src: "/assets/avatars/sootsprite.gif",
  }, // Black fuzzy ball
  { value: "totoro", label: "Totoro", src: "/assets/avatars/totoro.gif" }, // Blue character with leaf
  {
    value: "sophie",
    label: "Sophie",
    src: "/assets/avatars/sop.gif",
  }, // Scarecrow
];

interface AvatarProps {
  selectedAvatar?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({
  selectedAvatar,
  size = 200,
}) => {
  const [avatar, setAvatar] = useState(() => {
    return (
      selectedAvatar || localStorage.getItem("avatar_selected") || "totoro"
    );
  });
  const [avatarSize, setAvatarSize] = useState(() => {
    return size || parseInt(localStorage.getItem("avatar_size") || "200");
  });

  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.selectedAvatar) {
        setAvatar(customEvent.detail.selectedAvatar);
      }
      if (customEvent.detail.size) {
        setAvatarSize(customEvent.detail.size);
      }
    };

    window.addEventListener("avatarSettingsChange", handleSettingsChange);

    return () => {
      window.removeEventListener("avatarSettingsChange", handleSettingsChange);
    };
  }, []);

  const avatarData = AVATAR_OPTIONS.find((a) => a.value === avatar);

  return (
    <div className="avatar-container">
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
