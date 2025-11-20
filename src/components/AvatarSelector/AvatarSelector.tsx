import React from "react";
import { AVATAR_OPTIONS } from "../Avatar/Avatar";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import "./AvatarSelector.css";

interface AvatarSelectorProps {
  selectedAvatar: string;
  onChange: (avatar: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  onChange,
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
    <div className="avatar-selector-nav">
      <button className="avatar-nav-btn" onClick={handlePrevious}>
        <ArrowBackIosNewIcon />
      </button>
      <div className="avatar-preview">
        <img src={currentAvatar.src} alt={currentAvatar.label} />
        <span className="avatar-label">{currentAvatar.label}</span>
      </div>
      <button className="avatar-nav-btn" onClick={handleNext}>
        <ArrowForwardIosIcon />
      </button>
    </div>
  );
};
