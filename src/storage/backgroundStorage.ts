// Single combined entry for everything that customizes the rotating
// photo background:
//   favorites - URLs always kept in the rotation pool
//   blacklist - URLs that should never appear
//   selection - which movies the user has enabled / disabled
//   filters   - blur / brightness / contrast / saturation sliders
//
// All four used to live in their own keys (background_selection,
// background_filters, ghiblify_favorites, ghiblify_blacklist) which
// muddled the namespace and meant four separate migrations every
// time the shape changed. Now everything lives inside
// `ghiblify_background` and migrates from the four legacy keys on
// first load (idempotent - runs once per page load and is a no-op
// once cleaned up).
//
// Persistence flows through hybridStorage - chrome.storage.local is
// the source of truth, with a localStorage mirror for synchronous
// first-paint reads. See ../storage/hybridStorage.ts.

import {
  readSync as readPersisted,
  write as writePersisted,
  remove as removePersisted,
} from "./hybridStorage";

export interface BackgroundFilters {
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

interface BackgroundBlob {
  favorites?: string[];
  blacklist?: string[];
  selection?: Record<string, boolean>;
  filters?: BackgroundFilters;
  /** When true, the photo gently shifts in response to cursor
   *  position to create a soft parallax / depth effect. Default
   *  false (static, identical to legacy behavior). */
  parallax?: boolean;
}

const KEY = "ghiblify_background";

export const DEFAULT_FILTERS: BackgroundFilters = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

const LEGACY_KEYS = [
  "ghiblify_favorites",
  "ghiblify_blacklist",
  "background_selection",
  "background_filters",
];

const readBlob = (): BackgroundBlob => {
  const parsed = readPersisted<BackgroundBlob | null>(KEY, null);
  return parsed && typeof parsed === "object" ? parsed : {};
};

const writeBlob = (next: BackgroundBlob) => {
  if (Object.keys(next).length === 0) {
    removePersisted(KEY);
  } else {
    writePersisted(KEY, next);
  }
};

const tryParseArray = (raw: string | null): string[] | null => {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
};

const tryParseRecord = (
  raw: string | null
): Record<string, boolean> | null => {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
};

const tryParseFilters = (raw: string | null): BackgroundFilters | null => {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return { ...DEFAULT_FILTERS, ...obj };
  } catch {
    return null;
  }
};

