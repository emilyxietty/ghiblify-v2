import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon } from "../../ui/Icons/Icons";
import { ContextMenu } from "../../ui/ContextMenu/ContextMenu";
import { assetUrl } from "../../../utils/assetUrl";
import { Z_FLOATING } from "../../../utils/zLayers";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import { FavoriteBorderIcon, FavoriteIcon } from "../../ui/Icons/Icons";
import {
  migrateToImageSelection,
  readFavorites,
  readImageSelection,
  writeFavorites,
  writeImageSelection,
} from "../../../storage/backgroundStorage";
import "./BackgroundSettingsModal.css";

// export const BackgroundSettingsModal: React.FC = (
interface BackgroundSettingsModalProps {
  showBackgroundSettings: boolean;
  setShowBackgroundSettings: (show: boolean) => void;
}

// Every image belonging to a film: the stills plus the animated ones,
// which live in their own array so the rotation can drop them without
// touching the per-film selection. The modal is the film's library, so
// it lists both regardless of the animated setting - that setting
// governs the rotation, not what you can browse, favourite or trash.
const filmImages = (source?: {
  links?: string[];
  animated?: string[];
} | null): string[] => [...(source?.links ?? []), ...(source?.animated ?? [])];


// Where the blown-up preview sits: beside the tile, on whichever side
// has room, clamped so it never runs off the top or bottom. Width is
// capped against the viewport too, so this still behaves on a small
// window where "beside" is most of the screen.
const PREVIEW_WIDTH = 420;
const PREVIEW_GAP = 14;

const previewPosition = (rect: DOMRect): React.CSSProperties => {
  const width = Math.min(PREVIEW_WIDTH, window.innerWidth - 2 * PREVIEW_GAP);
  const roomRight = window.innerWidth - rect.right - PREVIEW_GAP;
  const left =
    roomRight >= width
      ? rect.right + PREVIEW_GAP
      : Math.max(PREVIEW_GAP, rect.left - PREVIEW_GAP - width);
  // Centred on the tile, then pushed back inside the viewport. The
  // height is unknown until the image loads, so the clamp uses the
  // width and a generous 16:10 guess rather than measuring.
  const guessHeight = width * 0.68;
  const top = Math.min(
    Math.max(PREVIEW_GAP, rect.top + rect.height / 2 - guessHeight / 2),
    Math.max(PREVIEW_GAP, window.innerHeight - guessHeight - PREVIEW_GAP),
  );
  return { left, top, width };
};

export const BackgroundSettingsModal: React.FC<
  BackgroundSettingsModalProps
