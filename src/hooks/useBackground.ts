import { useEffect, useState } from "react";
import {
  migrateToImageSelection,
  readFavorites,
  readImageSelection,
  writeImageSelection,
} from "../storage/backgroundStorage";
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


interface BackgroundSource {
  title: string;
  links: string[];
  /** Animated stills (gif / animated webp) from the same film, kept in
   *  their own array rather than mixed into `links` so the "animated
   *  backgrounds" setting can drop them from the pool without touching
   *  the per-film selection the user made. Sources that are entirely
   *  animated ("soothing (beta)", and whatever is still unattributed)
   *  carry an empty `links`. */
  animated?: string[];
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

// URLs that failed to load this session. A rotation pick is verified
// with a real image fetch before it's painted; failures land here and
// are skipped on re-picks. Session-scoped ON PURPOSE - a favorite
// that 404s might be a transient host hiccup, so we never silently
// delete it from the user's stored favorites; it just sits out until
// the next full page load gives it another chance.
const deadUrls = new Set<string>();

// The library, kept from the last successful load. The deselect event
// carries only a URL, and turning that into "this film, minus this
// image" needs background.json - this hook is the one place that is
// always mounted AND has it, so it does the resolving for everyone.
let loadedSources: BackgroundSource[] = [];

/** Which film an image belongs to, or null for a URL the library does
 *  not know (a favorite hearted from somewhere else). */
const sourceOf = (url: string): BackgroundSource | null =>
  loadedSources.find(
    (s) => s.links.includes(url) || (s.animated ?? []).includes(url),
  ) ?? null;

/** The images of `source` that rotate: its whole list unless the user
 *  has curated that film, in which case exactly what they kept. */
const selectedImages = (
  source: BackgroundSource,
  selection: Record<string, string[]>,
): string[] => {
  const all = [...source.links, ...(source.animated ?? [])];
  const chosen = selection[source.title];
  if (!chosen) return all;
  const keep = new Set(chosen);
  return all.filter((l) => keep.has(l));
};

/** Drop one image from the rotation, from anywhere in the app. Writes
 *  the film's remaining images, so the film goes from "all of it" to an
 *  explicit list the moment the user first removes something. */
export const deselectBackground = (url: string): void => {
  const source = sourceOf(url);
  if (!source) return;
  const all = [...source.links, ...(source.animated ?? [])];
  const selection = readImageSelection();
  const current = selection[source.title] ?? all;
  if (!current.includes(url)) return;
  writeImageSelection({
    ...selection,
    [source.title]: current.filter((l) => l !== url),
  });
};

// Resolve true iff the browser can actually decode an image at `url`.
// Warms the HTTP cache, so the CSS background-image that follows is
// served instantly from cache.
const preloadImage = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

export const useBackground = () => {
  const [currentBackground, setCurrentBackground] = useState<string>("");
  const [filmTitle, setFilmTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const online = useOnline();

  useEffect(() => {
    // Offline short-circuit - every URL in background.json is
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

        loadedSources = bgData.sources;
        // One-shot conversion of the retired blacklist / per-film
        // switches / animated flag. Runs here because this is the first
        // point in the app where both the stored blob and the library
        // are in hand.
        migrateToImageSelection(bgData.sources);
        const imageSelection = readImageSelection();

        // Every film is a candidate now. Which of its images rotate is
        // the film's entry in imageSelection - a film the user emptied
        // contributes nothing, which is what switching one off used to
        // mean and is now just the same choice made image by image.
        const sourcesToUse = bgData.sources;

        // Only use sources that have metadata entries - prevents selecting a
        // background whose metadata is missing and falling back to the default.
        const validSources = sourcesToUse.filter(
          (s) => !!metadataData[s.title],
        );

        // Collect every selected link with its source title
        const allLinks: { link: string; sourceTitle: string }[] = [];
        const seen = new Set<string>();

        // Moving images are just images: they sit under their own film,
        // carry its metadata, and are selected or not one at a time like
        // any still. The library-wide "animated backgrounds" switch that
        // used to gate them here is gone.
        validSources.forEach((source) => {
          selectedImages(source, imageSelection).forEach((link) => {
            if (!seen.has(link)) {
              allLinks.push({ link, sourceTitle: source.title });
              seen.add(link);
            }
          });
        });

        // Favorites are always eligible - hearting an image pins it
        // into the rotation, which is why the picker will not let one
        // be deselected either. Add any favorited URL not already
        // pulled in by its film.
        readFavorites().forEach((link) => {
          if (seen.has(link)) return;
          allLinks.push({ link, sourceTitle: "__favorites__" });
          seen.add(link);
        });

        if (allLinks.length === 0) {
          // Nothing selected anywhere. This used to silently switch a
          // film back on so the user was never stranded - which meant
          // the app quietly undoing a deliberate choice. Now that every
          // image is individually selectable and "Reselect all" is one
          // click away in the picker, the honest response is to show the
          // bundled default and change nothing.
          const stillSelected = (s: BackgroundSource) =>
            selectedImages(s, imageSelection);
          // The default ships with the extension and belongs to no
          // film's selection unless the library happens to include it.
          const defaultDeselected = bgData.sources.some(
            (s) =>
              (s.links.includes(bgData.default.link) ||
                (s.animated ?? []).includes(bgData.default.link)) &&
              !stillSelected(s).includes(bgData.default.link),
          );
          if (!defaultDeselected) {
            setCurrentBackground(bgData.default.link);
            setFilmTitle(metadataData[bgData.default.source]?.title || "");
          } else {
            // Any still-selected image, from any film.
            let found: { link: string; sourceTitle?: string } | null = null;
            for (const s of bgData.sources) {
              const keep = stillSelected(s);
              if (keep.length) {
                found = { link: keep[0], sourceTitle: s.title };
                break;
              }
            }

            if (found) {
              const meta = metadataData[found.sourceTitle!];
              setCurrentBackground(found.link);
              setFilmTitle(meta?.title || "");
            } else {
              // Nothing selected anywhere - the sidebar's "Deselect all"
              // gets here in one click. A bundled still, like offline:
              // it belongs to no film's selection, so showing it
              // contradicts nothing, and a black "no background found"
              // screen read as a crash.
              const pick =
                OFFLINE_FALLBACKS[Math.floor(Math.random() * OFFLINE_FALLBACKS.length)];
              setCurrentBackground(chrome.runtime.getURL(pick.path));
              setFilmTitle(metadataData[pick.film]?.title || "");
            }
          }
          setLoading(false);
          return;
        }

        // Pick a random link from valid candidates. Prefer a different link
        // than the current background to ensure users see an immediate change.
        const pickCandidate = (
          pool: { link: string; sourceTitle: string }[],
        ): { link: string; sourceTitle: string } => {
          if (pool.length === 1) return pool[0];
          // try up to 5 times to pick a different link
          for (let i = 0; i < 5; i++) {
            const candidate = pool[Math.floor(Math.random() * pool.length)];
            if (candidate.link !== currentBackground) return candidate;
          }
          // fallback to any link
          return pool[Math.floor(Math.random() * pool.length)];
        };

        // Dead-URL protection, OPTIMISTIC edition. The first version
        // AWAITED a full image download before painting anything -
        // which fixed black tabs from rotten favorites but made every
        // tab measurably slower (the old behavior painted the CSS
        // background progressively as bytes streamed). Now: paint the
        // pick immediately, verify in the background, and only when
        // the verify FAILS mark the URL dead and re-run selection -
        // the rare bad pick shows the pre-paint wallpaper for a beat
        // longer, the common good pick costs nothing.
        // NO reset-to-allLinks when the filtered pool empties - that
        // would make the verify-fail → re-run cycle loop forever on an
        // all-dead pool. Empty means "fall back to a bundled asset".
        const pool = allLinks.filter((c) => !deadUrls.has(c.link));
        const selected: { link: string; sourceTitle: string } | null =
          pool.length > 0 ? pickCandidate(pool) : null;
        if (!selected) {
          const pick =
            OFFLINE_FALLBACKS[
              Math.floor(Math.random() * OFFLINE_FALLBACKS.length)
            ];
          setCurrentBackground(chrome.runtime.getURL(pick.path));
          setFilmTitle(pick.film);
          setLoading(false);
          return;
        }
        void preloadImage(selected.link).then((ok) => {
          if (ok) return;
          deadUrls.add(selected.link);
          // Re-run the whole selection - deadUrls now excludes this
          // pick, and if everything is dead the empty-pool branch
          // above lands on a bundled fallback. background.json is a
          // local extension file, so the re-run is effectively free.
          loadBackground();
        });

        // If the selected link equals the current background (rare), append
        // a cache-busting query param so the browser reloads it without a full page refresh.
        let chosenLink = selected.link;
        if (chosenLink === currentBackground) {
          const sep = chosenLink.includes("?") ? "&" : "?";
          chosenLink = `${chosenLink}${sep}cb=${Date.now()}`;
        }

        // Resolve metadata. When the pick came from the favorites
        // pool the sourceTitle is the sentinel "__favorites__" - not
        // a real metadata key - so look up the actual originating
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

    // Re-pick when the image on screen is dropped from the rotation, or
    // when anything asks for a refresh. Favorites changes are
    // intentionally NOT a trigger: favoriting is a passive bookmark and
    // shouldn't shuffle the displayed photo. New favorites become
    // eligible for the next natural rotation.
    const reload = () => loadBackground();
    // Deselecting from outside the picker (the sidebar's "remove this
    // photo") sends the URL and lets this hook do the write - it is the
    // one place that is always mounted and has the library, so it is
    // the only one that can turn a URL into "this film, minus this
    // image". The picker writes its own toggles directly.
    const onDeselect = (e: Event) => {
      const url = (e as CustomEvent<string>)?.detail;
      if (url) deselectBackground(url);
      loadBackground();
    };
    window.addEventListener(
      "ghiblify:background:deselect",
      onDeselect as EventListener,
    );
    window.addEventListener(
      "ghiblify:background:refresh",
      reload as EventListener,
    );

    return () => {
      window.removeEventListener(
        "ghiblify:background:deselect",
        onDeselect as EventListener,
      );
      window.removeEventListener(
        "ghiblify:background:refresh",
        reload as EventListener,
      );
    };
  }, [online]);

  return { currentBackground, filmTitle, loading };
};
