import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreIcon from "@mui/icons-material/Restore";
import React, { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import {
  GITHUB_REPO_URL,
  SIDEBAR_EDGE_TRIGGER,
  SIDEBAR_WIDTH,
} from "../../config/appConfig";
import { BackgroundFilters, useAppContext } from "../../contexts/AppContext";
import "./LeftSidebar.css";

export const LeftSidebar: React.FC = () => {
  const {
    backgroundFilters,
    updateBackgroundFilters,
    backgroundSelection,
    updateBackgroundSelection,
  } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<BackgroundFilters>(backgroundFilters);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [movies, setMovies] = useState<Array<{ key: string; title: string }>>(
    []
  );
  const [availableBackgroundTitles, setAvailableBackgroundTitles] = useState<
    Set<string>
  >(new Set());
  const [backgroundSources, setBackgroundSources] = useState<
    Array<{ title: string; links?: string[] }>
  >([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const sidebarWidth = Math.min(SIDEBAR_WIDTH, window.innerWidth);

      if (e.clientX < SIDEBAR_EDGE_TRIGGER) {
        setIsOpen(true);
      } else if (isOpen && e.clientX > sidebarWidth) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isOpen]);

  useEffect(() => {
    // Fetch movie metadata and background sources so we can mark which movies
    // actually have backgrounds available.
    let mounted = true;
    Promise.all([fetch("/movie_metadata.json"), fetch("/background_en.json")])
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
          titles.add((s.title || "").toLowerCase().trim())
        );
        setAvailableBackgroundTitles(titles);
        setBackgroundSources(bgData.sources || []);
      })
      .catch((err) =>
        console.log(
          "LeftSidebar: failed to load movie metadata or backgrounds",
          err
        )
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

  const handleGithubClick = () => {
    window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer");
  };

  const handleFilterChange = (
    filterType: keyof BackgroundFilters,
    value: number
  ) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    updateBackgroundFilters({ [filterType]: value });
  };

  const resetFilters = () => {
    const defaultFilters = { blur: 0, brightness: 100, saturation: 100 };
    setFilters(defaultFilters);
    updateBackgroundFilters(defaultFilters);
  };

  const selectAll = () => {
    movies.forEach((m) => updateBackgroundSelection(m.key, true));
  };

  const deselectAll = () => {
    // Always keep the very first movie selected (if it exists).
    const keepKey = movies[0]?.key;
    if (!keepKey) return;
    movies.forEach((m) => updateBackgroundSelection(m.key, m.key === keepKey));
  };

  // stable wrapper to avoid creating a new function per render
  const handleUpdateSelection = React.useCallback(
    (key: string, checked: boolean) => updateBackgroundSelection(key, checked),
    [updateBackgroundSelection]
  );

  type ItemProps = {
    movieKey: string;
    title: string;
    enabled: boolean;
    available: boolean;
    links: string[];
    disableLast?: boolean;
    onUpdate: (k: string, v: boolean) => void;
  };

  const BackgroundListItem: React.FC<ItemProps> = React.memo(
    ({ movieKey, title, enabled, available, links, disableLast, onUpdate }) => {
      const [open, setOpen] = React.useState(false);
      // log once per item if missing available backgrounds to help debugging
      React.useEffect(() => {
        if (!available) {
          // debug only — should be visible in dev console
          // eslint-disable-next-line no-console
          console.debug(
            `BackgroundListItem: ${movieKey} (${title}) has no backgrounds. links=${links.length}`
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
              type="checkbox"
              checked={enabled}
              disabled={!available || !!disableLast}
              onChange={(e) => onUpdate(movieKey, e.target.checked)}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <span className="background-title">{title}</span>
            {!available && (
              <span className="background-unavailable"> (no backgrounds)</span>
            )}
          </summary>
          {available && links.length > 0 && (
            <div
              className="summary-images"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {links.map((lnk, idx) => (
                <div
                  key={idx}
                  className="thumb-wrap"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <img
                    src={lnk}
                    alt={`${title} ${idx}`}
                    className="summary-thumb"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="thumb-delete"
                    title="Remove image"
                    onClick={(e) => {
                      e.stopPropagation();
                      // call parent handler via custom event on window — parent will provide
                      const ev = new CustomEvent("ghiblify:blacklist:add", {
                        detail: lnk,
                      });
                      window.dispatchEvent(ev);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </details>
      );
    },
    (prev, next) =>
      prev.enabled === next.enabled &&
      prev.available === next.available &&
      prev.disableLast === next.disableLast &&
      prev.links.join("|") === next.links.join("|")
  );

  // blacklist state persisted in localStorage — use a Set for O(1) lookups
  const [blacklist, setBlacklist] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("ghiblify_blacklist");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setBlacklist(new Set(arr));
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // handler to add url to blacklist and persist
  const addToBlacklist = React.useCallback((url: string) => {
    setBlacklist((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      try {
        localStorage.setItem(
          "ghiblify_blacklist",
          JSON.stringify(Array.from(next))
        );
      } catch (err) {
        // ignore
      }
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
        onAdd as EventListener
      );
  }, [addToBlacklist]);

  // clear the blacklist (persisted) and notify listeners
  const clearBlacklist = React.useCallback(() => {
    // guard to avoid accidental clears
    // eslint-disable-next-line no-restricted-globals
    if (!confirm("Clear deleted and restore all images?")) return;
    setBlacklist(new Set());
    try {
      localStorage.removeItem("ghiblify_blacklist");
    } catch (err) {
      // ignore
    }
    // notify other parts of app to re-evaluate backgrounds
    const ev = new CustomEvent("ghiblify:blacklist:cleared");
    window.dispatchEvent(ev);
  }, []);

  return (
    <>
      <div className={`left-sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-content">
          <h3>Settings</h3>
          <div className="sidebar-section">
            <Button
              variant="outline-light"
              size="small"
              onClick={handleGithubClick}
            >
              Github Repo
            </Button>
          </div>
          {/* background settings modal is rendered below as a sibling so it isn't
            constrained by the sidebar's transform (allows centering) */}
          <div className="sidebar-section">
            <h4>Background</h4>
            <div className="filter-control">
              <label>
                <span>Blur</span>
                <span className="filter-value">{filters.blur}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={filters.blur}
                onChange={(e) =>
                  handleFilterChange("blur", parseInt(e.target.value))
                }
                className="filter-slider"
              />
            </div>

            <div className="filter-control">
              <label>
                <span>Brightness</span>
                <span className="filter-value">{filters.brightness}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.brightness}
                onChange={(e) =>
                  handleFilterChange("brightness", parseInt(e.target.value))
                }
                className="filter-slider"
              />
            </div>

            <div className="filter-control">
              <label>
                <span>Saturation</span>
                <span className="filter-value">{filters.saturation}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.saturation}
                onChange={(e) =>
                  handleFilterChange("saturation", parseInt(e.target.value))
                }
                className="filter-slider"
              />
            </div>

            <div className="filter-actions">
              <Button
                variant="outline-light"
                size="small"
                onClick={resetFilters}
              >
                <RestoreIcon style={{ fontSize: 16, marginRight: 8 }} />
                Reset Filters
              </Button>
            </div>
          </div>
          <div className="sidebar-section">
            <Button
              variant={showBackgroundSettings ? "dark" : "outline-light"}
              fullWidth={true}
              onClick={() => setShowBackgroundSettings((s) => !s)}
            >
              Background Settings
            </Button>
          </div>
        </div>
      </div>
      {showBackgroundSettings && (
        <div
          className="background-modal-overlay"
          onMouseDown={() => setShowBackgroundSettings(false)}
        >
          <dialog
            className="background-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h4>Background Settings</h4>
              <div>{movies.length} movies</div>
              <div className="modal-actions">
                <button
                  className="modal-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAll();
                  }}
                >
                  Select All
                </button>
                <button
                  className="modal-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deselectAll();
                  }}
                >
                  Deselect All (except 1)
                </button>
                <button
                  className="modal-close"
                  onClick={() => setShowBackgroundSettings(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="sidebar-section background-settings">
                <div className="background-list">
                  {
                    // Precompute availability map so we can determine whether
                    // the current item is the last selectable (checked + available)
                  }
                  {(() => {
                    const availMap = new Map<string, boolean>();
                    movies.forEach((m) => {
                      const mk = (m.key || "").toLowerCase().trim();
                      const available = Array.from(
                        availableBackgroundTitles
                      ).some(
                        (t) => t === mk || t.includes(mk) || mk.includes(t)
                      );
                      availMap.set(m.key, available);
                    });

                    const enabledSelectableCount = movies.reduce((acc, m) => {
                      const enabled =
                        (backgroundSelection && backgroundSelection[m.key]) ??
                        true;
                      const available = availMap.get(m.key) || false;
                      if (enabled && available) return acc + 1;
                      return acc;
                    }, 0);

                    return movies.map((m) => {
                      const mk = (m.key || "").toLowerCase().trim();
                      const available = availMap.get(m.key) || false;
                      const enabled =
                        (backgroundSelection && backgroundSelection[m.key]) ??
                        true;

                      const source =
                        backgroundSources.find((s) => {
                          const st = (s.title || "").toLowerCase().trim();
                          return (
                            st === mk || st.includes(mk) || mk.includes(st)
                          );
                        }) || null;

                      const links = source?.links || [];
                      const filteredLinks = links.filter(
                        (l) => !blacklist.has(l)
                      );

                      const disableLast =
                        enabled && available && enabledSelectableCount <= 1;

                      return (
                        <BackgroundListItem
                          key={m.key}
                          movieKey={m.key}
                          title={m.title}
                          enabled={enabled}
                          available={available}
                          links={filteredLinks}
                          disableLast={disableLast}
                          onUpdate={handleUpdateSelection}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: "8px 16px" }}>
              <button
                className="modal-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  clearBlacklist();
                }}
              >
                Restore Deleted
              </button>
            </div>
          </dialog>
        </div>
      )}
    </>
  );
};
