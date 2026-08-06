import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../components/Button/Button";
import { AddIcon, CancelIcon, DeleteOutlineIcon, DragIndicatorIcon, EditIcon } from "../../../components/Icons/Icons";
import {
  ContextMenu,
  ContextMenuItem,
} from "../../../components/ContextMenu/ContextMenu";
import { Favicon } from "../../../components/Favicon/Favicon";
import {
  isHighlightTextColor,
  resolveForeground,
} from "../../../utils/textHighlight";
import InlinePopover from "../../../components/InlinePopover/InlinePopover";
import TextInput from "../../../components/TextInput/TextInput";
import { resolveSurfaceFrost } from "../../../config/widgetConfig";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import { useScaledPx } from "../../../utils/viewportScale";
import "./QuickLinks.css";

/**
 * Turn whatever was typed into a URL worth storing.
 *
 * People paste all of "tiktok.com", "www.tiktok.com/@x", "HTTP://Foo.com",
 * "  github.com  " and "localhost:3000". The rules, in order:
 *   - trim, and drop any zero-width junk a copy-paste dragged along
 *   - keep a real scheme, but lower-case it (and upgrade bare http on
 *     hosts that aren't local, since everything public is https now)
 *   - otherwise assume https
 *   - lower-case the host (paths stay case-sensitive - they matter)
 *   - drop a trailing "/" on a bare origin so "site.com" and
 *     "site.com/" don't become two different tiles
 */
const normalizeUrl = (raw: string) => {
  const trimmed = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!trimmed) return trimmed;
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname.endsWith(".local") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
    if (url.protocol === "http:" && !isLocal) url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    const out = url.toString();
    return url.pathname === "/" && !url.search && !url.hash
      ? out.replace(/\/$/, "")
      : out;
  } catch {
    // Unparseable (a bare word, say) - store what they typed rather
    // than silently mangling it.
    return withScheme;
  }
};

/**
 * A human label for a URL the user didn't name.
 *
 * The old fallback was the raw URL, which made tiles read
 * "https://github.com/…" under an icon with room for one word. The
 * first host label, capitalised, is what the tile actually wants.
 */
const titleFromUrl = (rawUrl: string): string => {
  try {
    const host = new URL(normalizeUrl(rawUrl)).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return rawUrl.trim();
  }
};