const migrateLegacy = () => {
  try {
    if (localStorage.getItem(KEY)) {
      // Already migrated - sweep up any legacy stragglers.
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      return;
    }
    const blob: BackgroundBlob = {};
    const favorites = tryParseArray(localStorage.getItem("ghiblify_favorites"));
    if (favorites && favorites.length) blob.favorites = favorites;
    const blacklist = tryParseArray(localStorage.getItem("ghiblify_blacklist"));
    if (blacklist && blacklist.length) blob.blacklist = blacklist;
    const selection = tryParseRecord(
      localStorage.getItem("background_selection")
    );
    if (selection && Object.keys(selection).length) blob.selection = selection;
    const filters = tryParseFilters(localStorage.getItem("background_filters"));
    if (filters) blob.filters = filters;
    if (Object.keys(blob).length) writeBlob(blob);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};
migrateLegacy();

// One-time remap of stored background URLs.
//
// The animated backgrounds moved off third-party hosts (tumblr,
// pinterest, deviantart, tenor...) onto emilyxietty.github.io, which
// rewrote 55 links in background.json. Both user lists here are keyed
// by exact URL, so without this the move silently breaks them:
//
//   blacklist - filtered against the pool by exact match, so every
//               animated background a user had hidden would come back.
//   favorites - replayed into the pool by URL independently of
//               background.json, so an old favorite keeps fetching from
//               the host we just stopped depending on, and the heart
//               stops registering on the self-hosted copy that now
//               shows - the same image sitting in the pool twice under
//               two URLs.
//
// Idempotent without a flag: the values are not themselves keys, so a
// second pass is a no-op and only a real change is written.
const SELF_HOSTED = "https://emilyxietty.github.io/ghiblify/gifs/";

const URL_REMAP: Record<string, string> = {
  "https://mir-s3-cdn-cf.behance.net/project_modules/2800_opt_1/ba6e5397877185.5ecf73a278179.gif":
    "ba6e5397877185.5ecf73a278179.webp",
  "https://wallpaperaccess.com/full/2471303.gif":
    "2471303.gif",
  "https://wallpaperaccess.com/full/723262.gif":
    "723262.gif",
  "https://64.media.tumblr.com/6a891b24667e186b9209438673a339ce/6088d818b617caf3-6e/s540x810/2c711258b834848286dc41cf50fdc2769adf126a.gif":
    "2c711258b834848286dc41cf50fdc2769adf126a.webp",
  "https://cdnb.artstation.com/p/assets/images/images/029/320/295/original/bogdan-mb0sco-coffeeanim.gif":
    "bogdan-mb0sco-coffeeanim.webp",
  "https://i.pinimg.com/originals/49/03/a3/4903a3afbb583f08ba69cfd96e87cf2b.gif":
    "4903a3afbb583f08ba69cfd96e87cf2b.webp",
  "https://i.gifer.com/origin/3f/3f742b930e81f768f63ce06ea3e57eea.gif":
    "3f742b930e81f768f63ce06ea3e57eea.webp",
  "https://giffiles.alphacoders.com/382/3824.gif":
    "3824.webp",
  "https://media.tenor.com/Rvx3od5mgH8AAAAC/heen-miyazaki.gif":
    "heen-miyazaki.webp",
  "https://giffiles.alphacoders.com/230/2308.gif":
    "2308.webp",
  "https://64.media.tumblr.com/ed8ed0a984d5b6b153b4d94016c4105a/tumblr_ol4v982yLm1qzxv73o1_540.gif":
    "tumblr_3bdb6700b0bef6be26a9bd1fec354a7e_563356c3_540.webp",
  "https://78.media.tumblr.com/d81050ee83c39020c0dab44442477d2a/tumblr_pa2hk7BJnb1wlpc27o1_1280.gif":
    "tumblr_3ea44baaecbbab0642b39e311c0861dd_c0e14b79_1280.webp",
  "https://media.tenor.com/dFRmjNDK9TwAAAAC/ghibli.gif":
    "ghibli.webp",
  "https://i.pinimg.com/originals/fa/0e/ff/fa0effbc69bdd5d2e7b3372e4bbcba4c.gif":
    "fa0effbc69bdd5d2e7b3372e4bbcba4c.webp",
  "https://25.media.tumblr.com/tumblr_m3bs24v9431rtr496o1_500.gif":
    "tumblr_m3bs24v9431rtr496o1_500.webp",
  "https://64.media.tumblr.com/ef54d660ef19b41539113af32810aade/tumblr_ptr93kR27V1xkr0iao1_540.gif":
    "tumblr_72c4620bb9b0d9b2bd705419df648242_4e193d39_540.webp",
  "https://media.tenor.com/mJWPMHUfSD0AAAAd/kikis-delivery-service-ghibli.gif":
    "kikis-delivery-service-ghibli.webp",
  "https://64.media.tumblr.com/9df6fe5e45470ea167f70fb7edb05d0d/tumblr_n3zllski371tomovco3_500.gif":
    "tumblr_n3zllski371tomovco3_500.webp",
  "https://media.tenor.com/8ErGdpPQc5MAAAAC/anime-studio-ghibli.gif":
    "anime-studio-ghibli.webp",
  "https://i.pinimg.com/originals/84/ba/11/84ba119fa9ae4dde816163ddde12e0be.gif":
    "84ba119fa9ae4dde816163ddde12e0be.webp",
  "https://media.moddb.com/images/groups/1/1/84/F.G.A.P05.gif":
    "F.G.A.P05.webp",
  "https://media0.giphy.com/media/razd1ERwheVC8/giphy.gif?cid=6c09b952d7bc54dccd7d10a28da73fdf460a69cb3436b6fe&rid=giphy.gif":
    "razd1ERwheVC8.webp",
  "https://i.pinimg.com/originals/d8/8b/33/d88b335ce13bab84bc018f4e486da278.gif":
    "d88b335ce13bab84bc018f4e486da278.webp",
  "https://i.pinimg.com/originals/6b/a9/68/6ba968e6872694841da8edcf8dc13d5a.gif":
    "6ba968e6872694841da8edcf8dc13d5a.webp",
  "https://i0.wp.com/iraheinichen.com/wp-content/uploads/2022/10/img_1146.gif":
    "img_1146.webp",
  "https://media.tenor.com/yXfzZyTpAP4AAAAC/my-neighbor-totoro-tree.gif":
    "my-neighbor-totoro-tree.webp",
  "https://i.gifer.com/79y.gif":
    "79y.webp",
  "https://fc00.deviantart.net/fs70/f/2013/258/f/2/howl2_by_hyguy87-d6mgy1n.gif":
    "d6mgy1n-4f757c33-8e35-4712-b587-e0775015f24f.webp",
  "https://64.media.tumblr.com/e19ffb62744c2a7d33321fe4b7beffdf/tumblr_oopbl02Z5t1u6tm5ho1_540.gif":
    "tumblr_oopbl02Z5t1u6tm5ho1_540.webp",
  "https://media.tenor.com/wm6ctH1-CXkAAAAd/kikis-delivery-service-cat.gif":
    "kikis-delivery-service-cat.gif",
  "https://38.media.tumblr.com/dee56239e9761b2336ff57bd2cd10825/tumblr_nwxa0w7XkN1tytavoo1_540.gif":
    "tumblr_nwxa0w7XkN1tytavoo1_540.webp",
  "https://media.tenor.com/N7RVlx8b4NwAAAAd/kikis-delivery-service-rain.gif":
    "kikis-delivery-service-rain.gif",
  "https://64.media.tumblr.com/60cb2ba4ecdb78eb19461b3faee08e07/ae635df109615d52-52/s540x810/be28affb718933cc68573d129aa0cf581673ac02.gif":
    "tumblr_60cb2ba4ecdb78eb19461b3faee08e07_be28affb_540.webp",
  "https://64.media.tumblr.com/3e0ff870eecbe60f4f2402eea1e5efff/tumblr_o8rgxdcHGm1vruqgxo1_1280.gif":
    "tumblr_4561cf6ebe90e62fa45b0cc8e9dfabe4_fd4ca545_1280.webp",
  "https://i.pinimg.com/originals/3b/5e/82/3b5e822074a34f15b7c812a773c19845.gif":
    "3b5e822074a34f15b7c812a773c19845.webp",
  "https://i.gifer.com/3YVx.gif":
    "3YVx.webp",
  "https://animesher.com/orig/1/199/1996/19961/animesher.com_ghibli-dark-arrietty-1996131.gif":
    "animesher.com_ghibli-dark-arrietty-1996131.webp",
  "https://i.pinimg.com/originals/a1/ac/d6/a1acd60c70d6bca876b2a65520fd4489.gif":
    "a1acd60c70d6bca876b2a65520fd4489.webp",
  "https://giffiles.alphacoders.com/114/114241.gif":
    "114241.webp",
  "https://i.gifer.com/3TOz.gif":
    "3TOz.webp",
  "https://i.gifer.com/2qu6.gif":
    "2qu6.webp",
  "https://i.pinimg.com/originals/a4/bf/1d/a4bf1d7a92dc2b506bac3ef499648ee2.gif":
    "a4bf1d7a92dc2b506bac3ef499648ee2.webp",
  "https://i.pinimg.com/originals/f4/cf/c7/f4cfc7ab82b0a4884fab1b06eb3757db.gif":
    "f4cfc7ab82b0a4884fab1b06eb3757db.webp",
  "https://i.pinimg.com/originals/4b/1d/ed/4b1deda56618216d1d1055c79c949d87.gif":
    "4b1deda56618216d1d1055c79c949d87.webp",
  "https://64.media.tumblr.com/6ab850c56974932f0767d34fd59deb9b/tumblr_pqlwrfTW6I1v6jtpi_540.gif":
    "tumblr_pqlwrfTW6I1v6jtpi_540.webp",
  "https://64.media.tumblr.com/2ecf0070ac6cc15e0f8895a971a0dbdb/tumblr_pqlwrgr5se1v6jtpi_500.gif":
    "tumblr_pqlwrgr5se1v6jtpi_500.webp",
  "https://64.media.tumblr.com/c3fbdd7dfb0e2e20b41ba63329de8502/tumblr_opbll5RuZo1uxvvvzo1_500.gif":
    "tumblr_e33e84a551b4060dff04a85b79814e54_43ce6842_500.webp",
  "https://animesher.com/orig/1/135/1351/13513/animesher.com_grunge-movie-gif-1351335.gif":
    "animesher.com_grunge-movie-gif-1351335.webp",
  "https://cpb-ap-se2.wpmucdn.com/mediafactory.org.au/dist/9/213/files/2016/04/tumblr_o27yrsMdrf1v1u6k0o1_500-u78xdd.gif":
    "tumblr_o27yrsMdrf1v1u6k0o1_500-u78xdd.webp",
  "https://64.media.tumblr.com/46fed6399806a0ecce5eba2c235908d0/tumblr_o6bm5bpFLZ1vruqgxo1_1280.gif":
    "tumblr_9f2d03549c94a84747b4052675651bb2_967ee36a_1280.webp",
  "https://25.media.tumblr.com/e791c992e700b87a122e5f86c892c31c/tumblr_mshmw5bx8y1s9816mo1_500.gif":
    "tumblr_mshmw5bx8y1s9816mo1_500.webp",
  "https://64.media.tumblr.com/14c23eae36e8f49c38bcdeb5a01773d6/tumblr_n9ue6oISOR1qb6v6ro3_500.gif":
    "tumblr_n9ue6oISOR1qb6v6ro3_500.webp",
  "https://64.media.tumblr.com/a42b29f3ce312c27105862246d9ce111/tumblr_p0z2ecDQny1qzxv73o1_540.gif":
    "tumblr_0bf14f8a67bd5bd3e5a0978fef92778a_3b74c350_540.webp",
  "https://i.gifer.com/3Rd6.gif":
    "3Rd6.webp",
  "https://gifdb.com/images/high/spirited-away-chihiro-bored-ua9sddzj76kb2ouz.gif":
    "spirited-away-chihiro-bored-ua9sddzj76kb2ouz.webp",
};

const migrateRemappedUrls = () => {
  try {
    const blob = readBlob();
    let changed = false;
    const remap = (list: string[] | undefined): string[] | undefined => {
      if (!list?.length) return list;
      const next = Array.from(
        new Set(list.map((u) => (URL_REMAP[u] ? SELF_HOSTED + URL_REMAP[u] : u)))
      );
      if (next.length !== list.length || next.some((u, i) => u !== list[i]))
        changed = true;
      return next;
    };
    const favorites = remap(blob.favorites);
    const blacklist = remap(blob.blacklist);
    if (!changed) return;
    const next: BackgroundBlob = { ...blob };
    if (favorites) next.favorites = favorites;
    if (blacklist) next.blacklist = blacklist;
    writeBlob(next);
  } catch {
    /* ignore - the stored lists stay as they were */
  }
};
migrateRemappedUrls();

// Favorites
export const readFavorites = (): string[] => readBlob().favorites ?? [];
export const writeFavorites = (favs: string[]) => {
  const next = readBlob();
  if (favs.length) next.favorites = favs;
  else delete next.favorites;
  writeBlob(next);
};

// Blacklist
export const readBlacklist = (): string[] => readBlob().blacklist ?? [];
export const writeBlacklist = (bl: string[]) => {
  const next = readBlob();
  if (bl.length) next.blacklist = bl;
  else delete next.blacklist;
  writeBlob(next);
};

// Selection (per-movie enabled flags)
export const readSelection = (): Record<string, boolean> =>
  readBlob().selection ?? {};
export const writeSelection = (sel: Record<string, boolean>) => {
  const next = readBlob();
  next.selection = sel;
  writeBlob(next);
};

// Filters
export const readFilters = (): BackgroundFilters => ({
  ...DEFAULT_FILTERS,
  ...readBlob().filters,
});
export const writeFilters = (filters: BackgroundFilters) => {
  const next = readBlob();
  next.filters = filters;
  writeBlob(next);
};

// Parallax (boolean)
export const readParallax = (): boolean => readBlob().parallax === true;
export const writeParallax = (on: boolean) => {
  const next = readBlob();
  if (on) next.parallax = true;
  else delete next.parallax;
  writeBlob(next);
};
