import React, { useEffect, useRef, useState } from "react";
import InlinePopover from "../../../components/InlinePopover/InlinePopover";
import { useAppContext } from "../../../contexts/AppContext";
import "./QuickLinks.css";

export const QuickLinks: React.FC = () => {
  const {
    quicklinksSettings,
    updateQuicklinksSettings,
    isDragging,
    showWidgetEdits,
  } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const popperRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addGridLink, setAddGridLink] = useState(false);
  const [deleteGridLink, setDeleteGridLink] = useState(false);
  const [showGrid, setShowGrid] = useState(() => {
    const stored = localStorage.getItem("quicklinks_grid");
    return stored === null ? true : stored === "true";
  });

  const width = quicklinksSettings.width;
  const height = quicklinksSettings.height;

  useEffect(() => {
    localStorage.setItem("quicklinks_grid", showGrid ? "true" : "false");
  }, [showGrid]);

  // Listen for changes made from EditWidget so multiple components stay in sync
  useEffect(() => {
    const handler = (e: Event) => {
      // event detail contains { value: boolean }
      const detail: any = (e as CustomEvent).detail;
      if (detail && typeof detail.value === "boolean") {
        setShowGrid(detail.value);
      }
    };
    window.addEventListener("quicklinksGridChange", handler as EventListener);
    return () =>
      window.removeEventListener(
        "quicklinksGridChange",
        handler as EventListener
      );
  }, []);

  useEffect(() => {
    if (anchorEl) {
      setTimeout(() => urlInputRef.current?.focus(), 0);
    }
  }, [anchorEl]);

  const addLink = () => {
    if (!url.trim()) return;
    const normalizeUrl = (raw: string) => {
      const t = raw.trim();
      if (!t) return t;
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(t)) return t;
      return `https://${t}`;
    };

    const newLink = {
      id: Date.now().toString(),
      title: title.trim() || url.trim(),
      url: normalizeUrl(url),
    };
    updateQuicklinksSettings({ links: [...quicklinksSettings.links, newLink] });
    setTitle("");
    setUrl("");
    if (headerRef.current) setAnchorEl(titleRef.current || headerRef.current);
  };

  const removeLink = (id: string) => {
    const updatedLinks = quicklinksSettings.links.filter((l) => l.id !== id);
    updateQuicklinksSettings({ links: updatedLinks });
  };

  const handleDragDrop = (draggedIndex: number, dropIndex: number) => {
    const updated = [...quicklinksSettings.links];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, removed);
    updateQuicklinksSettings({ links: updated });
  };

  const goTo = (link: { id: string; title: string; url: string }) => {
    const normalizeUrl = (raw: string) => {
      const t = raw.trim();
      if (!t) return t;
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(t)) return t;
      return `https://${t}`;
    };
    const href = normalizeUrl(link.url);
    if (!href) return;
    // Navigate in the same tab
    window.location.href = href;
    setAnchorEl(null);
  };

  const getFavicon = (rawUrl: string) => {
    if (!rawUrl) return "";
    try {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch (err) {
        url = new URL(`https://${rawUrl}`);
      }
      const domain = url.hostname;
      return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(
        domain
      )}`;
    } catch (err) {
      return "";
    }
  };

  if (showGrid) {
    return (
      <div className="quicklinksSettings-grid-wrapper always-show">
        <div className="quicklinksSettings-grid-list">
          {quicklinksSettings.links.length === 0 ? (
            <div className="quicklinksSettings-empty">No quick links saved</div>
          ) : (
            <div
              className="quicklinksSettings-grid-scroll"
              style={{ width, height }}
            >
              {quicklinksSettings.links.map((l, index) => {
                const favicon = getFavicon(l.url);
                return (
                  <div
                    key={l.id}
                    className="quicklinksSettings-grid-item"
                    draggable={showWidgetEdits}
                    onDragStart={
                      showWidgetEdits ? () => setDraggedIndex(index) : undefined
                    }
                    onDragOver={
                      showWidgetEdits
                        ? (e) => {
                            e.preventDefault();
                            setDragOverIndex(index);
                          }
                        : undefined
                    }
                    onDrop={
                      showWidgetEdits
                        ? () => {
                            if (draggedIndex === null) return;
                            handleDragDrop(draggedIndex, index);
                            setDraggedIndex(null);
                            setDragOverIndex(null);
                          }
                        : undefined
                    }
                    onDragEnd={
                      showWidgetEdits
                        ? () => {
                            setDraggedIndex(null);
                            setDragOverIndex(null);
                          }
                        : undefined
                    }
                    // style={{ position: "relative" }} // Ensure relative positioning for hover effect
                    // onMouseEnter={(e) => {
                    //   const deleteButton =
                    //     e.currentTarget.querySelector(".quicklinksSettings-delete");
                    //   if (deleteButton) deleteButton.style.display = "block";
                    // }}
                    // onMouseLeave={(e) => {
                    //   const deleteButton =
                    //     e.currentTarget.querySelector(".quicklinksSettings-delete");
                    //   if (deleteButton) deleteButton.style.display = "none";
                    // }}
                  >
                    {deleteGridLink && (
                      <button
                        className="quicklinksSettings-delete grid"
                        aria-label={`Delete ${l.title}`}
                        onClick={() => removeLink(l.id)}
                      >
                        x
                      </button>
                    )}
                    <button
                      className="quicklinksSettings-grid-link"
                      onClick={() => goTo(l)}
                      title={l.url}
                    >
                      {favicon ? (
                        <div
                          className="ql-grid-favicon"
                          style={{ backgroundImage: `url(${favicon})` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="ql-grid-title">{l.title}</span>
                    </button>
                  </div>
                );
              })}
              <div
                className="quicklinksSettings-grid-item control-button"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent event propagation issues
                  setAnchorEl(titleRef.current || headerRef.current);
                }}
              >
                <button
                  className="quicklinksSettings-add-btn grid"
                  onClick={() => setAddGridLink(true)}
                >
                  +
                </button>
                <button
                  className="quicklinksSettings-delete-btn grid"
                  onClick={() => setDeleteGridLink(true)}
                >
                  x
                </button>
              </div>
            </div>
          )}
        </div>
        {addGridLink && (
          <div className="quicklinksSettings-add">
            <input
              className="quicklinksSettings-input quicklinksSettings-input-title"
              placeholder="label (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()} // Prevent propagation issues
            />
            <input
              ref={urlInputRef}
              className="quicklinksSettings-input quicklinksSettings-input-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addLink();
                  setAddGridLink(false);
                }
              }}
              onClick={(e) => e.stopPropagation()} // Prevent propagation issues
            />
            <button
              className="quicklinksSettings-add-btn"
              onClick={(e) => {
                e.stopPropagation(); // Prevent propagation issues
                addLink();
                setAddGridLink(false);
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
    );
  }

  // Otherwise, show icon only, and allow toggle in edit mode
  return (
    <div className="quicklinksSettings-container" ref={containerRef}>
      <div
        className="quicklinksSettings-header"
        role="button"
        tabIndex={0}
        aria-expanded={Boolean(anchorEl)}
        ref={headerRef}
      >
        <InlinePopover
          trigger={
            <span
              className="quicklinksSettings-title"
              ref={titleRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const widgetEl = headerRef.current?.closest?.(
                    ".widget"
                  ) as HTMLElement | null;
                  if (widgetEl && widgetEl.dataset.justDragged === "true")
                    return;
                  if (anchorEl) setAnchorEl(null);
                  else if (headerRef.current)
                    setAnchorEl(titleRef.current || headerRef.current);
                }
              }}
              onClick={() => {
                const widgetEl = headerRef.current?.closest?.(
                  ".widget"
                ) as HTMLElement | null;
                if (widgetEl && widgetEl.dataset.justDragged === "true") return;
                if (isDragging) return;
                if (anchorEl) setAnchorEl(null);
                else if (headerRef.current)
                  setAnchorEl(titleRef.current || headerRef.current);
              }}
            >
              Links
            </span>
          }
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          inline={true}
          disabled={
            isDragging ||
            (headerRef.current?.closest(".widget") as HTMLElement | null)
              ?.dataset.justDragged === "true"
          }
        >
          <div
            className={`quicklinksSettings-dropdown`}
            role="dialog"
            aria-modal={false}
            ref={popperRef}
          >
            <div className="quicklinksSettings-add">
              <input
                className="quicklinksSettings-input quicklinksSettings-input-title"
                placeholder="label (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()} // Prevent propagation issues
              />
              <input
                ref={urlInputRef}
                className="quicklinksSettings-input quicklinksSettings-input-url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLink();
                }}
                onClick={(e) => e.stopPropagation()} // Prevent propagation issues
              />
              <button
                className="quicklinksSettings-add-btn"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent propagation issues
                  addLink();
                }}
              >
                Add
              </button>
            </div>
            <ul className="quicklinksSettings-list">
              {quicklinksSettings.links.length === 0 ? (
                <li className="quicklinksSettings-empty">
                  No quick links saved
                </li>
              ) : (
                quicklinksSettings.links.map((l, index) => {
                  const favicon = getFavicon(l.url);
                  return (
                    <li
                      key={l.id}
                      className={`quicklinksSettings-item ${
                        draggedIndex === index ? "dragging" : ""
                      } ${dragOverIndex === index ? "drag-over" : ""}`}
                      draggable={showWidgetEdits}
                      onDragStart={
                        showWidgetEdits
                          ? () => setDraggedIndex(index)
                          : undefined
                      }
                      onDragOver={
                        showWidgetEdits
                          ? (e) => {
                              e.preventDefault();
                              setDragOverIndex(index);
                            }
                          : undefined
                      }
                      onDrop={
                        showWidgetEdits
                          ? () => {
                              if (draggedIndex === null) return;
                              handleDragDrop(draggedIndex, index);
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }
                          : undefined
                      }
                      onDragEnd={
                        showWidgetEdits
                          ? () => {
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }
                          : undefined
                      }
                    >
                      {favicon ? (
                        <div
                          className="ql-favicon"
                          style={{ backgroundImage: `url(${favicon})` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <button
                        className="quicklinksSettings-link"
                        onClick={() => goTo(l)}
                        title={l.url}
                      >
                        <span className="ql-title">{l.title}</span>
                        <span className="ql-url">{l.url}</span>
                      </button>
                      <button
                        className="quicklinksSettings-delete"
                        aria-label={`Delete ${l.title}`}
                        onClick={() => removeLink(l.id)}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </InlinePopover>
      </div>
    </div>
  );
};

export default QuickLinks;
