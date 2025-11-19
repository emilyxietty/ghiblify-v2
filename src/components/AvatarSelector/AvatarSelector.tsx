import React from "react";
import { AVATAR_OPTIONS } from "../Avatar/Avatar";
import "./AvatarSelector.css";

interface AvatarSelectorProps {
  selectedAvatar: string;
  onChange: (avatar: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  onChange,
}) => {
  return (
    <div className="avatar-selector">
      {AVATAR_OPTIONS.map((avatar) => (
        <button
          key={avatar.value}
          className={`avatar-option ${
            selectedAvatar === avatar.value ? "active" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(avatar.value);
          }}
          title={avatar.label}
        >
          <img src={avatar.src} alt={avatar.label} />
        </button>
      ))}
    </div>
  );
};
