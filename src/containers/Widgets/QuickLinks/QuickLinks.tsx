import AddCircleIcon from "@mui/icons-material/AddCircle";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
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

const getFavicon = (rawUrl: string, size = 64) => {
  if (!rawUrl) return "";
  const fullUrl = normalizeUrl(rawUrl);
  // Prefer Chrome's built-in favicon cache (MV3 _favicon API). Requires
  // "favicon" in manifest permissions. Only available inside an extension
  // context (chrome-extension:// pages); falls back to Google's s2 service
  // for dev preview / non-extension contexts.
  const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
  if (chromeNs?.runtime?.getURL) {
    try {
      const faviconUrl = new URL(chromeNs.runtime.getURL("/_favicon/"));
      faviconUrl.searchParams.set("pageUrl", fullUrl);
      faviconUrl.searchParams.set("size", String(size));
      return faviconUrl.toString();
    } catch {
      /* fall through */
    }
  }
  return;
};

export const QuickLinks: React.FC = () => {
  const { widgets, updateWidgetSettings, showWidgetEdits, editingWidgetKey } =
    useAppContext();
  // True when QuickLinks is in any kind of edit mode — global or per-widget.
  const isEditing = showWidgetEdits || editingWidgetKey === "quicklinks";
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
  const showGrid = !!quicklinksSettings.gridMode;

  const width = quicklinksSettings.width;
  const height = quicklinksSettings.height;
  const themeClass = darkMode ? "ql-dark" : "ql-light";

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
        style={{
          ["--ql-opacity" as any]:
            ((quicklinksSettings as any).opacity ?? 50) / 100,
          ["--input-opacity" as any]:
            ((quicklinksSettings as any).opacity ?? 50) / 100,
        }}
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
                      <div
                        className="ql-grid-favicon ql-favicon-fallback"
                        aria-hidden="true"
                      >
                        {l.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="ql-grid-title">{l.title}</span>
                  </a>
                  {/* Always rendered; CSS hides it unless Shift is held
                      (body.show-widget-outline). */}
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
                </div>
              );
            })}
            {/* Add control — only visible while Shift is held (body class
                .show-widget-outline). Delete X overlays on each tile follow
                the same pattern. */}
            <div
              className={`ql-grid-cell ql-control-cell ${
                darkMode ? "control-dark" : "control-light"
              }`}
            >
              <Button
                variant={darkMode ? "dark" : "light"}
                icon={<AddCircleIcon fontSize="small" />}
                onClick={() => setAddGridLink(true)}
                aria-label="Add a new quick link"
                data-tooltip="Add link"
              />
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
              aria-label="Save link"
              data-tooltip="Save link"
            >
              <AddIcon fontSize="small" />
            </button>
          </form>
        )}
      </div>
    );
  }

  // The dropdown contents are reused in two render paths: as InlinePopover
  // children for normal mode, and inline (in flow) when editing so the
  // widget grows and the EditWidget overlay properly covers everything.
  const dropdownContent = (
    <div
      className="quicklinksSettings-dropdown"
      role="dialog"
      aria-modal={false}
      aria-label="Quick links"
      ref={popperRef}
      style={{
        ["--ql-opacity" as any]:
          ((quicklinksSettings as any).opacity ?? 50) / 100,
        ["--input-opacity" as any]:
          ((quicklinksSettings as any).opacity ?? 50) / 100,
      }}
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
                key={`popover-title-${darkMode}-${
                  anchorEl ? "open" : "closed"
                }`}
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
                aria-label="Save link"
                data-tooltip="Save link"
              >
                <AddIcon fontSize="small" />
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
                        <div
                          className="ql-favicon ql-favicon-fallback"
                          aria-hidden="true"
                        >
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
  );

  // List mode — when editing, render the trigger + dropdown inline (in
  // normal flow) so the widget container grows and the EditWidget
  // overlay covers the whole expanded surface. When NOT editing, use
  // InlinePopover so the dropdown opens/closes via trigger click.
  return (
    <div
      className={`quicklinksSettings-container ${themeClass} ${
        isEditing ? "is-editing" : ""
      }`}
      ref={containerRef}
    >
      <div className="quicklinksSettings-header" ref={headerRef}>
        {isEditing ? (
          <>
            <button
              ref={triggerRef}
              type="button"
              className="quicklinksSettings-title"
              aria-haspopup="dialog"
              aria-expanded={true}
            >
              Links
            </button>
            {dropdownContent}
          </>
        ) : (
          <InlinePopover
            trigger={
              <button
                ref={triggerRef}
                type="button"
                className="quicklinksSettings-title"
                aria-haspopup="dialog"
                aria-expanded={Boolean(anchorEl)}
                onClick={() => {
                  const widgetEl = headerRef.current?.closest?.(
                    ".widget"
                  ) as HTMLElement | null;
                  if (widgetEl?.dataset.justDragged === "true") return;
                  if (anchorEl) setAnchorEl(null);
                  else setAnchorEl(triggerRef.current);
                }}
              >
                Links
              </button>
            }
            open={Boolean(anchorEl)}
            anchorEl={anchorEl ?? triggerRef.current}
            onClose={() => setAnchorEl(null)}
            inline={true}
            disabled={
              (headerRef.current?.closest(".widget") as HTMLElement | null)
                ?.dataset.justDragged === "true"
            }
          >
            {dropdownContent}
          </InlinePopover>
        )}
      </div>
    </div>
  );
};

export default QuickLinks;