> = ({ showBackgroundSettings, setShowBackgroundSettings }) => {
  const t = useT();
  if (!showBackgroundSettings) return null;
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  // Close modal when clicking outside dialog
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!dialogRef.current) return;
      // The film context menu is portalled to <body>, so its clicks are
      // "outside the dialog" as far as contains() can tell - without
      // this, choosing Select all closed the entire modal instead of
      // running the action.
      if ((e.target as HTMLElement).closest?.(".ctx-menu")) return;
      if (!(dialogRef.current as any).contains(e.target as Node)) {
        setShowBackgroundSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [setShowBackgroundSettings]);
  const { currentBackground } = useAppContext();
  //   const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [movies, setMovies] = useState<Array<{ key: string; title: string }>>(
    [],
  );
  const [availableBackgroundTitles, setAvailableBackgroundTitles] = useState<
    Set<string>
  >(new Set());
  const [backgroundSources, setBackgroundSources] = useState<
    Array<{ title: string; links?: string[]; animated?: string[] }>
  >([]);

  useEffect(() => {
    // Fetch movie metadata and background sources so we can mark which movies
    // actually have backgrounds available.
    let mounted = true;
    // Resolved relatively for the same reason the bundled assets are:
    // a leading slash is the origin root, which is the extension root
    // under chrome-extension:// but the host site's root when the same
    // bundle is served from a subdirectory - where both fetches 404 and
    // the modal renders "0 movies" with an empty list.
    Promise.all([
      fetch(assetUrl("movie_metadata.json")),
      fetch(assetUrl("background.json")),
    ])
      .then(async ([metaRes, bgRes]) => {
        const data = await metaRes.json();
        const bgData = await bgRes.json();
        if (!mounted) return;
        // Fold any legacy settings before reading the selection below.
        // useBackground normally gets here first, but it short-circuits
        // while offline and never loads the library - so an offline user
        // opening the picker would see everything selected, curate
        // against that, and have the old blacklist applied on top of
        // their new choices the next time they came online. Whichever
        // surface loads background.json first does the conversion.
        migrateToImageSelection(bgData.sources || []);
        setImageSelection(readImageSelection());
        const list = Object.entries(data).map(([key, val]) => ({
          key,
          title: (val as any).title || key,
        }));
        setMovies(list);
        const titles = new Set<string>();
        // store normalized titles (lowercased) for more forgiving matching
        (bgData.sources || []).forEach((s: any) =>
          titles.add((s.title || "").toLowerCase().trim()),
        );
        setAvailableBackgroundTitles(titles);
        setBackgroundSources(bgData.sources || []);
      })
      .catch((err) =>
        console.log(
          "LeftSidebar: failed to load movie metadata or backgrounds",
          err,
        ),
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showBackgroundSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBackgroundSettings(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showBackgroundSettings]);

  // Which images rotate, per film. An absent entry means the whole
  // film - see the storage module for why absence, not a full list, is
  // the default. Kept in sync with the sidebar, which can drop the
  // photo on screen while the picker is open.
  const [imageSelection, setImageSelection] = React.useState<
    Record<string, string[]>
  >(() => readImageSelection());
  React.useEffect(() => {
    const refresh = () => setImageSelection(readImageSelection());
    window.addEventListener("ghiblify:background:deselect", refresh);
    window.addEventListener("ghiblify:background:selection", refresh);
    return () => {
      window.removeEventListener("ghiblify:background:deselect", refresh);
      window.removeEventListener("ghiblify:background:selection", refresh);
    };
  }, []);

  // Every image the library knows, and the film it came from. Selection
  // is stored per film, so any URL-first question - is this one in? -
  // starts by finding its film.
  const filmOf = React.useMemo(() => {
    const map = new Map<string, string>();
    backgroundSources.forEach((s) =>
      [...(s.links ?? []), ...(s.animated ?? [])].forEach((l) =>
        map.set(l, s.title),
      ),
    );
    return map;
  }, [backgroundSources]);

  // Favorites state - persisted in the shared ghiblify_background
  // blob. Mutations broadcast `ghiblify:favorites:change` so the
  // sidebar heart button + useBackground stay in sync.
  const [favorites, setFavorites] = React.useState<Set<string>>(
    () => new Set(readFavorites()),
  );
  React.useEffect(() => {
    const refresh = () => setFavorites(new Set(readFavorites()));
    window.addEventListener("ghiblify:favorites:change", refresh);
    return () =>
      window.removeEventListener("ghiblify:favorites:change", refresh);
  }, []);
  // Toggle favorite for an arbitrary URL (used by the heart on each
  // movie thumbnail). Auto-select the first available source if
  // removing the last favorite would empty the rotation pool.
  const toggleFavorite = React.useCallback(
    (url: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        writeFavorites(Array.from(next));
        window.dispatchEvent(new CustomEvent("ghiblify:favorites:change"));
        return next;
      });
    },
    [],
  );

  const isSelected = React.useCallback(
    (url: string) => {
      // A favourite always rotates. It is the strongest thing a user can
      // say about an image, so it outranks the checkbox rather than
      // competing with it - which is also why the tile refuses to
      // deselect one, and the heart is the way back out.
      if (favorites.has(url)) return true;
      const title = filmOf.get(url);
      // A URL from outside the library (a favorite hearted elsewhere)
      // belongs to no film, so no film can exclude it.
      if (!title) return true;
      const chosen = imageSelection[title];
      return !chosen || chosen.includes(url);
    },
    [filmOf, imageSelection, favorites],
  );

  // Select / deselect any set of images, in one write. Grouped by film
  // because that is how selection is stored, and a film only gains an
  // entry once it stops being "all of it" - so a full film collapses
  // back to no entry at all, and keeps taking future images with it.
  const setSelected = React.useCallback(
    (urls: string[], selected: boolean) => {
      setImageSelection((prev) => {
        const byFilm = new Map<string, string[]>();
        // A favourite cannot be deselected - "Select none" over a film
        // leaves the hearted ones standing rather than quietly undoing
        // the stronger choice.
        const targets = selected ? urls : urls.filter((u) => !favorites.has(u));
        targets.forEach((url) => {
          const title = filmOf.get(url);
          if (!title) return;
          byFilm.set(title, [...(byFilm.get(title) ?? []), url]);
        });
        if (!byFilm.size) return prev;

        const next = { ...prev };
        let changed = false;
        byFilm.forEach((touched, title) => {
          const source = backgroundSources.find((s) => s.title === title);
          const all = filmImages(source);
          const current = next[title] ?? all;
          const hit = new Set(touched);
          const after = selected
            ? all.filter((l) => current.includes(l) || hit.has(l))
            : current.filter((l) => !hit.has(l));
          if (after.length === current.length) return;
          changed = true;
          if (after.length === all.length) delete next[title];
          else next[title] = after;
        });
        if (!changed) return prev;
        writeImageSelection(next);
        // Only nudge the rotation when the wallpaper on screen is the
        // one being dropped. Re-picking on every toggle would reshuffle
        // the page behind the modal while the user is curating.
        if (
          !selected &&
          currentBackground &&
          targets.some((u) => u === currentBackground)
        ) {
          window.dispatchEvent(new CustomEvent("ghiblify:background:refresh"));
        }
        return next;
      });
    },
    [currentBackground, filmOf, backgroundSources, favorites],
  );

  // Which film the pane is showing, and which view it is in. "film"
  // follows the rail; the other three are cross-film sets, which is the
  // reason the pane exists - "everything I favourited" belongs to no
  // single film and had nowhere to live in the old per-film accordion.
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [view, setView] = useState<
    "film" | "favorites" | "animated"
  >("film");

  const sourceFor = React.useCallback(
    (movieKey: string) => {
      const mk = (movieKey || "").toLowerCase().trim();
      return (
        backgroundSources.find((s) => {
          const st = (s.title || "").toLowerCase().trim();
          return st === mk || st.includes(mk) || mk.includes(st);
        }) || null
      );
    },
    [backgroundSources],
  );

  const animatedSet = React.useMemo(
    () => new Set(backgroundSources.flatMap((s) => s.animated ?? [])),
    [backgroundSources],
  );

  // Which films background.json actually carries images for. Matching is
  // forgiving because the metadata key and the source title are written
  // by hand and don't always agree ("arietty" vs "arrietty").
  const availMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    movies.forEach((m) => {
      const mk = (m.key || "").toLowerCase().trim();
      map.set(
        m.key,
        Array.from(availableBackgroundTitles).some(
          (title) => title === mk || title.includes(mk) || mk.includes(title),
        ),
      );
    });
    return map;
  }, [movies, availableBackgroundTitles]);

  // Library-wide tally for the header. Sits next to the film count
  // because between them they answer "how much of this is switched on",
  // which the per-film rail can only answer one film at a time.
  const libraryTotals = React.useMemo(() => {
    let total = 0;
    let selected = 0;
    backgroundSources.forEach((s) => {
      const all = filmImages(s);
      total += all.length;
      selected += all.filter(isSelected).length;
    });
    return { total, selected };
  }, [backgroundSources, isSelected]);

  // Right-click a film row: the bulk actions for that film, without
  // having to scroll to its section first.
  const [railMenu, setRailMenu] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);

  // Hover-hold preview. A 124px tile is enough to recognise a wallpaper
  // you have seen, not enough to judge one you have not - so resting on
  // a tile blows it up. Delayed, because the same gesture happens by
  // accident on the way to somewhere else.
  const PREVIEW_DELAY_MS = 550;
  const [preview, setPreview] = useState<{ url: string; rect: DOMRect } | null>(
    null,
  );
  const previewTimer = useRef<number | undefined>(undefined);
  const cancelPreview = React.useCallback(() => {
    window.clearTimeout(previewTimer.current);
    setPreview(null);
  }, []);
  const schedulePreview = React.useCallback((url: string, el: HTMLElement) => {
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(
      () => setPreview({ url, rect: el.getBoundingClientRect() }),
      PREVIEW_DELAY_MS,
    );
  }, []);
  // The stored rect goes stale the moment anything moves, and a preview
  // pointing at where a tile used to be is worse than none.
  useEffect(() => {
    if (!preview) return;
    window.addEventListener("scroll", cancelPreview, true);
    window.addEventListener("resize", cancelPreview);
    return () => {
      window.removeEventListener("scroll", cancelPreview, true);
      window.removeEventListener("resize", cancelPreview);
    };
  }, [preview, cancelPreview]);
  useEffect(() => () => window.clearTimeout(previewTimer.current), []);

  // One section per film, in rail order, filtered by the active chip.
  // A film with nothing to show under the current filter is dropped
  // entirely rather than left as an empty heading.
  const sections = React.useMemo(() => {
    const match = (url: string) =>
      view === "favorites"
        ? favorites.has(url)
        : view === "animated"
          ? animatedSet.has(url)
          : true;
    return movies
      .map((m) => {
        const all = filmImages(sourceFor(m.key));
        const images = all.filter(match);
        return {
          key: m.key,
          title: m.title,
          all,
          images,
          kept: all.filter(isSelected).length,
        };
      })
      .filter((sec) => sec.images.length > 0);
  }, [movies, sourceFor, view, favorites, animatedSet, isSelected]);

  // The rail is a table of contents now: it reports which film the
  // scroller is on, and jumps to one when clicked.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !sections.length) return;
    // rootMargin pulls the "current" line up to just under the sticky
    // header, so the film whose heading is at the top of the pane is the
    // one the rail highlights - not the one still occupying most of the
    // scroller below it.
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        const key = (top?.target as HTMLElement | undefined)?.dataset.film;
        if (key) setSelectedKey(key);
      },
      { root, rootMargin: "-8px 0px -80% 0px", threshold: 0 },
    );
    sectionRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const jumpToFilm = React.useCallback((key: string) => {
    setSelectedKey(key);
    sectionRefs.current
      .get(key)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Open on the film the wallpaper on screen came from, so the modal
  // lands on what you are looking at. Runs once the sources arrive, and
  // only while nothing is selected - re-running would yank the pane away
  // from the user mid-browse every time the background rotated.
  useEffect(() => {
    if (selectedKey || !movies.length || !backgroundSources.length) return;
    const holder = movies.find((m) =>
      filmImages(sourceFor(m.key)).includes(currentBackground),
    );
    setSelectedKey(holder?.key ?? movies[0].key);
  }, [movies, backgroundSources, currentBackground, selectedKey, sourceFor]);

  return (
    <div className="background-modal-overlay">
      <dialog
        ref={dialogRef}
        className="background-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          // The dialog stops mousedown from reaching document, which is
          // where ContextMenu listens for the click that dismisses it -
          // so inside the modal, that click never arrived and the film
          // menu stayed open. Close it here instead, unless the click
          // landed in the menu itself.
          e.stopPropagation();
          if (railMenu && !(e.target as HTMLElement).closest(".ctx-menu")) {
            setRailMenu(null);
          }
        }}
      >
        <div className="modal-header">
          <h4>{t("background.modal.title")}</h4>
          <div>
            {t("background.modal.moviesCount", { count: movies.length })}
            {libraryTotals.total > 0 && (
              <span className="bg-headcount">
                {t("background.modal.selectedCount", {
                  selected: String(libraryTotals.selected),
                  total: String(libraryTotals.total),
                })}
              </span>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="modal-close"
              onClick={() => setShowBackgroundSettings(false)}
              aria-label={t("modal.common.closeAria")}
            >
              ×
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="bg-split">
            {/* Left: the rotation control. Every film visible at once,
                no expanding - picking a film only changes what the pane
                shows, it never moves anything else. */}
            <div className="bg-rail">
              <div className="bg-rail-list">
                {movies.map((m) => {
                  const available = availMap.get(m.key) || false;
                  const source = sourceFor(m.key);
                  const all = filmImages(source);
                  const kept = all.filter(isSelected).length;
                  const animated = (source?.animated ?? []).filter(
                    isSelected,
                  ).length;
                  const isSel = selectedKey === m.key;
                  return (
                    <button
                      type="button"
                      key={m.key}
                      className={`bg-filmrow${isSel ? " is-selected" : ""}${
                        available ? "" : " is-empty"
                      }${
                        all.length === 0
                          ? ""
                          : kept === 0
                            ? " is-off"
                            : kept < all.length
                              ? " is-partial"
                              : " is-on"
                      }`}
                      aria-current={isSel}
                      // A table of contents entry: it takes you to the
                      // film rather than swapping what the pane shows.
                      onClick={() => jumpToFilm(m.key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!all.length) return;
                        setRailMenu({ key: m.key, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <span className="bg-filmname">{m.title}</span>
                      {animated > 0 && (
                        <span
                          className="bg-animdot"
                          data-tooltip={t("background.modal.animatedSub", {
                            count: String(animated),
                          })}
                        />
                      )}
                      {/* The count is the whole state of the film now
                          that the checkbox is gone: a bare number means
                          all of it, "12/42" means partly chosen, "0/42"
                          means none - which is what switching the film
                          off used to be. */}
                      <span className="bg-filmcount">
                        {kept < all.length ? `${kept}/${all.length}` : kept}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: every film, one after another, each starting a
                row of its own. The pane used to show one film at a time
                with the rail switching between them; as a continuous
                list the rail stops being a switch and becomes a table of
                contents - it says where you are and takes you somewhere,
                but the library is one scroll from end to end. */}
            <div className="bg-pane">
              <div className="bg-filters">
                {(
                  [
                    ["film", t("background.modal.filterAll"), libraryTotals.total],
                    [
                      "favorites",
                      t("background.modal.favoritesTitle"),
                      favorites.size,
                    ],
                    [
                      "animated",
                      t("background.modal.animatedTitle"),
                      animatedSet.size,
                    ],
                  ] as const
                ).map(([key, label, count]) =>
                  key === "film" || count > 0 ? (
                    <button
                      key={key}
                      type="button"
                      className="bg-chip"
                      aria-pressed={view === key}
                      onClick={() => setView(key as typeof view)}
                    >
                      {label} {count}
                    </button>
                  ) : null,
                )}
              </div>

              <div className="bg-pane-scroll" ref={scrollRef}>
                {sections.length === 0 ? (
                  <div className="bg-empty">
                    {t("background.modal.noBackgrounds")}
                  </div>
                ) : (
                  sections.map(({ key, title, images, all, kept }) => (
                    <section
                      className="bg-section"
                      key={key}
                      data-film={key}
                      ref={(el) => {
                        if (el) sectionRefs.current.set(key, el);
                        else sectionRefs.current.delete(key);
                      }}
                    >
                      {/* Sticky, so you always know which film the tiles
                          under the cursor belong to - the thing the old
                          one-film-at-a-time pane never had to say. */}
                      <header className="bg-section-head">
                        <h5>{title}</h5>
                        <span className="bg-section-count">
                          {kept < all.length ? `${kept}/${all.length}` : kept}
                        </span>
                        {/* Both actions, always present - each just
                            goes dead at the end where it has nothing to
                            do. A single flipping button saved a chip but
                            meant the action under the cursor changed
                            identity after every click. Deselect all
                            counts favourites out, since they are pinned
                            and cannot be deselected. */}
                        <span className="bg-bulk bg-section-bulk">
                          <button
                            type="button"
                            className="bg-chip"
                            disabled={kept === all.length}
                            onClick={() => setSelected(all, true)}
                          >
                            {t("background.modal.selectAllInFilm")}
                          </button>
                          <button
                            type="button"
                            className="bg-chip"
                            disabled={
                              !all.some(
                                (l) => isSelected(l) && !favorites.has(l),
                              )
                            }
                            onClick={() => setSelected(all, false)}
                          >
                            {t("background.modal.selectNoneInFilm")}
                          </button>
                        </span>
                      </header>
                      <div className="bg-grid">
                        {images.map((url) => {
                      const isFav = favorites.has(url);
                      const isCurrent = !!currentBackground && url === currentBackground;
                      const isAnimated = animatedSet.has(url);
                      const isOut = !isSelected(url);
                      // Pinned by the heart: shown checked, and the tile
                      // stops toggling. Unhearting is the way out, so the
                      // control that put it there is the one that frees
                      // it - no second way to undo the same thing.
                      const isPinned = isFav;

                      return (
                        // The tile is the checkbox: the image had no click
                        // action before, so the whole thing is the target
                        // rather than a 17px box you have to hit. role +
                        // aria-checked because a <div> is not a control,
                        // and it cannot be a <button> - the heart inside
                        // it is one, and buttons do not nest.
                        <div
                          className={`thumb-wrap bg-cell${isCurrent ? " is-current" : ""}${
                            isOut ? " is-deselected" : ""
                          }${isPinned ? " is-pinned" : ""}`}
                          key={url}
                          role="checkbox"
                          aria-checked={!isOut}
                          aria-disabled={isPinned}
                          tabIndex={0}
                          aria-label={
                            isPinned
                              ? t("background.modal.favoritesAlwaysOn")
                              : isOut
                                ? t("background.modal.selectOneAria")
                                : t("background.modal.deselectOneAria")
                          }
                          // Spelled out, because a ring and a grey tile are
                          // conventions the user has to have learned first.
                          data-tooltip={
                            isPinned
                              ? t("background.modal.favoritesAlwaysOn")
                              : isOut
                                ? t("background.modal.tileDeselected")
                                : t("background.modal.tileSelected")
                          }
                          onClick={() => {
                            cancelPreview();
                            if (isPinned) return;
                            setSelected([url], isOut);
                          }}
                          onMouseEnter={(e) =>
                            schedulePreview(url, e.currentTarget)
                          }
                          onMouseLeave={cancelPreview}
                          onFocus={(e) => schedulePreview(url, e.currentTarget)}
                          onBlur={cancelPreview}
                          onKeyDown={(e) => {
                            if (e.key !== " " && e.key !== "Enter") return;
                            // Space scrolls the pane otherwise, which is
                            // the opposite of "toggle the thing I am on".
                            e.preventDefault();
                            if (isPinned) return;
                            setSelected([url], isOut);
                          }}
                        >
                          <img
                            src={url}
                            alt=""
                            aria-hidden="true"
                            className="summary-thumb"
                            loading="lazy"
                            draggable={false}
                          />
                          {/* The ring says selected at a glance across the
                              whole grid; the badge says it on the picture
                              itself, for when one tile is all you are
                              looking at. Deselected tiles carry no badge -
                              the empty corner and the grey are the state. */}
                          <span className="bg-cellbar">
                            {!isOut && (
                              <span className="bg-check" aria-hidden="true">
                                <CheckIcon fontSize="small" />
                              </span>
                            )}
                            <button
                              type="button"
                              className={`thumb-fav${isFav ? " is-favorited" : ""}`}
                              aria-label={
                                isFav
                                  ? t("background.modal.unfavoriteOneAria")
                                  : t("background.modal.favoriteOneAria")
                              }
                              data-tooltip={
                                isFav
                                  ? t("background.modal.unfavoriteOne")
                                  : t("background.modal.favoriteOne")
                              }
                              aria-pressed={isFav}
                              // The tile toggles selection, so the heart
                              // has to keep its click to itself.
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(url);
                              }}
                            >
                              {isFav ? (
                                <FavoriteIcon fontSize="small" />
                              ) : (
                                <FavoriteBorderIcon fontSize="small" />
                              )}
                            </button>
                          </span>
                          {isAnimated && (
                            <span className="bg-badge">
                              {t("background.modal.animatedBadge")}
                            </span>
                          )}
                        </div>
                      );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </dialog>

      {/* Portalled to <body>, not rendered in the grid. The grid clips
          its own overflow, and .background-modal keeps a transform from
          its entrance animation - which makes it the containing block
          for anything fixed inside it. Either one alone would trap the
          preview inside the pane it is meant to escape. */}
      {railMenu &&
        (() => {
          const source = sourceFor(railMenu.key);
          const all = filmImages(source);
          const kept = all.filter(isSelected).length;
          const title =
            movies.find((m) => m.key === railMenu.key)?.title ?? railMenu.key;
          return (
            <ContextMenu
              position={{ x: railMenu.x, y: railMenu.y }}
              onClose={() => setRailMenu(null)}
              items={[
                { type: "info", label: `${title} - ${kept}/${all.length}` },
                { type: "separator" },
                {
                  type: "action",
                  label: t("background.modal.selectAllInFilm"),
                  onClick: () => {
                    setSelected(all, true);
                    setRailMenu(null);
                  },
                },
                {
                  type: "action",
                  label: t("background.modal.selectNoneInFilm"),
                  onClick: () => {
                    setSelected(all, false);
                    setRailMenu(null);
                  },
                },
              ]}
            />
          );
        })()}

      {preview &&
        createPortal(
          <div
            className="bg-preview"
            style={{ ...previewPosition(preview.rect), zIndex: Z_FLOATING }}
            aria-hidden="true"
          >
            <img src={preview.url} alt="" draggable={false} />
          </div>,
          document.body,
        )}
    </div>
  );
};
