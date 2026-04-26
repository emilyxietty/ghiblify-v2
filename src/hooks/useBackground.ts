import { useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";

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

  useEffect(() => {
    const loadBackground = async () => {
      try {
        const [bgResponse, metadataResponse] = await Promise.all([
          fetch(chrome.runtime.getURL("background_en.json")),
          fetch(chrome.runtime.getURL("movie_metadata.json")),
        ]);

        const bgData: BackgroundData = await bgResponse.json();
        const metadataData: MovieMetadataData = await metadataResponse.json();

        // Load persisted blacklist and filter sources according to user's backgroundSelection preferences
        let blacklistSet = new Set<string>();
        try {
          const raw = localStorage.getItem("ghiblify_blacklist");
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) blacklistSet = new Set(parsed);
        } catch (e) {
          console.warn("useBackground: failed to parse blacklist", e);
        }

        // Filter sources according to user's backgroundSelection preferences
        const allowedSources = bgData.sources.filter(
          (s) =>
            // default to true when not specified
            (backgroundSelection && backgroundSelection[s.title]) ?? true
        );

        const sourcesToUse =
          allowedSources.length > 0 ? allowedSources : bgData.sources;

        console.log("useBackground: backgroundSelection", backgroundSelection);
        console.log(
          "useBackground: allowed source titles",
          sourcesToUse.map((s) => s.title)
        );

        // Only use sources that have metadata entries - prevents selecting a
        // background whose metadata is missing and falling back to the default.
        const validSources = sourcesToUse.filter(
          (s) => !!metadataData[s.title]
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
        try {
          const rawFav = localStorage.getItem("ghiblify_favorites");
          const favArr = rawFav ? (JSON.parse(rawFav) as string[]) : [];
          if (Array.isArray(favArr)) {
            favArr.forEach((link) => {
              if (!blacklistSet.has(link) && !seen.has(link)) {
                allLinks.push({ link, sourceTitle: "__favorites__" });
                seen.add(link);
              }
            });
          }
        } catch (e) {
          console.warn("useBackground: failed to parse favorites", e);
        }

        if (allLinks.length === 0) {
          console.log(
            "useBackground: no candidate links with metadata found, falling back to default"
          );
          // Self-heal — when the pool is empty (no enabled movies AND
          // no favorites), auto-enable the first available source so
          // the user is never stranded with nothing to rotate. Picks
          // the first source that has metadata + at least one
          // non-blacklisted link.
          const firstAvailableSource = bgData.sources.find(
            (s) =>
              !!metadataData[s.title] &&
              s.links.some((l) => !blacklistSet.has(l))
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
          chosenLink
        );

        // Get metadata for this source (exists because we filtered validSources)
        const metadata = metadataData[selected.sourceTitle];

        setCurrentBackground(chosenLink);
        setFilmTitle(metadata.title);

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
      reload as EventListener
    );

    return () => {
      window.removeEventListener(
        "ghiblify:blacklist:add",
        reload as EventListener
      );
      window.removeEventListener(
        "ghiblify:blacklist:cleared",
        reload as EventListener
      );
    };
  }, [backgroundSelection]);

  return { currentBackground, filmTitle, loading };
};
