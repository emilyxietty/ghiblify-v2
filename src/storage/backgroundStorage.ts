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
  /** Whether animated backgrounds (the `animated` array on each film
   *  source) join the rotation. Absent means on - they have always
   *  rotated, so the default has to preserve that. */
  animatedBackgrounds?: boolean;
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
const SELF_HOSTED = "https://emilyxietty.github.io/ghiblify/backgrounds/";

const URL_REMAP: Record<string, string> = {
  // The imgur-hosted set was already self-hosted before the move, so it
  // has no third-party origin - but it lived under /ghiblify/imgur/ and
  // is now filed by film. /ghiblify/imgur/ is deliberately still served
  // (duplicate copies) so a stored URL from 2.5.0 or earlier does not
  // 404 in the meantime, which makes this remap a correctness fix
  // rather than a rescue: without it the old URL keeps loading but no
  // longer equals the pool's URL for the same image, so the heart stops
  // registering on it and a favorite can show up twice. Once the remap
  // has run everywhere, the imgur copies can be deleted.
  "https://emilyxietty.github.io/ghiblify/imgur/PWb8N.webp":
    "howls-moving-castle/PWb8N.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/KUwxg08.webp":
    "kikis-delivery-service/KUwxg08.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/ydLBeRI.webp":
    "spirited-away/ydLBeRI.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/80krUnI.webp":
    "spirited-away/80krUnI.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/MtowUYC.webp":
    "howls-moving-castle/MtowUYC.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/6I7u6jK.webp":
    "kikis-delivery-service/6I7u6jK.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/hGmmpXS.webp":
    "kikis-delivery-service/hGmmpXS.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/xe7yn1l.webp":
    "kikis-delivery-service/xe7yn1l.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/ocYjCYd.webp":
    "kikis-delivery-service/ocYjCYd.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/lWPWsxZ.webp":
    "kikis-delivery-service/lWPWsxZ.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/lOqxE7U.webp":
    "kikis-delivery-service/lOqxE7U.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/X5wt7vn.webp":
    "kikis-delivery-service/X5wt7vn.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/IqEpUGh.webp":
    "kikis-delivery-service/IqEpUGh.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/46t1ZWd.webp":
    "kikis-delivery-service/46t1ZWd.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/Dk0ScOv.webp":
    "kikis-delivery-service/Dk0ScOv.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/RD3icbY.webp":
    "kikis-delivery-service/RD3icbY.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/qbw6SOQ.webp":
    "kikis-delivery-service/qbw6SOQ.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/EGyD4ZJ.webp":
    "kikis-delivery-service/EGyD4ZJ.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/tYQmZbR.webp":
    "kikis-delivery-service/tYQmZbR.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/BODPqG9.webp":
    "kikis-delivery-service/BODPqG9.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/oC5F786.webp":
    "kikis-delivery-service/oC5F786.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/ga6efgR.webp":
    "kikis-delivery-service/ga6efgR.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/BuqruKI.webp":
    "kikis-delivery-service/BuqruKI.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/W6IF5IH.webp":
    "kikis-delivery-service/W6IF5IH.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/2X8lCU8.webp":
    "kikis-delivery-service/2X8lCU8.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/oMNhHde.webp":
    "kikis-delivery-service/oMNhHde.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/xNyf2nQ.webp":
    "kikis-delivery-service/xNyf2nQ.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/1VmdF8u.webp":
    "kikis-delivery-service/1VmdF8u.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/aeiU9CH.webp":
    "kikis-delivery-service/aeiU9CH.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/q7Qtpe7.webp":
    "kikis-delivery-service/q7Qtpe7.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/yZLdGDR.webp":
    "kikis-delivery-service/yZLdGDR.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/GYGrpSL.webp":
    "kikis-delivery-service/GYGrpSL.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/mCbJJYO.webp":
    "kikis-delivery-service/mCbJJYO.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/YyxxQrh.webp":
    "kikis-delivery-service/YyxxQrh.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/NLzxxk8.webp":
    "kikis-delivery-service/NLzxxk8.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/9bPUHp1.webp":
    "kikis-delivery-service/9bPUHp1.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/aryd2Ne.webp":
    "kikis-delivery-service/aryd2Ne.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/Iju4SAw.webp":
    "kikis-delivery-service/Iju4SAw.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/6t2dRGL.webp":
    "kikis-delivery-service/6t2dRGL.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/Z0xB7rD.webp":
    "kikis-delivery-service/Z0xB7rD.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/ftjVCKC.webp":
    "kikis-delivery-service/ftjVCKC.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/Zf3zKXb.webp":
    "kikis-delivery-service/Zf3zKXb.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/UhmbkVW.webp":
    "kikis-delivery-service/UhmbkVW.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/lz1EPkO.webp":
    "kikis-delivery-service/lz1EPkO.webp",
  "https://emilyxietty.github.io/ghiblify/imgur/HSZNtuX.webp":
    "kikis-delivery-service/HSZNtuX.webp",
  "https://mir-s3-cdn-cf.behance.net/project_modules/2800_opt_1/ba6e5397877185.5ecf73a278179.gif":
    "soothing/ba6e5397877185.5ecf73a278179.webp",
  "https://wallpaperaccess.com/full/2471303.gif":
    "soothing/2471303.gif",
  "https://wallpaperaccess.com/full/723262.gif":
    "soothing/723262.gif",
  "https://64.media.tumblr.com/6a891b24667e186b9209438673a339ce/6088d818b617caf3-6e/s540x810/2c711258b834848286dc41cf50fdc2769adf126a.gif":
    "soothing/2c711258b834848286dc41cf50fdc2769adf126a.webp",
  "https://cdnb.artstation.com/p/assets/images/images/029/320/295/original/bogdan-mb0sco-coffeeanim.gif":
    "soothing/bogdan-mb0sco-coffeeanim.webp",
  "https://i.pinimg.com/originals/49/03/a3/4903a3afbb583f08ba69cfd96e87cf2b.gif":
    "soothing/4903a3afbb583f08ba69cfd96e87cf2b.webp",
  "https://i.gifer.com/origin/3f/3f742b930e81f768f63ce06ea3e57eea.gif":
    "howls-moving-castle/3f742b930e81f768f63ce06ea3e57eea.webp",
  "https://giffiles.alphacoders.com/382/3824.gif":
    "howls-moving-castle/3824.webp",
  "https://media.tenor.com/Rvx3od5mgH8AAAAC/heen-miyazaki.gif":
    "howls-moving-castle/heen-miyazaki.webp",
  "https://giffiles.alphacoders.com/230/2308.gif":
    "howls-moving-castle/2308.webp",
  "https://64.media.tumblr.com/ed8ed0a984d5b6b153b4d94016c4105a/tumblr_ol4v982yLm1qzxv73o1_540.gif":
    "howls-moving-castle/tumblr_3bdb6700b0bef6be26a9bd1fec354a7e_563356c3_540.webp",
  "https://78.media.tumblr.com/d81050ee83c39020c0dab44442477d2a/tumblr_pa2hk7BJnb1wlpc27o1_1280.gif":
    "howls-moving-castle/tumblr_3ea44baaecbbab0642b39e311c0861dd_c0e14b79_1280.webp",
  "https://media.tenor.com/dFRmjNDK9TwAAAAC/ghibli.gif":
    "the-wind-rises/ghibli.webp",
  "https://i.pinimg.com/originals/fa/0e/ff/fa0effbc69bdd5d2e7b3372e4bbcba4c.gif":
    "the-wind-rises/fa0effbc69bdd5d2e7b3372e4bbcba4c.webp",
  "https://25.media.tumblr.com/tumblr_m3bs24v9431rtr496o1_500.gif":
    "howls-moving-castle/tumblr_m3bs24v9431rtr496o1_500.webp",
  "https://64.media.tumblr.com/ef54d660ef19b41539113af32810aade/tumblr_ptr93kR27V1xkr0iao1_540.gif":
    "my-neighbour-totoro/tumblr_72c4620bb9b0d9b2bd705419df648242_4e193d39_540.webp",
  "https://media.tenor.com/mJWPMHUfSD0AAAAd/kikis-delivery-service-ghibli.gif":
    "kikis-delivery-service/kikis-delivery-service-ghibli.webp",
  "https://64.media.tumblr.com/9df6fe5e45470ea167f70fb7edb05d0d/tumblr_n3zllski371tomovco3_500.gif":
    "my-neighbour-totoro/tumblr_n3zllski371tomovco3_500.webp",
  "https://media.tenor.com/8ErGdpPQc5MAAAAC/anime-studio-ghibli.gif":
    "my-neighbour-totoro/anime-studio-ghibli.webp",
  "https://i.pinimg.com/originals/84/ba/11/84ba119fa9ae4dde816163ddde12e0be.gif":
    "my-neighbour-totoro/84ba119fa9ae4dde816163ddde12e0be.webp",
  "https://media.moddb.com/images/groups/1/1/84/F.G.A.P05.gif":
    "spirited-away/F.G.A.P05.webp",
  "https://media0.giphy.com/media/razd1ERwheVC8/giphy.gif?cid=6c09b952d7bc54dccd7d10a28da73fdf460a69cb3436b6fe&rid=giphy.gif":
    "spirited-away/razd1ERwheVC8.webp",
  "https://i.pinimg.com/originals/d8/8b/33/d88b335ce13bab84bc018f4e486da278.gif":
    "spirited-away/d88b335ce13bab84bc018f4e486da278.webp",
  "https://i.pinimg.com/originals/6b/a9/68/6ba968e6872694841da8edcf8dc13d5a.gif":
    "howls-moving-castle/6ba968e6872694841da8edcf8dc13d5a.webp",
  "https://i0.wp.com/iraheinichen.com/wp-content/uploads/2022/10/img_1146.gif":
    "howls-moving-castle/img_1146.webp",
  "https://media.tenor.com/yXfzZyTpAP4AAAAC/my-neighbor-totoro-tree.gif":
    "my-neighbour-totoro/my-neighbor-totoro-tree.webp",
  "https://i.gifer.com/79y.gif":
    "my-neighbour-totoro/79y.webp",
  "https://fc00.deviantart.net/fs70/f/2013/258/f/2/howl2_by_hyguy87-d6mgy1n.gif":
    "howls-moving-castle/d6mgy1n-4f757c33-8e35-4712-b587-e0775015f24f.webp",
  "https://64.media.tumblr.com/e19ffb62744c2a7d33321fe4b7beffdf/tumblr_oopbl02Z5t1u6tm5ho1_540.gif":
    "kikis-delivery-service/tumblr_oopbl02Z5t1u6tm5ho1_540.webp",
  "https://media.tenor.com/wm6ctH1-CXkAAAAd/kikis-delivery-service-cat.gif":
    "kikis-delivery-service/kikis-delivery-service-cat.gif",
  "https://38.media.tumblr.com/dee56239e9761b2336ff57bd2cd10825/tumblr_nwxa0w7XkN1tytavoo1_540.gif":
    "kikis-delivery-service/tumblr_nwxa0w7XkN1tytavoo1_540.webp",
  "https://media.tenor.com/N7RVlx8b4NwAAAAd/kikis-delivery-service-rain.gif":
    "kikis-delivery-service/kikis-delivery-service-rain.gif",
  "https://64.media.tumblr.com/60cb2ba4ecdb78eb19461b3faee08e07/ae635df109615d52-52/s540x810/be28affb718933cc68573d129aa0cf581673ac02.gif":
    "my-neighbour-totoro/tumblr_60cb2ba4ecdb78eb19461b3faee08e07_be28affb_540.webp",
  "https://64.media.tumblr.com/3e0ff870eecbe60f4f2402eea1e5efff/tumblr_o8rgxdcHGm1vruqgxo1_1280.gif":
    "spirited-away/tumblr_4561cf6ebe90e62fa45b0cc8e9dfabe4_fd4ca545_1280.webp",
  "https://i.pinimg.com/originals/3b/5e/82/3b5e822074a34f15b7c812a773c19845.gif":
    "spirited-away/3b5e822074a34f15b7c812a773c19845.webp",
  "https://i.gifer.com/3YVx.gif":
    "spirited-away/3YVx.webp",
  "https://animesher.com/orig/1/199/1996/19961/animesher.com_ghibli-dark-arrietty-1996131.gif":
    "arietty/animesher.com_ghibli-dark-arrietty-1996131.webp",
  "https://i.pinimg.com/originals/a1/ac/d6/a1acd60c70d6bca876b2a65520fd4489.gif":
    "spirited-away/a1acd60c70d6bca876b2a65520fd4489.webp",
  "https://giffiles.alphacoders.com/114/114241.gif":
    "spirited-away/114241.webp",
  "https://i.gifer.com/3TOz.gif":
    "spirited-away/3TOz.webp",
  "https://i.gifer.com/2qu6.gif":
    "spirited-away/2qu6.webp",
  "https://i.pinimg.com/originals/a4/bf/1d/a4bf1d7a92dc2b506bac3ef499648ee2.gif":
    "spirited-away/a4bf1d7a92dc2b506bac3ef499648ee2.webp",
  "https://i.pinimg.com/originals/f4/cf/c7/f4cfc7ab82b0a4884fab1b06eb3757db.gif":
    "spirited-away/f4cfc7ab82b0a4884fab1b06eb3757db.webp",
  "https://i.pinimg.com/originals/4b/1d/ed/4b1deda56618216d1d1055c79c949d87.gif":
    "spirited-away/4b1deda56618216d1d1055c79c949d87.webp",
  "https://64.media.tumblr.com/6ab850c56974932f0767d34fd59deb9b/tumblr_pqlwrfTW6I1v6jtpi_540.gif":
    "kikis-delivery-service/tumblr_pqlwrfTW6I1v6jtpi_540.webp",
  "https://64.media.tumblr.com/2ecf0070ac6cc15e0f8895a971a0dbdb/tumblr_pqlwrgr5se1v6jtpi_500.gif":
    "kikis-delivery-service/tumblr_pqlwrgr5se1v6jtpi_500.webp",
  "https://64.media.tumblr.com/c3fbdd7dfb0e2e20b41ba63329de8502/tumblr_opbll5RuZo1uxvvvzo1_500.gif":
    "kikis-delivery-service/tumblr_e33e84a551b4060dff04a85b79814e54_43ce6842_500.webp",
  "https://animesher.com/orig/1/135/1351/13513/animesher.com_grunge-movie-gif-1351335.gif":
    "kikis-delivery-service/animesher.com_grunge-movie-gif-1351335.webp",
  "https://cpb-ap-se2.wpmucdn.com/mediafactory.org.au/dist/9/213/files/2016/04/tumblr_o27yrsMdrf1v1u6k0o1_500-u78xdd.gif":
    "spirited-away/tumblr_o27yrsMdrf1v1u6k0o1_500-u78xdd.webp",
  "https://64.media.tumblr.com/46fed6399806a0ecce5eba2c235908d0/tumblr_o6bm5bpFLZ1vruqgxo1_1280.gif":
    "spirited-away/tumblr_9f2d03549c94a84747b4052675651bb2_967ee36a_1280.webp",
  "https://25.media.tumblr.com/e791c992e700b87a122e5f86c892c31c/tumblr_mshmw5bx8y1s9816mo1_500.gif":
    "spirited-away/tumblr_mshmw5bx8y1s9816mo1_500.webp",
  "https://64.media.tumblr.com/14c23eae36e8f49c38bcdeb5a01773d6/tumblr_n9ue6oISOR1qb6v6ro3_500.gif":
    "princess-mononoke/tumblr_n9ue6oISOR1qb6v6ro3_500.webp",
  "https://64.media.tumblr.com/a42b29f3ce312c27105862246d9ce111/tumblr_p0z2ecDQny1qzxv73o1_540.gif":
    "spirited-away/tumblr_0bf14f8a67bd5bd3e5a0978fef92778a_3b74c350_540.webp",
  "https://i.gifer.com/3Rd6.gif":
    "spirited-away/3Rd6.webp",
  "https://gifdb.com/images/high/spirited-away-chihiro-bored-ua9sddzj76kb2ouz.gif":
    "spirited-away/spirited-away-chihiro-bored-ua9sddzj76kb2ouz.webp",
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

// The animated backgrounds used to be one pseudo-film called "animated",
// so switching them off meant unchecking it in the movie list. They now
// live under the film they actually come from, which would silently turn
// them all back on for anyone who had opted out. Carry the old choice
// over to the new flag once, then drop the orphaned selection entry.
const migrateAnimatedSelection = () => {
  try {
    const blob = readBlob();
    if (!blob.selection || !("animated" in blob.selection)) return;
    const wasEnabled = blob.selection.animated !== false;
    const selection = { ...blob.selection };
    delete selection.animated;
    const next: BackgroundBlob = { ...blob, selection };
    if (!wasEnabled) next.animatedBackgrounds = false;
    writeBlob(next);
  } catch {
    /* ignore - the flag stays at its default (on) */
  }
};
migrateAnimatedSelection();

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

// Animated backgrounds (boolean, default ON)
//
// Defaults to true because animated stills already rotated before they
// were a separate category - reading an absent flag as "off" would
// silently shrink everyone's pool on upgrade.
export const readAnimatedBackgrounds = (): boolean =>
  readBlob().animatedBackgrounds !== false;
export const writeAnimatedBackgrounds = (on: boolean) => {
  const next = readBlob();
  if (on) delete next.animatedBackgrounds;
  else next.animatedBackgrounds = false;
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
