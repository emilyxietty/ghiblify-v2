import AddCircleIcon from "@mui/icons-material/AddCircle";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button/Button";
import {
  ContextMenu,
  ContextMenuItem,
} from "../../../components/ContextMenu/ContextMenu";
import InlinePopover from "../../../components/InlinePopover/InlinePopover";
import TextInput from "../../../components/TextInput/TextInput";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
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
  const t = useT();
  const {
    widgets,
    updateWidgetSettings,
    showWidgetEdits,
    editingWidgetKey,
    setEditingWidgetKey,
    setDragMode,
    toggleWidgetVisibility,
  } = useAppContext();
  // True when QuickLinks is in any kind of edit mode — global or per-widget.
  const isEditing = showWidgetEdits || editingWidgetKey === "quicklinks";
  const quicklinksSettings = widgets.quicklinks.settings;
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
  // Right-click per-tile menu state — when set, ContextMenu opens
  // at (x, y) with edit/delete actions for the targeted link id.
  const [linkMenu, setLinkMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  // When set, the add form acts as an edit form for this link id.
  // Submit replaces the existing link's title/url instead of creating
  // a new entry.
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const showGrid = !!quicklinksSettings.gridMode;

  // Auto-open the grid add-link form whenever the user is in edit
  // mode on the grid view, so they can immediately type a new link
  // without having to click the + tile first. Closes back when edit
  // mode exits.
  useEffect(() => {
    if (isEditing && showGrid) {
      setAddGridLink(true);
    } else {
      setAddGridLink(false);
      setTitle("");
      setUrl("");
    }
  }, [isEditing, showGrid]);

  // Right-click "Add new link" entry on the widget's context menu
  // dispatches this event — open the mode-appropriate add UI (grid
  // form or list popover).
  useEffect(() => {
    const onAdd = () => {
      if (showGrid) {
        setAddGridLink(true);
      } else if (triggerRef.current) {
        setAnchorEl(triggerRef.current);
      }
    };
    window.addEventListener("ghiblify:quicklinks:add", onAdd);
    return () =>
      window.removeEventListener("ghiblify:quicklinks:add", onAdd);
  }, [showGrid]);

  const width = quicklinksSettings.width;
  const height = quicklinksSettings.height;

  useEffect(() => {
    if (anchorEl) setTimeout(() => urlInputRef.current?.focus(), 0);
  }, [anchorEl]);

  // Auto-focus the URL field when the grid add form opens. While
  // edit mode is on, skip the outside-click / Escape dismissal — the
  // form is supposed to stay open for the duration of the edit
  // session so the user can keep adding links.
  useEffect(() => {
    if (!addGridLink) return;
    const id = window.setTimeout(() => urlInputRef.current?.focus(), 0);
    if (isEditing) {
      return () => window.clearTimeout(id);
    }
    const dismiss = () => {
      setAddGridLink(false);
      setTitle("");
      setUrl("");
    };
    const handleClick = (e: MouseEvent) => {
      const form = document.querySelector(".quicklinksSettings-add");
      const trigger = document.querySelector(".ql-control-cell");
      const target = e.target as Node;
      if (form?.contains(target)) return;
      if (trigger?.contains(target)) return;
      dismiss();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [addGridLink, isEditing]);

  const addLink = () => {
    if (!url.trim()) return;
    if (editingLinkId) {
      // Edit existing link in place.
      updateWidgetSettings("quicklinks", {
        links: quicklinksSettings.links.map((l) =>
          l.id === editingLinkId
            ? {
                ...l,
                title: title.trim() || url.trim(),
                url: normalizeUrl(url),
              }
            : l
        ),
      });
      setEditingLinkId(null);
    } else {
      const newLink = {
        id: Date.now().toString(),
        title: title.trim() || url.trim(),
        url: normalizeUrl(url),
      };
      updateWidgetSettings("quicklinks", {
        links: [...quicklinksSettings.links, newLink],
      });
    }
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
          onDragStart: (e: React.DragEvent) => {
            // Yield to widget-level Shift+drag.
            if (e.shiftKey) {
              e.preventDefault();
              return;
            }
            setDraggedIndex(index);
          },
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
        className="quicklinksSettings-grid-wrapper widget-header"
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
                  onContextMenu={(e) => {
                    // Per-tile right-click → custom menu with edit
                    // and delete actions for this specific link.
                    e.preventDefault();
                    e.stopPropagation();
                    setLinkMenu({ id: l.id, x: e.clientX, y: e.clientY });
                  }}
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
                    aria-label={t("quicklinks.deleteAria", { title: l.title })}
                    data-tooltip={t("quicklinks.deleteGridTooltip", { title: l.title })}
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
            <div className="ql-grid-cell ql-control-cell">
              <Button
                variant="dark"
                icon={<AddCircleIcon fontSize="small" />}
                onClick={() => setAddGridLink(true)}
                aria-label={t("quicklinks.addAria")}
                data-tooltip={t("quicklinks.addTooltip")}
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
              // Keep the form open while in edit mode so the user
              // can chain multiple adds without re-opening it. Focus
              // returns to the URL field for the next entry.
              if (!isEditing) setAddGridLink(false);
              else window.setTimeout(() => urlInputRef.current?.focus(), 0);
            }}
          >
            <label className="ql-sr-only" htmlFor="ql-grid-title-input">
              {t("quicklinks.labelSrOnly")}
            </label>
            <TextInput
              id="ql-grid-title-input"
              placeholder={t("quicklinks.labelPlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              key={`grid-title-${addGridLink}`}
            />
            <label className="ql-sr-only" htmlFor="ql-grid-url-input">
              {t("quicklinks.urlSrOnly")}
            </label>
            <TextInput
              id="ql-grid-url-input"
              ref={urlInputRef}
              placeholder={t("quicklinks.urlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              key={`grid-url-${addGridLink}`}
            />
            <button
              type="submit"
              className="quicklinksSettings-add-btn"
              disabled={!url.trim()}
              aria-label={t("quicklinks.saveAria")}
              data-tooltip={t("quicklinks.saveTooltip")}
            >
              <AddIcon fontSize="small" />
            </button>
          </form>
        )}
        {linkMenu &&
          (() => {
            const link = quicklinksSettings.links.find(
              (l) => l.id === linkMenu.id
            );
            if (!link) return null;
            // Per-link items first (most specific to the click target),
            // then the same widget-level items the widget shell's
            // right-click menu shows. Keeps tile right-click as a
            // superset so users don't have to right-click the widget
            // edge to get widget options.
            const items: ContextMenuItem[] = [
              {
                type: "action",
                label: t("quicklinks.editLink"),
                icon: <EditIcon style={{ fontSize: 14 }} />,
                onClick: () => {
                  setEditingLinkId(link.id);
                  setTitle(link.title);
                  setUrl(link.url);
                  setAddGridLink(true);
                },
              },
              {
                type: "action",
                label: t("quicklinks.deleteLink"),
                icon: <DeleteOutlineIcon style={{ fontSize: 14 }} />,
                onClick: () => removeLink(link.id),
              },
              { type: "separator" },
              {
                type: "action",
                label: t("widgets.contextMenu.edit"),
                icon: <EditIcon style={{ fontSize: 14 }} />,
                onClick: () => setEditingWidgetKey("quicklinks"),
              },
              {
                type: "action",
                label: t("widgets.contextMenu.drag"),
                icon: <OpenWithIcon style={{ fontSize: 14 }} />,
                onClick: () => setDragMode(true),
              },
              {
                type: "action",
                label: t("widgets.contextMenu.hide"),
                icon: <VisibilityOffIcon style={{ fontSize: 14 }} />,
                onClick: () => toggleWidgetVisibility("quicklinks"),
              },
              { type: "separator" },
              {
                type: "action",
                label: t("widgets.contextMenu.addLink"),
                onClick: () =>
                  window.dispatchEvent(
                    new CustomEvent("ghiblify:quicklinks:add")
                  ),
              },
              {
                type: "radio",
                label: t("widgets.edit.gridShow"),
                selected: !!quicklinksSettings.gridMode,
                onClick: () =>
                  updateWidgetSettings("quicklinks", { gridMode: true }),
              },
              {
                type: "radio",
                label: t("widgets.edit.gridShowList"),
                selected: !quicklinksSettings.gridMode,
                onClick: () =>
                  updateWidgetSettings("quicklinks", { gridMode: false }),
              },
            ];
            return (
              <ContextMenu
                position={{ x: linkMenu.x, y: linkMenu.y }}
                items={items}
                onClose={() => setLinkMenu(null)}
              />
            );
          })()}
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
      aria-label={t("quicklinks.ariaDialog")}
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
                {t("quicklinks.labelSrOnly")}
              </label>
              <TextInput
                id="ql-list-title-input"
                placeholder={t("quicklinks.labelPlaceholder")}
                inputSize="small"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                key={`popover-title-${anchorEl ? "open" : "closed"}`}
              />
              <label className="ql-sr-only" htmlFor="ql-list-url-input">
                {t("quicklinks.urlSrOnly")}
              </label>
              <TextInput
                id="ql-list-url-input"
                ref={urlInputRef}
                inputSize="small"
                placeholder={t("quicklinks.urlPlaceholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                key={`popover-url-${anchorEl ? "open" : "closed"}`}
              />
              <button
                type="submit"
                className="quicklinksSettings-add-btn"
                disabled={!url.trim()}
                aria-label={t("quicklinks.saveAria")}
                data-tooltip={t("quicklinks.saveTooltip")}
              >
                <AddIcon fontSize="small" />
              </button>
            </form>
            <ul className="quicklinksSettings-list">
              {quicklinksSettings.links.length === 0 ? (
                <li className="quicklinksSettings-empty">
                  {t("quicklinks.emptyMessage")}
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
                        aria-label={t("quicklinks.deleteAria", { title: l.title })}
                        data-tooltip={t("quicklinks.deleteListTooltip")}
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
      className={`quicklinksSettings-container ${
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
              {t("quicklinks.trigger")}
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
                {t("quicklinks.trigger")}
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
