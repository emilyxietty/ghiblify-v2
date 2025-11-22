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
    src: "/assets/avatars/calcifer.gif",
    creator: "@capivarinha",
    source: "https://giphy.com/capivarinha",
  },
  {
    value: "chihiro",
    label: "Chihiro",
    src: "/assets/avatars/chihiro.gif",
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "kiki",
    label: "Kiki",
    src: "/assets/avatars/kiki.gif",
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "ponyo",
    label: "Ponyo",
    src: "/assets/avatars/ponyo.gif",
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "sophie",
    label: "Sophie",
    src: "/assets/avatars/sophie.gif",
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "mononoke",
    label: "Mononoke",
    src: "/assets/avatars/mononoke.gif",
    creator: "@kyecheng",
    source: "https://giphy.com/kyecheng",
  },
  {
    value: "boh",
    label: "Boh and Yu bird",
    src: "/assets/avatars/boh.gif",
    creator: "@molehill",
    source: "https://giphy.com/molehill",
  },
  {
    value: "chibi",
    label: "Chibi",
    src: "/assets/avatars/chibi.gif",
    // source:
    //   "https://giphy.com/stickers/studio-ghibli-totoro-my-neighbour-QVz8bVdhi6dmkIkg61",
    creator: "@Christie_b",
    source: "https://giphy.com/Christie_b",
  },
  {
    value: "chibichu",
    label: "Chibi and Chu",
    src: "/assets/avatars/chibichu.gif",
  },
  { value: "totoro", label: "Totoro", src: "/assets/avatars/totoro.gif" },
];
