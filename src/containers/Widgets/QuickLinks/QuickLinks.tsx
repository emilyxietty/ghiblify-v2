import AddCircleIcon from "@mui/icons-material/AddCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckIcon from "@mui/icons-material/Check";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button/Button";
import InlinePopover from "../../../components/InlinePopover/InlinePopover";
import TextInput from "../../../components/TextInput/TextInput";
import { useAppContext } from "../../../contexts/AppContext";
import "./QuickLinks.css";

const normalizeUrl = (raw: string) => {
  const t = raw.trim();
  if (!t) return t;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(t)) return t;
  return `https://${t}`;
};

const getFavicon = (rawUrl: string) => {
  if (!rawUrl) return "";
  try {
    const url = new URL(normalizeUrl(rawUrl));
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      url.hostname
    )}`;
  } catch {
    return "";
  }
};

export const QuickLinks: React.FC = () => {
  const { widgets, updateWidgetSettings, showWidgetEdits } = useAppContext();
  const quicklinksSettings = widgets.quicklinks.settings;
  const darkMode = !!quicklinksSettings.darkMode;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popperRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addGridLink, setAddGridLink] = useState(false);
  const [deleteGridLink, setDeleteGridLink] = useState(false);
  const showGrid = !!quicklinksSettings.gridMode;

  const width = quicklinksSettings.width;
  const height = quicklinksSettings.height;
  const themeClass = darkMode ? "ql-dark" : "ql-light";

  // Exit delete mode when clicking outside grid or pressing Enter/Escape
  useEffect(() => {
    if (!deleteGridLink) return;
    function handleClick(e: MouseEvent) {
      const grid = document.querySelector(".quicklinksSettings-grid-list");
      if (grid && !grid.contains(e.target as Node)) {
        setDeleteGridLink(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "Escape") setDeleteGridLink(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [deleteGridLink]);

  useEffect(() => {
    if (anchorEl) setTimeout(() => urlInputRef.current?.focus(), 0);
  }, [anchorEl]);

  // Dismiss the grid-mode add form on outside click or Escape.
  useEffect(() => {
    if (!addGridLink) return;
    const dismiss = () => {
      setAddGridLink(false);
      setTitle("");
      setUrl("");
    };
    function handleClick(e: MouseEvent) {
      const form = document.querySelector(".quicklinksSettings-add");
      if (form && !form.contains(e.target as Node)) dismiss();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    setTimeout(() => urlInputRef.current?.focus(), 0);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [addGridLink]);

  const addLink = () => {
    if (!url.trim()) return;
    const newLink = {
      id: Date.now().toString(),
      title: title.trim() || url.trim(),
      url: normalizeUrl(url),
    };
    updateWidgetSettings("quicklinks", {
      links: [...quicklinksSettings.links, newLink],
    });
    setTitle("");
    setUrl("");
  };

  const removeLink = (id: string) => {
    updateWidgetSettings("quicklinks", {
      links: quicklinksSettings.links.filter((l) => l.id !== id),
    });
  };

  const handleDragDrop = (from: number, to: number) => {
    const updated = [...quicklinksSettings.links];
    const [removed] = updated.splice(from, 1);
    updated.splice(to, 0, removed);
    updateWidgetSettings("quicklinks", { links: updated });
  };

  const dndProps = (index: number) =>
    showWidgetEdits
      ? {}
      : {
          draggable: true,
          onDragStart: () => setDraggedIndex(index),
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            setDragOverIndex(index);
          },
          onDrop: () => {
            if (draggedIndex === null) return;
            handleDragDrop(draggedIndex, index);
            setDraggedIndex(null);
            setDragOverIndex(null);
          },
          onDragEnd: () => {
            setDraggedIndex(null);
            setDragOverIndex(null);
          },
        };

  if (showGrid) {
    return (
      <div
        className={`quicklinksSettings-grid-wrapper widget-header quicklinks-widget-mode-${
          darkMode ? "dark" : "light"
        } ${themeClass}`}
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
              return (
                <div
                  key={l.id}
                  className={`ql-grid-cell${
                    draggedIndex === index ? " dragging" : ""
                  }${isDragOver ? " drag-over" : ""}${
                    showWidgetEdits ? "" : " draggable"
                  }`}
                  {...dndProps(index)}
                >
                  <a
                    href={normalizeUrl(l.url)}
                    className="ql-grid-link"
                    title={l.url}
                  >
                    {favicon ? (
                      <img
                        src={favicon}
                        alt=""
                        className="ql-grid-favicon"
                        aria-hidden="true"
                        draggable={false}
                      />
                    ) : (
                      <div className="ql-grid-favicon ql-favicon-fallback" aria-hidden="true">
                        {l.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="ql-grid-title">{l.title}</span>
                  </a>
                  {deleteGridLink && (
                    <button
                      type="button"
                      className="ql-delete-overlay"
                      aria-label={`Delete ${l.title}`}
                      data-tooltip={`Delete ${l.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeLink(l.id);
                      }}
                    >
                      <CancelIcon fontSize="small" />
                    </button>
                  )}
                </div>
              );
            })}
            <div className={`ql-grid-cell ql-control-cell ${darkMode ? "control-dark" : "control-light"}`}>
              <Button
                variant={darkMode ? "dark" : "light"}
                icon={<AddCircleIcon fontSize="small" />}
                onClick={() => setAddGridLink(true)}
                aria-label="Add a new quick link"
                data-tooltip="Add link"
              />
              {deleteGridLink ? (
                <Button
                  variant={darkMode ? "dark" : "light"}
                  icon={<CheckIcon fontSize="small" />}
                  onClick={() => setDeleteGridLink(false)}
                  aria-label="Done deleting links"
                  aria-pressed={true}
                  data-tooltip="Done deleting"
                />
              ) : (
                quicklinksSettings.links.length > 0 && (
                  <Button
                    variant={darkMode ? "dark" : "light"}
                    icon={<CancelIcon fontSize="small" />}
                    onClick={() => setDeleteGridLink(true)}
                    aria-label="Show delete buttons"
                    aria-pressed={false}
                    data-tooltip="Remove links"
                  />
                )
              )}
            </div>
          </div>
        </div>
        {addGridLink && (
          <form
            className="quicklinksSettings-add"
            onSubmit={(e) => {
              e.preventDefault();
              addLink();
              setAddGridLink(false);
            }}
          >
            <label className="ql-sr-only" htmlFor="ql-grid-title-input">
              Label (optional)
            </label>
            <TextInput
              id="ql-grid-title-input"
              placeholder="Label (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              mode={darkMode ? "dark" : "light"}
              key={`grid-title-${darkMode}-${addGridLink}`}
            />
            <label className="ql-sr-only" htmlFor="ql-grid-url-input">
              URL
            </label>
            <TextInput
              id="ql-grid-url-input"
              ref={urlInputRef}
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              mode={darkMode ? "dark" : "light"}
              key={`grid-url-${darkMode}-${addGridLink}`}
            />
            <button
              type="submit"
              className="quicklinksSettings-add-btn"
              disabled={!url.trim()}
              data-tooltip="Save link"
            >
              Add
            </button>
          </form>
        )}
      </div>
    );
  }

  // List mode
  return (
    <div className={`quicklinksSettings-container ${themeClass}`} ref={containerRef}>
      <div className="quicklinksSettings-header" ref={headerRef}>
        <InlinePopover
          trigger={
            <button
              ref={triggerRef}
              type="button"
              className="quicklinksSettings-title"
              aria-haspopup="dialog"
              aria-expanded={Boolean(anchorEl)}
              onClick={() => {
                const widgetEl = headerRef.current?.closest?.(".widget") as HTMLElement | null;
                if (widgetEl?.dataset.justDragged === "true") return;
                if (anchorEl) setAnchorEl(null);
                else setAnchorEl(triggerRef.current);
              }}
            >
              Links
            </button>
          }
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          inline={true}
          disabled={
            (headerRef.current?.closest(".widget") as HTMLElement | null)?.dataset
              .justDragged === "true"
          }
        >
          <div
            className="quicklinksSettings-dropdown"
            role="dialog"
            aria-modal={false}
            aria-label="Quick links"
            ref={popperRef}
          >
            <form
              className="quicklinksSettings-add"
              onSubmit={(e) => {
                e.preventDefault();
                addLink();
              }}
            >
              <label className="ql-sr-only" htmlFor="ql-list-title-input">
                Label (optional)
              </label>
              <TextInput
                id="ql-list-title-input"
                placeholder="Label (optional)"
                inputSize="small"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                mode={darkMode ? "dark" : "light"}
                key={`popover-title-${darkMode}-${anchorEl ? "open" : "closed"}`}
              />
              <label className="ql-sr-only" htmlFor="ql-list-url-input">
                URL
              </label>
              <TextInput
                id="ql-list-url-input"
                ref={urlInputRef}
                inputSize="small"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                mode={darkMode ? "dark" : "light"}
                key={`popover-url-${darkMode}-${anchorEl ? "open" : "closed"}`}
              />
              <button
                type="submit"
                className="quicklinksSettings-add-btn"
                disabled={!url.trim()}
                data-tooltip="Save link"
              >
                Add
              </button>
            </form>
            <ul className="quicklinksSettings-list">
              {quicklinksSettings.links.length === 0 ? (
                <li className="quicklinksSettings-empty">
                  No quick links yet. Add one above to get started.
                </li>
              ) : (
                quicklinksSettings.links.map((l, index) => {
                  const favicon = getFavicon(l.url);
                  return (
                    <li
                      key={l.id}
                      className={`quicklinksSettings-item${
                        draggedIndex === index ? " dragging" : ""
                      }${dragOverIndex === index ? " drag-over" : ""}${
                        showWidgetEdits ? "" : " draggable"
                      }`}
                      {...dndProps(index)}
                    >
                      {favicon ? (
                        <img
                          src={favicon}
                          alt=""
                          className="ql-favicon"
                          aria-hidden="true"
                          draggable={false}
                        />
                      ) : (
                        <div className="ql-favicon ql-favicon-fallback" aria-hidden="true">
                          {l.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <a
                        href={normalizeUrl(l.url)}
                        className="quicklinksSettings-link"
                        title={l.url}
                      >
                        <span className="ql-title">{l.title}</span>
                        <span className="ql-url">{l.url}</span>
                      </a>
                      <button
                        type="button"
                        className="quicklinksSettings-delete"
                        aria-label={`Delete ${l.title}`}
                        data-tooltip="Delete link"
                        onClick={() => removeLink(l.id)}
                      >
                        <CancelIcon fontSize="small" />
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
