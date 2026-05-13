import React from "react";
import {
  DiscordIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
} from "../components/Icons/Icons";

/**
 * Shared social-links config. Read by both the in-app SocialsModal
 * (newtab) and the toolbar Options popup so a URL or handle change
 * propagates everywhere automatically.
 *
 * `key` is stable for React keys. `handle` is optional — used by
 * the in-app modal's two-line layout but ignored by the popup's
 * pill list.
 */
export interface SocialLink {
  key: string;
  href: string;
  label: string;
  handle?: string;
  Icon: React.FC<
    React.SVGProps<SVGSVGElement> & { fontSize?: number | string }
  >;
}

export const SOCIALS: SocialLink[] = [
  {
    key: "github",
    href: "https://github.com/emilyxietty",
    label: "GitHub",
    handle: "@emilyxietty",
    Icon: GitHubIcon,
  },
  {
    key: "instagram",
    href: "https://instagram.com/emily.xietty",
    label: "Instagram",
    handle: "@emily.xietty",
    Icon: InstagramIcon,
  },
  {
    key: "tiktok",
    href: "https://tiktok.com/@pianokaisen",
    label: "TikTok",
    handle: "@pianokaisen",
    Icon: TikTokIcon,
  },
  {
    key: "linkedin",
    href: "https://www.linkedin.com/in/emilyxietty/",
    label: "LinkedIn",
    handle: "emilyxietty",
    Icon: LinkedInIcon,
  },
  {
    key: "discord",
    href: "https://discord.gg/8re4UaZ2fX",
    label: "Discord",
    handle: "Join the community",
    Icon: DiscordIcon,
  },
];
