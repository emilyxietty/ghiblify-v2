import React from "react";
import { useAppContext } from "../../contexts/AppContext";
import "./Avatar.css";

export const AVATAR_OPTIONS = [
  { value: "calcifer", label: "Calcifer", src: "/assets/avatars/calcifer.gif" },
  { value: "chihiro", label: "Chihiro", src: "/assets/avatars/chihiro.gif" },
  { value: "kiki", label: "Kiki", src: "/assets/avatars/kiki.gif" },
  { value: "ponyo", label: "Ponyo", src: "/assets/avatars/ponyo.gif" },
  {
    value: "sootsprite",
    label: "Soot Sprite",
    src: "/assets/avatars/sootsprite.gif",
  },
  { value: "sophie", label: "Sophie", src: "/assets/avatars/sop.gif" },
  {
    value: "spirited",
    label: "Spirited Away",
    src: "/assets/avatars/spirited.gif",
  },
  { value: "totoro2", label: "Totoro 2", src: "/assets/avatars/tot2.gif" },
  { value: "totoro3", label: "Totoro 3", src: "/assets/avatars/tot3.gif" },
  { value: "totoro", label: "Totoro", src: "/assets/avatars/totoro.gif" },
];

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
