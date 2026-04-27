import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RestoreIcon from "@mui/icons-material/Restore";
import React, { useEffect, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import {
  readBlacklist,
  readFavorites,
  writeBlacklist,
  writeFavorites,
} from "../../storage/backgroundStorage";
import { Button } from "../Button/Button";
import "./BackgroundSettingsModal.css";

// export const BackgroundSettingsModal: React.FC = (
interface BackgroundSettingsModalProps {
  showBackgroundSettings: boolean;
  setShowBackgroundSettings: (show: boolean) => void;
}

// IMPORTANT: defined at module scope (not inside the parent
// component) so its function identity stays stable across parent
// re-renders. Defining a memoized component inside another component
// gives it a fresh identity on every render, which causes React to
// unmount + remount the children — wiping the per-item `open` state.
// That manifested as the dropdowns auto-collapsing every time the
// user hearted, unhearted, or deleted a thumbnail.
type BackgroundListItemProps = {
  movieKey: string;
  title: string;
  enabled: boolean;
  available: boolean;
  links: string[];
  /** Pre-blacklist total — the source's full link count. Shown
   *  alongside `links.length` in the summary so the user can see
   *  how many they've trashed (e.g., "47 / 50"). */
  totalLinks: number;
  disableLast?: boolean;
  defaultOpen?: boolean;
  onUpdate: (k: string, v: boolean) => void;
  favoritedSet: Set<string>;
  onToggleFavorite: (url: string) => void;
};

const BackgroundListItem: React.FC<BackgroundListItemProps> = React.memo(
  ({
    movieKey,
    title,
    enabled,
    available,
    links,
    totalLinks,
    disableLast,
    defaultOpen,
    onUpdate,
    favoritedSet,
    onToggleFavorite,
  }) => {
    const t = useT();
    const [open, setOpen] = React.useState(defaultOpen ?? false);
    React.useEffect(() => {
      if (!available) {
        // eslint-disable-next-line no-console
        console.debug(
          `BackgroundListItem: ${movieKey} (${title}) has no backgrounds. links=${links.length}`,
        );
      }
    }, []);

    return (
      <details
        className="background-toggle"
        style={{ position: "relative" }}
        open={open}
      >
        <summary
          className="background-summary"
          onClick={(e) => {
            // prevent the native toggle since we control `open` state
            e.preventDefault();
            setOpen((s) => !s);
          }}
        >
          <input
            id={`background-toggle-${movieKey}`}
            type="checkbox"
            checked={enabled}
            disabled={!available || !!disableLast}
            // stopPropagation so the click never reaches <summary>'s
            // onClick — that handler calls preventDefault() to block
            // the native <details> toggle, but bubbled preventDefault
            // also kills the checkbox's own toggle, leaving the
            // selected state stuck.
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate(movieKey, e.target.checked)}
          />
          <span className="background-title">
            {title}
            {available && totalLinks > 0 && (
              <span className="background-count">
                {" "}
                (
                {enabled
                  ? links.length
                  : links.filter((l) => favoritedSet.has(l)).length}
                {" / "}
                {totalLinks})
              </span>
            )}
          </span>
          {!available && (
            <span className="background-unavailable">
              {" "}
              {t("background.modal.noBackgrounds")}
            </span>
          )}
        </summary>
        {available && links.length > 0 && (
          <div className="summary-images">
            {links.map((lnk, idx) => {
              const isFav = favoritedSet.has(lnk);
              return (
                <div key={idx} className="thumb-wrap">
                  <img
                    src={lnk}
                    alt={`${title} ${idx}`}
                    className="summary-thumb"
                  />
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(lnk);
                    }}
                  >
                    {isFav ? (
                      <FavoriteIcon fontSize="small" />
                    ) : (
                      <FavoriteBorderIcon fontSize="small" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="thumb-delete"
                    aria-label={t("background.modal.removeImageTitle")}
                    data-tooltip={t("common.delete")}
                    onClick={(e) => {
                      const ev = new CustomEvent("ghiblify:blacklist:add", {
                        detail: lnk,
                      });
                      window.dispatchEvent(ev);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </details>
    );
  },
  (prev, next) =>
    prev.enabled === next.enabled &&
    prev.available === next.available &&
    prev.disableLast === next.disableLast &&
    prev.totalLinks === next.totalLinks &&
    prev.links.join("|") === next.links.join("|") &&
    prev.links.every(
      (l) => prev.favoritedSet.has(l) === next.favoritedSet.has(l),
    ),
);

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
      if (!(dialogRef.current as any).contains(e.target as Node)) {
        setShowBackgroundSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [setShowBackgroundSettings]);
  const { backgroundSelection, updateBackgroundSelection } = useAppContext();
  //   const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [movies, setMovies] = useState<Array<{ key: string; title: string }>>(
    [],
  );
  const [availableBackgroundTitles, setAvailableBackgroundTitles] = useState<
    Set<string>
  >(new Set());
  const [backgroundSources, setBackgroundSources] = useState<
    Array<{ title: string; links?: string[] }>
  >([]);

  useEffect(() => {
    // Fetch movie metadata and background sources so we can mark which movies
    // actually have backgrounds available.
    let mounted = true;
    Promise.all([fetch("/movie_metadata.json"), fetch("/background.json")])
      .then(async ([metaRes, bgRes]) => {
        const data = await metaRes.json();
        const bgData = await bgRes.json();
        if (!mounted) return;
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

  const selectAll = () => {
    movies.forEach((m) => updateBackgroundSelection(m.key, true));
  };

  const deselectAll = () => {
    // Favorites are always-on (no checkbox), so when the user has any
    // we can safely turn off every movie — favorites carry the
    // rotation alone. Otherwise fall back to keeping the first movie.
    if (favorites.size > 0) {
      movies.forEach((m) => updateBackgroundSelection(m.key, false));
      return;
    }
    const keepKey = movies[0]?.key;
    if (!keepKey) return;
    movies.forEach((m) => updateBackgroundSelection(m.key, m.key === keepKey));
  };

  // stable wrapper to avoid creating a new function per render
  const handleUpdateSelection = React.useCallback(
    (key: string, checked: boolean) => updateBackgroundSelection(key, checked),
    [updateBackgroundSelection],
  );

  // BackgroundListItem moved to module scope (above) to keep its
  // identity stable across parent re-renders.

  // blacklist state persisted in the shared ghiblify_background blob
  const [blacklist, setBlacklist] = React.useState<Set<string>>(
    () => new Set(readBlacklist()),
  );

  // handler to add url to blacklist and persist
  const addToBlacklist = React.useCallback((url: string) => {
    setBlacklist((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      writeBlacklist(Array.from(next));
      return next;
    });
  }, []);

  // listen for dispatched events from children (simple decoupling)
  React.useEffect(() => {
    const onAdd = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce?.detail) addToBlacklist(ce.detail);
    };
    window.addEventListener("ghiblify:blacklist:add", onAdd as EventListener);
    return () =>
      window.removeEventListener(
        "ghiblify:blacklist:add",
        onAdd as EventListener,
      );
  }, [addToBlacklist]);

  // clear the blacklist (persisted) and notify listeners
  const clearBlacklist = React.useCallback(() => {
    // guard to avoid accidental clears
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(t("background.modal.restoreConfirm"))) return;
    setBlacklist(new Set());
    writeBlacklist([]);
    // notify other parts of app to re-evaluate backgrounds
    const ev = new CustomEvent("ghiblify:blacklist:cleared");
    window.dispatchEvent(ev);
  }, []);

  // Favorites state — persisted in the shared ghiblify_background
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
        if (next.size === 0) {
          const anyMovieEnabled = movies.some(
            (m) => (backgroundSelection && backgroundSelection[m.key]) ?? true,
          );
          if (!anyMovieEnabled && movies.length > 0) {
            updateBackgroundSelection(movies[0].key, true);
          }
        }
        window.dispatchEvent(new CustomEvent("ghiblify:favorites:change"));
        return next;
      });
    },
    [movies, backgroundSelection, updateBackgroundSelection],
  );

  const removeFavorite = React.useCallback(
    (url: string) => {
      setFavorites((prev) => {
        if (!prev.has(url)) return prev;
        const next = new Set(prev);
        next.delete(url);
        writeFavorites(Array.from(next));
        if (next.size === 0) {
          const anyMovieEnabled = movies.some(
            (m) => (backgroundSelection && backgroundSelection[m.key]) ?? true,
          );
          if (!anyMovieEnabled && movies.length > 0) {
            updateBackgroundSelection(movies[0].key, true);
          }
        }
        window.dispatchEvent(new CustomEvent("ghiblify:favorites:change"));
        return next;
      });
    },
    [movies, backgroundSelection, updateBackgroundSelection],
  );

  // Restore a single image from the blacklist.
  const restoreOne = React.useCallback((url: string) => {
    setBlacklist((prev) => {
      if (!prev.has(url)) return prev;
      const next = new Set(prev);
      next.delete(url);
      writeBlacklist(Array.from(next));
      // tell consumers (useBackground) to re-evaluate so the restored
      // image becomes eligible again for the rotation.
      const ev = new CustomEvent("ghiblify:blacklist:cleared");
      window.dispatchEvent(ev);
      return next;
    });
  }, []);

  return (
    <div className="background-modal-overlay">
      <dialog
        ref={dialogRef}
        className="background-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h4>{t("background.modal.title")}</h4>
          <div>
            {t("background.modal.moviesCount", { count: movies.length })}
          </div>
          <div className="modal-actions">
            {(() => {
              // Compute enabled and available movies
              const availMap = new Map<string, boolean>();
              movies.forEach((m) => {
                const mk = (m.key || "").toLowerCase().trim();
                const available = Array.from(availableBackgroundTitles).some(
                  (t) => t === mk || t.includes(mk) || mk.includes(t),
                );
                availMap.set(m.key, available);
              });
              const enabledSelectable = movies.filter((m) => {
                const enabled =
                  (backgroundSelection && backgroundSelection[m.key]) ?? true;
                const available = availMap.get(m.key) || false;
                return enabled && available;
              });
              // Favorites is always on (locked), so it counts toward
              // "have at least one source" — meaning when favorites
              // exist, deselecting every movie is allowed.
              const hasFavorites = favorites.size > 0;
              const enabledCount =
                enabledSelectable.length + (hasFavorites ? 1 : 0);
              const totalAvailable = movies.filter(
                (m) => availMap.get(m.key) || false,
              ).length;
              const allSelected = enabledSelectable.length === totalAvailable;
              const onlyOneLeft = enabledCount <= 1;
              return (
                <>
                  <Button
                    className="modal-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAll();
                    }}
                    disabled={allSelected}
                    size="small"
                    variant="outline-light"
                  >
                    {t("background.modal.selectAll")}
                  </Button>
                  <Button
                    className="modal-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deselectAll();
                    }}
                    disabled={onlyOneLeft}
                    size="small"
                    variant="outline-light"
                  >
                    {t("background.modal.deselectAll")}
                  </Button>
                  <button
                    className="modal-close"
                    onClick={() => setShowBackgroundSettings(false)}
                    aria-label={t("modal.common.closeAria")}
                  >
                    ×
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        <div className="modal-body">
          <div className="sidebar-section background-settings">
            <div className="background-list">
              {/* Favorites entry — pinned to the top. Selectable like a
                  movie (checkbox enables/disables it in the rotation
                  pool); expanded view shows each favorited image with a
                  per-image unfavorite button. Hidden when no favorites. */}
              {favorites.size > 0 && (
                <details
                  className="background-toggle favorites-entry"
                  style={{ position: "relative" }}
                  open
                >
                  <summary className="background-summary">
                    {/* Always-on: Favorites can't be deselected. The
                        checkbox is shown so it visually matches the
                        movie rows, but locked + always checked. */}
                    <input
                      id="background-favorites-locked"
                      type="checkbox"
                      checked
                      disabled
                      aria-label={t("background.modal.favoritesAlwaysOn")}
                    />
                    <span className="background-title">
                      {t("background.modal.favoritesTitle")}{" "}
                      <span
                        className="favorites-info"
                        data-tooltip={t("background.modal.favoritesAlwaysOn")}
                        aria-label={t("background.modal.favoritesAlwaysOn")}
                        role="img"
                        tabIndex={0}
                        // Don't toggle the <details> open/closed when the
                        // user clicks the info hover target.
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <InfoOutlinedIcon style={{ fontSize: 14 }} />
                      </span>
                      <span className="favorites-count">
                        ({favorites.size})
                      </span>
                    </span>
                  </summary>
                  <div className="summary-images favorites-grid">
                    {Array.from(favorites).map((url) => (
                      <div className="thumb-wrap favorite-thumb-wrap" key={url}>
                        <img
                          src={url}
                          alt=""
                          aria-hidden="true"
                          className="summary-thumb"
                          draggable={false}
                        />
                        <button
                          type="button"
                          className="favorite-thumb-unfav"
                          aria-label={t("background.modal.unfavoriteOneAria")}
                          data-tooltip={t("background.modal.unfavoriteOne")}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(url);
                          }}
                        >
                          <FavoriteIcon fontSize="small" />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {
                // Precompute availability map so we can determine whether
                // the current item is the last selectable (checked + available)
              }
              {(() => {
                const availMap = new Map<string, boolean>();
                movies.forEach((m) => {
                  const mk = (m.key || "").toLowerCase().trim();
                  const available = Array.from(availableBackgroundTitles).some(
                    (t) => t === mk || t.includes(mk) || mk.includes(t),
                  );
                  availMap.set(m.key, available);
                });

                const enabledMovies = movies.reduce((acc, m) => {
                  const enabled =
                    (backgroundSelection && backgroundSelection[m.key]) ?? true;
                  const available = availMap.get(m.key) || false;
                  if (enabled && available) return acc + 1;
                  return acc;
                }, 0);
                // Favorites carries the rotation on its own when
                // populated, so it counts toward the "have at least
                // one source" floor — meaning the user can fully
                // deselect every movie without hitting the disableLast
                // lock.
                const enabledSelectableCount =
                  enabledMovies + (favorites.size > 0 ? 1 : 0);

                let firstEnabledOpened = false;
                return movies.map((m) => {
                  const mk = (m.key || "").toLowerCase().trim();
                  const available = availMap.get(m.key) || false;
                  const enabled =
                    (backgroundSelection && backgroundSelection[m.key]) ?? true;

                  const source =
                    backgroundSources.find((s) => {
                      const st = (s.title || "").toLowerCase().trim();
                      return st === mk || st.includes(mk) || mk.includes(st);
                    }) || null;

                  const links = source?.links || [];
                  const filteredLinks = links.filter((l) => !blacklist.has(l));

                  const disableLast =
                    enabled && available && enabledSelectableCount <= 1;

                  // Open the first enabled+available movie by default so users
                  // see a row of images immediately without having to expand.
                  const isFirstEnabled =
                    enabled &&
                    available &&
                    filteredLinks.length > 0 &&
                    !firstEnabledOpened;
                  if (isFirstEnabled) firstEnabledOpened = true;

                  return (
                    <BackgroundListItem
                      key={m.key}
                      movieKey={m.key}
                      title={m.title}
                      enabled={enabled}
                      available={available}
                      links={filteredLinks}
                      totalLinks={links.length}
                      disableLast={disableLast}
                      defaultOpen={isFirstEnabled}
                      onUpdate={handleUpdateSelection}
                      favoritedSet={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  );
                });
              })()}

              {/* Deleted entry — sits at the bottom of the movie list
                  styled like any other expandable item, but with no
                  enable/disable checkbox. Expanding shows the deleted
                  thumbnails with per-image restore buttons. Hidden
                  when nothing has been deleted. */}
              {blacklist.size > 0 && (
                <details
                  className="background-toggle deleted-entry"
                  style={{ position: "relative" }}
                >
                  <summary className="background-summary">
                    <span className="background-title">
                      {t("background.modal.deletedTitle")}{" "}
                      <span className="deleted-count">({blacklist.size})</span>
                    </span>
                    <Button
                      className="deleted-restore-all"
                      size="small"
                      variant="dark"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        clearBlacklist();
                      }}
                    >
                      <RestoreIcon style={{ fontSize: 14 }} />
                      {t("background.modal.restoreDeleted")}
                    </Button>
                  </summary>
                  <div className="summary-images deleted-grid">
                    {Array.from(blacklist).map((url) => (
                      <div className="thumb-wrap deleted-thumb-wrap" key={url}>
                        <img
                          src={url}
                          alt=""
                          aria-hidden="true"
                          className="summary-thumb deleted-thumb"
                          draggable={false}
                        />
                        <button
                          type="button"
                          className="deleted-thumb-restore"
                          aria-label={t("background.modal.restoreOneAria")}
                          data-tooltip={t("background.modal.restoreOne")}
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreOne(url);
                          }}
                        >
                          <RestoreIcon fontSize="small" />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
};
