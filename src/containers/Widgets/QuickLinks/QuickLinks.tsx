import AddCircleIcon from "@mui/icons-material/AddCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckIcon from "@mui/icons-material/Check";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button/Button";
import InlinePopover from "../../../components/InlinePopover/InlinePopover";
import TextInput from "../../../components/TextInput/TextInput";
import { useAppContext } from "../../../contexts/AppContext";
import "./QuickLinks.css";

export const QuickLinks: React.FC = () => {
  const { quicklinksSettings, updateQuicklinksSettings, showWidgetEdits } =
    useAppContext();
  const darkMode = !!quicklinksSettings.darkMode;
  // Toggle grid/list mode and persist
  const handleToggleGridMode = () => {
    updateQuicklinksSettings({ gridMode: !quicklinksSettings.gridMode });
  };
  // Toggle dark mode and persist
  const handleToggleDarkMode = () => {
    updateQuicklinksSettings({ darkMode: !quicklinksSettings.darkMode });
  };
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
  const showGrid = !!quicklinksSettings.gridMode;

  const width = quicklinksSettings.width;
  const height = quicklinksSettings.height;

  // Exit delete mode when clicking outside grid or pressing Enter
  useEffect(() => {
    if (!deleteGridLink) return;
    function handleClick(e: MouseEvent) {
      const grid = document.querySelector(".quicklinksSettings-grid-list");
      if (grid && !grid.contains(e.target as Node)) {
        setDeleteGridLink(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        setDeleteGridLink(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [deleteGridLink]);

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
      <div
        className={`quicklinksSettings-grid-wrapper widget-header always-show quicklinks-widget-mode-${
          darkMode ? "dark" : "light"
        }`}
      >
        <div className="quicklinksSettings-grid-list">
          <div
            className="quicklinksSettings-grid-scroll"
            style={{ width, height }}
          >
            {quicklinksSettings.links.map((l, index) => {
              const favicon = getFavicon(l.url);
              const isDragOver =
                draggedIndex !== null && dragOverIndex === index;
              const modeClass = darkMode
                ? "quicklinksSettings-grid-item-dark"
                : "quicklinksSettings-grid-item-light";
              return (
                <div
                  key={l.id}
                  className={`quicklinksSettings-grid-item ${modeClass}${
                    draggedIndex === index ? " dragging" : ""
                  }${isDragOver ? " drag-over" : ""}`}
                  draggable={!showWidgetEdits}
                  onDragStart={
                    !showWidgetEdits ? () => setDraggedIndex(index) : undefined
                  }
                  onDragOver={
                    !showWidgetEdits
                      ? (e) => {
                          e.preventDefault();
                          setDragOverIndex(index);
                        }
                      : undefined
                  }
                  onDrop={
                    !showWidgetEdits
                      ? () => {
                          if (draggedIndex === null) return;
                          handleDragDrop(draggedIndex, index);
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }
                      : undefined
                  }
                  onDragEnd={
                    !showWidgetEdits
                      ? () => {
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }
                      : undefined
                  }
                  style={
                    isDragOver
                      ? { borderTop: "3px solid #1976d2", cursor: "pointer" }
                      : { cursor: "pointer" }
                  }
                  onClick={(e) => {
                    // Prevent delete button from triggering navigation
                    if (
                      (e.target as HTMLElement).classList.contains(
                        "quicklinksSettings-delete"
                      )
                    )
                      return;
                    goTo(l);
                  }}
                  title={l.url}
                >
                  {deleteGridLink && (
                    <button
                      className="quicklinksSettings-delete grid"
                      aria-label={`Delete ${l.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLink(l.id);
                      }}
                    >
                      <CancelIcon fontSize="small" style={{ color: "red" }} />
                    </button>
                  )}
                  {favicon ? (
                    <div
                      className="ql-grid-favicon"
                      style={{ backgroundImage: `url(${favicon})` }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="ql-grid-title">{l.title}</span>
                </div>
              );
            })}
            <div
              className={`quicklinksSettings-grid-item control-button ${
                darkMode ? "control-dark" : "control-light"
              }`}
              onClick={(e) => {
                e.stopPropagation(); // Prevent event propagation issues
                setAnchorEl(titleRef.current || headerRef.current);
              }}
            >
              <Button
                variant={darkMode ? "dark" : "light"}
                icon={
                  <AddCircleIcon fontSize="small" style={{ color: "green" }} />
                }
                onClick={() => setAddGridLink(true)}
              ></Button>
              {deleteGridLink ? (
                <Button
                  variant={darkMode ? "dark" : "light"}
                  icon={
                    <CheckIcon fontSize="small" style={{ color: "green" }} />
                  }
                  onClick={() => setDeleteGridLink(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setDeleteGridLink(false);
                  }}
                  tabIndex={0}
                  aria-label="Done deleting links"
                ></Button>
              ) : (
                <>
                  {quicklinksSettings.links.length > 0 && (
                    <Button
                      variant={darkMode ? "dark" : "light"}
                      icon={
                        <CancelIcon fontSize="small" style={{ color: "red" }} />
                      }
                      onClick={() => setDeleteGridLink(true)}
                      aria-label="Show delete buttons"
                    ></Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {addGridLink && (
          <div className="quicklinksSettings-add">
            <TextInput
              placeholder="label (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              mode={darkMode ? "dark" : "light"}
              key={`grid-title-${darkMode}-${addGridLink}`}
            />
            <TextInput
              ref={urlInputRef}
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addLink();
                  setAddGridLink(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              mode={darkMode ? "dark" : "light"}
              key={`grid-url-${darkMode}-${addGridLink}`}
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

  // Otherwise, show list mode
  return (
    <div
      className={`quicklinksSettings-container
      }`}
      ref={containerRef}
    >
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
                // if (isDragging) return;
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
            // isDragging ||
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
              <TextInput
                placeholder="label (optional)"
                inputSize="small"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                mode={darkMode ? "dark" : "light"}
                key={`popover-title-${darkMode}-${
                  anchorEl ? "open" : "closed"
                }`}
              />
              <TextInput
                ref={urlInputRef}
                inputSize="small"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLink();
                }}
                onClick={(e) => e.stopPropagation()}
                mode={darkMode ? "dark" : "light"}
                key={`popover-url-${darkMode}-${anchorEl ? "open" : "closed"}`}
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
                      className={`quicklinksSettings-item${
                        draggedIndex === index ? " dragging" : ""
                      }${dragOverIndex === index ? " drag-over" : ""}`}
                      draggable={!showWidgetEdits}
                      onDragStart={
                        !showWidgetEdits
                          ? () => setDraggedIndex(index)
                          : undefined
                      }
                      onDragOver={
                        !showWidgetEdits
                          ? (e) => {
                              e.preventDefault();
                              setDragOverIndex(index);
                            }
                          : undefined
                      }
                      onDrop={
                        !showWidgetEdits
                          ? () => {
                              if (draggedIndex === null) return;
                              handleDragDrop(draggedIndex, index);
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }
                          : undefined
                      }
                      onDragEnd={
                        !showWidgetEdits
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