export const QuickLinks: React.FC = () => {
  const t = useT();
  const {
    widgets,
    updateWidgetSettings,
    showWidgetEdits,
    editingWidgetKey,
    appearance,
  } = useAppContext();
  // True when QuickLinks is in any kind of edit mode - global or per-widget.
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
  // Which SIDE of the hovered tile the link would land on. Without
  // this there's no way to drop past the last item: every drop
  // inserted AT the target index, so the indicator could only ever sit
  // before a tile and the end of the list was unreachable. Mirrors the
  // todo list, which solved the same problem. The ref shadows the
  // state because onDrop fires before React has re-rendered.
  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);
  const dropPosRef = useRef<"before" | "after" | null>(null);
  const [addGridLink, setAddGridLink] = useState(false);
  // Right-click per-tile menu state - when set, ContextMenu opens
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

  // The add card used to spring open by itself whenever the widget
  // entered edit mode. It now sits over the grid, so opening it
  // unasked hides the very tiles the user came to rearrange - and the
  // + tile is permanently visible, so there's nothing to compensate
  // for. Leaving edit mode still clears any half-typed entry.
  useEffect(() => {
    if (!isEditing || !showGrid) {
      setAddGridLink(false);
      setTitle("");
      setUrl("");
    }
  }, [isEditing, showGrid]);

  // Right-click "Add new link" entry on the widget's context menu
  // dispatches this event - open the mode-appropriate add UI (grid
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

  // settings.width/height are reference-px (1920 baseline).
  const width = useScaledPx(quicklinksSettings.width);
  const height = useScaledPx(quicklinksSettings.height);

  useEffect(() => {
    if (anchorEl) setTimeout(() => urlInputRef.current?.focus(), 0);
  }, [anchorEl]);

  // Auto-focus the URL field when the grid add card opens, and close
  // on Escape / a click outside it.
  useEffect(() => {
    if (!addGridLink) return;
    const id = window.setTimeout(() => urlInputRef.current?.focus(), 0);
    const dismiss = () => {
      setAddGridLink(false);
      setEditingLinkId(null);
      setTitle("");
      setUrl("");
    };
    const handleClick = (e: MouseEvent) => {
      const form = document.querySelector(".ql-add-card");
      const trigger = document.querySelector(".ql-add-cell");
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

  // The per-link right-click menu renders as a SIBLING of the list
  // dropdown (it has to - a ContextMenu inside the popover would be
  // clipped by it), so closing the dropdown left the menu floating
  // over the page on its own. Tie its lifetime to the parent.
  // Editing mode is exempt: there the list renders inline and is
  // always present, so `anchorEl` is null even while it's on screen.
  useEffect(() => {
    if (!isEditing && !anchorEl) setLinkMenu(null);
  }, [anchorEl, isEditing]);

  const addLink = () => {
    if (!url.trim()) return;
    if (editingLinkId) {
      // Edit existing link in place.
      updateWidgetSettings("quicklinks", {
        links: quicklinksSettings.links.map((l) =>
          l.id === editingLinkId
            ? {
                ...l,
                title: title.trim() || titleFromUrl(url),
                url: normalizeUrl(url),
              }
            : l
        ),
      });
      setEditingLinkId(null);
    } else {
      const newLink = {
        id: Date.now().toString(),
        title: title.trim() || titleFromUrl(url),
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

  const handleDragDrop = (
    from: number,
    to: number,
    pos: "before" | "after",
  ) => {
    if (from === to) return;
    const updated = [...quicklinksSettings.links];
    const [removed] = updated.splice(from, 1);
    // `to` indexes the ORIGINAL array; removing the dragged item first
    // shifts everything after it down one.
    let insert = to > from ? to - 1 : to;
    if (pos === "after") insert += 1;
    updated.splice(insert, 0, removed);
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
            // The list stacks vertically and the grid wraps
            // horizontally, so each measures the axis it actually
            // reads along.
            const rect = e.currentTarget.getBoundingClientRect();
            const pos: "before" | "after" = showGrid
              ? e.clientX - rect.left < rect.width / 2
                ? "before"
                : "after"
              : e.clientY - rect.top < rect.height / 2
                ? "before"
                : "after";
            dropPosRef.current = pos;
            setDragOverIndex(index);
            setDropPos(pos);
          },
          onDrop: () => {
            if (draggedIndex === null) return;
            handleDragDrop(draggedIndex, index, dropPosRef.current ?? "before");
            dropPosRef.current = null;
            setDraggedIndex(null);
            setDragOverIndex(null);
            setDropPos(null);
          },
          onDragEnd: () => {
            dropPosRef.current = null;
            setDraggedIndex(null);
            setDragOverIndex(null);
            setDropPos(null);
          },
        };

      // A real modal, portalled to <body>: the widget shell is transform'ed,
  // so a fixed-position child would anchor to the widget, and inside the
  // widget the card competes with surfaces that scroll and clip. Shared
  // by BOTH modes - grid tiles and the list dropdown open the same card
  // for add and edit.
  /* prior placement note: the widget shell is
              `transform`ed, so a fixed-position child of it would
              anchor to the widget instead of the viewport - and inside
              the widget the card had to compete with a grid that
              scrolls and clips. */
  const addEditModal =
    addGridLink &&
    createPortal(
            <div
              className="ql-add-overlay"
              onMouseDown={(e) => {
                // Backdrop click closes; the card stops propagation.
                if (e.target !== e.currentTarget) return;
                setAddGridLink(false);
                setEditingLinkId(null);
                setTitle("");
                setUrl("");
              }}
            >
              <form
                className="ql-add-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  addLink();
                  // Closes on save either way - a modal that stays up
                  // after you commit reads as "that didn't work".
                  setAddGridLink(false);
                  setEditingLinkId(null);
                }}
              >
                <h4 className="ql-add-title">
                  {editingLinkId
                    ? t("quicklinks.editTitle")
                    : t("quicklinks.addTitle")}
                </h4>

                {/* Live preview of the tile being built - the favicon
                    lands as soon as the URL resolves, which is the
                    fastest way to see you typed the right site. */}
                <div className="ql-add-preview">
                  {url.trim() ? (
                    <Favicon
                      url={url}
                      size={32}
                      className="ql-add-preview-icon"
                      fallbackClassName="ql-add-preview-icon ql-favicon-fallback"
                      fallback={titleFromUrl(url).charAt(0)}
                    />
                  ) : (
                    <span className="ql-add-preview-icon ql-favicon-fallback" />
                  )}
                  <span className="ql-add-preview-text">
                    <span className="ql-add-preview-title">
                      {title.trim() ||
                        (url.trim()
                          ? titleFromUrl(url)
                          : t("quicklinks.previewEmpty"))}
                    </span>
                    {/* The address as it will actually be saved. Shown
                        rather than typed into the field: rewriting the
                        input mid-keystroke moves the caret and makes
                        the scheme impossible to edit - you'd type "g",
                        get "https://g", and be unable to get back in
                        front of it. */}
                    {url.trim() && (
                      <span className="ql-add-preview-url">
                        {normalizeUrl(url)}
                      </span>
                    )}
                  </span>
                </div>

                <label className="ql-add-label" htmlFor="ql-grid-url-input">
                  {t("quicklinks.urlLabel")}
                </label>
                <TextInput
                  id="ql-grid-url-input"
                  ref={urlInputRef}
                  placeholder={t("quicklinks.urlPlaceholder")}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  // Settle the field to its canonical form once you
                  // leave it - the same normalisation submit applies,
                  // just made visible a step earlier.
                  onBlur={() => setUrl((v) => (v.trim() ? normalizeUrl(v) : v))}
                  onClick={(e) => e.stopPropagation()}
                />

                <label className="ql-add-label" htmlFor="ql-grid-title-input">
                  {t("quicklinks.labelOptional")}
                </label>
                <TextInput
                  id="ql-grid-title-input"
                  // Placeholder previews the name it would get from the
                  // URL, so leaving it blank is an informed choice
                  // rather than a guess.
                  placeholder={
                    url.trim()
                      ? titleFromUrl(url)
                      : t("quicklinks.labelPlaceholder")
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="ql-add-actions">
                  <button
                    type="button"
                    className="ql-add-cancel"
                    onClick={() => {
                      setAddGridLink(false);
                      setEditingLinkId(null);
                      setTitle("");
                      setUrl("");
                    }}
                  >
                    {t("quicklinks.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="ql-add-submit"
                    disabled={!url.trim()}
                  >
                    {editingLinkId
                      ? t("quicklinks.save")
                      : t("quicklinks.addButton")}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          );

  // Per-link right-click menu - shared verbatim between grid tiles and
  // list rows so the two modes keep the same functionality.
  const linkMenuRender =
    linkMenu &&
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
              {
                type: "action",
                label: t("widgets.contextMenu.addLink"),
                icon: <AddIcon style={{ fontSize: 14 }} />,
                onClick: () => {
                  setEditingLinkId(null);
                  setTitle("");
                  setUrl("");
                  setAddGridLink(true);
                },
              },
            ];
            return (
              <ContextMenu
                position={{ x: linkMenu.x, y: linkMenu.y }}
                items={items}
                onClose={() => setLinkMenu(null)}
              />
            );
          })();

  // Shared surface treatment (mirrors todo): frosted drops the tile
  // alpha to a whisper so the shell's glass reads through; a custom
  // surfaceColor overrides the theme's --dark-rgb triplet locally.
  // QuicklinksSettings carries all of these now, so no cast needed.
  const qs = quicklinksSettings;
  // Each mode paints a different surface (the grid's own background vs
  // the floating popup), so they carry separate alphas.
  const surfaceAlpha = showGrid ? (qs.opacity ?? 0) : (qs.listOpacity ?? 75);
  const qlFrosted = resolveSurfaceFrost(qs.frosted, appearance.theme);
  const surfaceStyle: Record<string, string | number> = {
    "--ql-opacity": qlFrosted ? 0.14 : surfaceAlpha / 100,
    // Form fields keep a floor: the add/edit inputs need to read as
    // inputs even when the surface around them is fully transparent.
    "--input-opacity": qlFrosted
      ? 0.14
      : Math.max(0.35, surfaceAlpha / 100),
    // Ink follows the chosen tint - a pale surface needs dark text, and
    // the default --light would vanish on it. An EXPLICIT light/dark
    // pick applies even with no surface colour, since that's a direct
    // instruction rather than something derived from a tint; only
    // "auto" needs a colour to reason about.
    ...((): Record<string, string> => {
      const mode = isHighlightTextColor(qs.textColor) ? qs.textColor : "auto";
      if (typeof qs.surfaceColor === "string")
        return { "--ql-ink": resolveForeground(qs.surfaceColor, mode) };
      if (mode === "light") return { "--ql-ink": "#f7f3ea" };
      if (mode === "dark") return { "--ql-ink": "#1f2420" };
      return {};
    })(),
    ...(typeof qs.surfaceColor === "string"
      ? {
          "--ql-surface-rgb": qs.surfaceColor
            .replace("#", "")
            .match(/../g)!
            .map((h) => parseInt(h, 16))
            .join(", "),
          "--dark-rgb": qs.surfaceColor
            .replace("#", "")
            .match(/../g)!
            .map((h) => parseInt(h, 16))
            .join(", "),
        }
      : {}),
  };

  if (showGrid) {
    return (
      <div
        className="quicklinksSettings-grid-wrapper widget-header"
        style={surfaceStyle as React.CSSProperties}
      >
        <div className="quicklinksSettings-grid-list">
          <div
            className="quicklinksSettings-grid-scroll"
            style={{ width, maxHeight: height }}
          >
            {quicklinksSettings.links.map((l, index) => {
              const isDragOver =
                draggedIndex !== null && dragOverIndex === index;
              return (
                <div
                  key={l.id}
                  className={`ql-grid-cell${
                    draggedIndex === index ? " dragging" : ""
                  }${
                    isDragOver
                      ? ` drag-over drop-${dropPos ?? "before"}`
                      : ""
                  }${
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
                    <Favicon
                      url={l.url}
                      className="ql-grid-favicon"
                      fallbackClassName="ql-grid-favicon ql-favicon-fallback"
                      fallback={l.title.charAt(0).toUpperCase()}
                    />
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
            <button
              type="button"
              className="ql-grid-cell ql-add-cell"
              onClick={() => {
                setEditingLinkId(null);
                setTitle("");
                setUrl("");
                setAddGridLink(true);
              }}
              aria-label={t("quicklinks.addAria")}
            >
              <AddIcon className="ql-add-cell-icon" />
              <span className="ql-add-cell-label">
                {t("quicklinks.addTile")}
              </span>
            </button>
          </div>

          {addEditModal}
        </div>
        {linkMenuRender}
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
      style={surfaceStyle as React.CSSProperties}
    >

            <ul className="quicklinksSettings-list">
              {quicklinksSettings.links.length === 0 ? (
                <li className="quicklinksSettings-empty">
                  {t("quicklinks.emptyMessage")}
                </li>
              ) : (
                quicklinksSettings.links.map((l, index) => {
                  return (
                    <li
                      key={l.id}
                      className={`quicklinksSettings-item${
                        draggedIndex === index ? " dragging" : ""
                      }${
                        draggedIndex !== null && dragOverIndex === index
                          ? ` drag-over drop-${dropPos ?? "before"}`
                          : ""
                      }${showWidgetEdits ? "" : " draggable"}`}
                      onDragOver={dndProps(index).onDragOver}
                      onDrop={dndProps(index).onDrop}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLinkMenu({ id: l.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <a
                        href={normalizeUrl(l.url)}
                        className="quicklinksSettings-link"
                        title={l.url}
                      >
                        {/* Inside the anchor: the icon is part of the
                            link's hit area, which is what people aim
                            for. It used to be a sibling, so clicking it
                            did nothing. */}
                        <Favicon
                          url={l.url}
                          size={32}
                          className="ql-favicon"
                          fallbackClassName="ql-favicon ql-favicon-fallback"
                          fallback={(l.title.trim() || l.url)
                            .charAt(0)
                            .toUpperCase()}
                        />
                        {/* One line only. A title is what the user
                            chose to call the link; with none, the URL
                            IS the label rather than a second row of
                            small print under an empty one. */}
                        <span className="ql-title">
                          {l.title.trim() || l.url}
                        </span>
                      </a>
                      <button
                        type="button"
                        className="quicklinksSettings-delete quicklinksSettings-editlink"
                        aria-label={t("widgets.contextMenu.edit", {
                          name: l.title,
                        })}
                        data-tooltip={t("quicklinks.editTitle")}
                        onClick={() => {
                          setEditingLinkId(l.id);
                          setTitle(l.title);
                          setUrl(l.url);
                          setAddGridLink(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </button>
                      <button
                        type="button"
                        className="quicklinksSettings-delete"
                        aria-label={t("quicklinks.deleteAria", { title: l.title })}
                        data-tooltip={t("quicklinks.deleteListTooltip")}
                        onClick={() => removeLink(l.id)}
                      >
                        <CancelIcon fontSize="small" />
                      </button>
                      <span
                        className="ql-drag-handle"
                        aria-hidden="true"
                        data-tooltip={t("todo.dragHandleTooltip")}
                        {...dndProps(index)}
                      >
                        <DragIndicatorIcon style={{ fontSize: 14 }} />
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
            {/* Subtle append row - same modal card as the grid. */}
            <button
              type="button"
              className="ql-list-add"
              onClick={(e) => {
                e.stopPropagation();
                setEditingLinkId(null);
                setTitle("");
                setUrl("");
                setAddGridLink(true);
              }}
            >
              <AddIcon fontSize="small" />
              {t("widgets.contextMenu.addLink")}
            </button>
          </div>
  );

  // List mode - when editing, render the trigger + dropdown inline (in
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
      {addEditModal}
      {linkMenuRender}
    </div>
  );
};

export default QuickLinks;
