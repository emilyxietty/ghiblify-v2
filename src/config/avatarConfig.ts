import { assetUrl } from "../utils/assetUrl";

export interface AvatarOption {
  value: string;
  label: string;
  src: string;
  creator?: string;
  source?: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    value: "calcifer",
    label: "Calcifer",
    src: assetUrl("/assets/avatars/calcifer.webp"),
    creator: "@capivarinha",
    source: "https://giphy.com/capivarinha",
  },
  {
    value: "chihiro",
    label: "Chihiro",
    src: assetUrl("/assets/avatars/chihiro.webp"),
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "kiki",
    label: "Kiki",
    src: assetUrl("/assets/avatars/kiki.webp"),
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "ponyo",
    label: "Ponyo",
    src: assetUrl("/assets/avatars/ponyo.webp"),
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "sophie",
    label: "Sophie",
    src: assetUrl("/assets/avatars/sophie.webp"),
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "mononoke",
    label: "Mononoke",
    src: assetUrl("/assets/avatars/mononoke.webp"),
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "boh",
    label: "Boh and Yu bird",
    src: assetUrl("/assets/avatars/boh.webp"),
    creator: "@molehill",
    source: "https://giphy.com/molehill",
  },
  {
    value: "chibi",
    label: "Chibi",
    src: assetUrl("/assets/avatars/chibi.webp"),
    // source:
    //   "https://giphy.com/stickers/studio-ghibli-totoro-my-neighbour-QVz8bVdhi6dmkIkg61",
    creator: "@Christie_b",
    source: "https://giphy.com/Christie_b",
  },
  {
    value: "chibichu",
    label: "Chibi and Chu",
    src: assetUrl("/assets/avatars/chibichu.webp"),
  },
  { value: "totoro", label: "Totoro", src: assetUrl("/assets/avatars/totoro.webp") },
];
