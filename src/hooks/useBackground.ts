import { useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { readBlacklist, readFavorites } from "../storage/backgroundStorage";
import { useOnline } from "./useOnline";

// Bundled fallbacks shown when the browser is offline. All ship with
// the extension under public/assets/backgrounds and load from
// chrome-extension:// without any network request. Each entry pairs
// the image path with the matching `movie_metadata.json` key so the
// Info widget still resolves a film while offline.
const OFFLINE_FALLBACKS: Array<{ path: string; film: string }> = [
  { path: "assets/backgrounds/chihiro015.jpg", film: "spirited away" },
  { path: "assets/backgrounds/chihiro043.jpg", film: "spirited away" },
  { path: "assets/backgrounds/howl049.jpg", film: "howl's moving castle" },
  { path: "assets/backgrounds/kazetachinu024.jpg", film: "the wind rises" },
  { path: "assets/backgrounds/majo001.jpg", film: "kiki's delivery service" },
  { path: "assets/backgrounds/ponyo005.jpg", film: "ponyo" },
];

interface BackgroundItem {
  link: string;
  title: string;
  titlejp: string;
  year: string;
  screentime: string;
  quote: string;
}

interface BackgroundSource {
  title: string;
  links: string[];
}

interface BackgroundData {
  default: {
    link: string;
    source: string;
  };
  sources: BackgroundSource[];
}

interface MovieMetadata {
  title: string;
  titlejp: string;
  year: string;
  screentime: string;
  quotes: string[];
}

interface MovieMetadataData {
  [key: string]: MovieMetadata;
}

export const useBackground = () => {
  const [currentBackground, setCurrentBackground] = useState<string>("");
  const [filmTitle, setFilmTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { backgroundSelection, updateBackgroundSelection } = useAppContext();
  const online = useOnline();

  useEffect(() => {
    // Offline short-circuit — every URL in background.json is
    // remote (Tumblr/Pinterest/Tenor/etc.), so without network we'd
    // sit on a black screen. Pick a random bundled fallback and
    // surface its matching film title so the Info widget populates
    // from the local metadata file (which IS shipped with the
    // extension and works offline).
    if (!online) {
      const pick =
        OFFLINE_FALLBACKS[
          Math.floor(Math.random() * OFFLINE_FALLBACKS.length)
        ];
      setCurrentBackground(chrome.runtime.getURL(pick.path));
      setFilmTitle(pick.film);
      setLoading(false);
      return;
    }

    const loadBackground = async () => {
      try {
        const [bgResponse, metadataResponse] = await Promise.all([
          fetch(chrome.runtime.getURL("background.json")),
          fetch(chrome.runtime.getURL("movie_metadata.json")),
        ]);

        const bgData: BackgroundData = await bgResponse.json();
        const metadataData: MovieMetadataData = await metadataResponse.json();

        // Load persisted blacklist + filter sources according to the
        // user's backgroundSelection preferences.
        const blacklistSet = new Set<string>(readBlacklist());

        // Filter sources according to user's backgroundSelection preferences
        const allowedSources = bgData.sources.filter(
          (s) =>
            // default to true when not specified
            (backgroundSelection && backgroundSelection[s.title]) ?? true,
        );

        // No fallback to "all sources" when allowedSources is empty —
        // that would silently re-enable every movie when the user only
        // wants favorites in the rotation. If both allowedSources AND
        // favorites are empty, the self-heal block below catches the
        // empty pool and auto-enables a source so the user is never
        // stranded with nothing to display.
        const sourcesToUse = allowedSources;

        console.log("useBackground: backgroundSelection", backgroundSelection);
        console.log(
          "useBackground: allowed source titles",
          sourcesToUse.map((s) => s.title),
        );

        // Only use sources that have metadata entries - prevents selecting a
        // background whose metadata is missing and falling back to the default.
        const validSources = sourcesToUse.filter(
          (s) => !!metadataData[s.title],
        );

        // Collect all non-blacklisted links with their source titles from valid sources
        const allLinks: { link: string; sourceTitle: string }[] = [];
        const seen = new Set<string>();

        validSources.forEach((source) => {
          source.links.forEach((link) => {
            if (!blacklistSet.has(link) && !seen.has(link)) {
              allLinks.push({ link, sourceTitle: source.title });
              seen.add(link);
            }
          });
        });

        // Favorites are always eligible — they're a personal opt-in
        // pool that the user can't deselect. Add any favorited URLs
        // that aren't already in the pool from a regular source.
        readFavorites().forEach((link) => {
          if (!blacklistSet.has(link) && !seen.has(link)) {
            allLinks.push({ link, sourceTitle: "__favorites__" });
            seen.add(link);
          }
        });

        if (allLinks.length === 0) {
          console.log(
            "useBackground: no candidate links with metadata found, falling back to default",
          );
          // Self-heal — when the pool is empty (no enabled movies AND
          // no favorites), auto-enable the first available source so
          // the user is never stranded with nothing to rotate. Picks
          // the first source that has metadata + at least one
          // non-blacklisted link.
          const firstAvailableSource = bgData.sources.find(
            (s) =>
              !!metadataData[s.title] &&
              s.links.some((l) => !blacklistSet.has(l)),
          );
          if (firstAvailableSource) {
            updateBackgroundSelection(firstAvailableSource.title, true);
            // The selection change will retrigger this effect, so we
            // can return early — the next pass will populate the pool.
          }
          // If default is blacklisted too, try to find any non-blacklisted link
          if (!blacklistSet.has(bgData.default.link)) {
            setCurrentBackground(bgData.default.link);
            setFilmTitle(metadataData[bgData.default.source]?.title || "");
          } else {
            // try to find any link across all sources that's not blacklisted
            let found: { link: string; sourceTitle?: string } | null = null;
            for (const s of bgData.sources) {
              for (const l of s.links) {
                if (!blacklistSet.has(l)) {
                  found = { link: l, sourceTitle: s.title };
                  break;
                }
              }
              if (found) break;
            }

            if (found) {
              const meta = metadataData[found.sourceTitle!];
              setCurrentBackground(found.link);
              setFilmTitle(meta?.title || "");
            } else {
              // No non-blacklisted backgrounds available; clear selection
              setCurrentBackground("");
              setFilmTitle("");
            }
          }
          setLoading(false);
          return;
        }

        // Pick a random link from valid candidates. Prefer a different link
        // than the current background to ensure users see an immediate change.
        let selected: { link: string; sourceTitle: string } | null = null;
        if (allLinks.length === 1) {
          selected = allLinks[0];
        } else {
          // try up to 5 times to pick a different link
          for (let i = 0; i < 5; i++) {
            const idx = Math.floor(Math.random() * allLinks.length);
            const candidate = allLinks[idx];
            if (candidate.link !== currentBackground) {
              selected = candidate;
              break;
            }
          }
          // fallback to any link
          if (!selected)
            selected = allLinks[Math.floor(Math.random() * allLinks.length)];
        }

        // If the selected link equals the current background (rare), append
        // a cache-busting query param so the browser reloads it without a full page refresh.
        let chosenLink = selected.link;
        if (chosenLink === currentBackground) {
          const sep = chosenLink.includes("?") ? "&" : "?";
          chosenLink = `${chosenLink}${sep}cb=${Date.now()}`;
        }

        console.log(
          "useBackground: selected source",
          selected?.sourceTitle,
          "link",
          chosenLink,
        );

        // Resolve metadata. When the pick came from the favorites
        // pool the sourceTitle is the sentinel "__favorites__" — not
        // a real metadata key — so look up the actual originating
        // film by scanning bgData.sources for the URL. Falls back to
        // a blank filmTitle if the favorite doesn't belong to any
        // tracked source (e.g., a one-off URL the user hearted from
        // the right-click menu on a custom background).
        let resolvedMetadata = metadataData[selected.sourceTitle];
        if (!resolvedMetadata && selected.sourceTitle === "__favorites__") {
          const originSource = bgData.sources.find((s) =>
            s.links.includes(selected!.link)
          );
          if (originSource) {
            resolvedMetadata = metadataData[originSource.title];
          }
        }

        setCurrentBackground(chosenLink);
        setFilmTitle(resolvedMetadata?.title ?? "");

        setLoading(false);
      } catch (error) {
        console.error("Error loading background:", error);
        setLoading(false);
      }
    };

    loadBackground();

    // Re-run selection when the blacklist changes — the current image
    // may have been removed and we need a replacement. Favorites
    // changes are intentionally NOT a trigger: favoriting is a passive
    // bookmark and shouldn't shuffle the displayed photo. New
    // favorites become eligible for the next natural rotation.
    const reload = () => loadBackground();
    window.addEventListener("ghiblify:blacklist:add", reload as EventListener);
    window.addEventListener(
      "ghiblify:blacklist:cleared",
      reload as EventListener,
    );

    return () => {
      window.removeEventListener(
        "ghiblify:blacklist:add",
        reload as EventListener,
      );
      window.removeEventListener(
        "ghiblify:blacklist:cleared",
        reload as EventListener,
      );
    };
  }, [backgroundSelection, online]);

  // Persist the most recent background URL to localStorage. The
  // inline script in `newtab.html` reads this on the NEXT new-tab
  // load and paints it on <body> before React mounts, so users see
  // their previous wallpaper instantly. On the very first load ever
  // (no cache), the script falls back to chihiro043.jpg.
  useEffect(() => {
    if (!currentBackground) return;
    try {
      localStorage.setItem("ghiblify:lastBg", currentBackground);
    } catch {
      /* ignore — quota exceeded / private context */
    }
  }, [currentBackground]);

  return { currentBackground, filmTitle, loading };
};
