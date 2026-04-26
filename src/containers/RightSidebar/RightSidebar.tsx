import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderIcon from "@mui/icons-material/Folder";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuItem,
} from "../../components/ContextMenu/ContextMenu";
import { useAppContext } from "../../contexts/AppContext";
import { useT } from "../../i18n/i18n";
import "./RightSidebar.css";

interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

const SIDEBAR_WIDTH = 360;
const SIDEBAR_EDGE_TRIGGER = 10;

type BookmarksError =
  | { key: "bookmarks.errorNoChrome" }
  | { key: "bookmarks.errorNoBookmarks" }
  | { key: "bookmarks.errorBookmarksApi"; message: string }
  | { key: "bookmarks.errorLoad"; message: string };

const useChromeBookmarks = (active: boolean) => {
  const [tree, setTree] = useState<BookmarkNode[] | null>(null);
  const [error, setError] = useState<BookmarksError | null>(null);

  useEffect(() => {
    if (!active) return;
    const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
    if (!chromeNs) {
      setError({ key: "bookmarks.errorNoChrome" });
      return;
    }
    const api = chromeNs.bookmarks;
    if (!api?.getTree) {
      setError({ key: "bookmarks.errorNoBookmarks" });
      return;
    }
    let cancelled = false;

    const fetchTree = async () => {
      try {
        // Prefer the Promise form (MV3). Fall back to callback if the
        // browser doesn't support promises on this API.
        let result = api.getTree();
        if (
          !result ||
          typeof (result as Promise<BookmarkNode[]>).then !== "function"
        ) {
          result = new Promise<BookmarkNode[]>((resolve, reject) => {
            api.getTree((nodes: BookmarkNode[]) => {
              const err = chromeNs.runtime?.lastError;
              if (err) reject(new Error(err.message));
              else resolve(nodes ?? []);
            });
          });
        }
        const nodes = (await result) as BookmarkNode[];
        if (cancelled) return;
        // Surface lastError if it was set during a callback path.
        const err = chromeNs.runtime?.lastError;
        if (err) {
          setError({ key: "bookmarks.errorBookmarksApi", message: err.message });
          return;
        }
        setTree(nodes ?? []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError({
          key: "bookmarks.errorLoad",
          message: (err as Error).message ?? "unknown",
        });
        // Helpful for debugging — also log to console.
        // eslint-disable-next-line no-console
        console.error("[RightSidebar] bookmarks error:", err);
      }
    };

    fetchTree();

    const onChanged = () => fetchTree();
    api.onChanged?.addListener(onChanged);
    api.onCreated?.addListener(onChanged);
    api.onRemoved?.addListener(onChanged);
    api.onMoved?.addListener(onChanged);
    return () => {
      cancelled = true;
      api.onChanged?.removeListener(onChanged);
      api.onCreated?.removeListener(onChanged);
      api.onRemoved?.removeListener(onChanged);
      api.onMoved?.removeListener(onChanged);
    };
  }, [active]);

  return { tree, error };
};

const getFavicon = (rawUrl: string, size = 32) => {
  if (!rawUrl) return "";
  const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
  if (chromeNs?.runtime?.getURL) {
    try {
      const faviconUrl = new URL(chromeNs.runtime.getURL("/_favicon/"));
      faviconUrl.searchParams.set("pageUrl", rawUrl);
      faviconUrl.searchParams.set("size", String(size));
      return faviconUrl.toString();
    } catch {
      /* fall through */
    }
  }
  try {
    const url = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(
      url.hostname
    )}`;
  } catch {
    return "";
  }
};

const matches = (node: BookmarkNode, query: string): boolean => {
  const q = query.toLowerCase();
  if (node.title.toLowerCase().includes(q)) return true;
  if (node.url?.toLowerCase().includes(q)) return true;
  return !!node.children?.some((c) => matches(c, q));
};

// Move a bookmark via the chrome.bookmarks API. Chrome handles the
// index shift internally for same-parent moves and accepts an
// omitted index to append to the end of a destination folder.
const moveBookmark = (id: string, parentId: string, index?: number) => {
  const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
  if (!chromeNs?.bookmarks?.move) return;
  try {
    const dest: { parentId: string; index?: number } = { parentId };
    if (index !== undefined && index >= 0) dest.index = index;
    chromeNs.bookmarks.move(id, dest);
  } catch {
    /* ignore — onChanged listener will refresh on success */
  }
};

const removeBookmark = (id: string) => {
  const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
  if (!chromeNs?.bookmarks?.remove) return;
  try {
    chromeNs.bookmarks.remove(id);
  } catch {
    /* ignore */
  }
};

// Shared drag state for the bookmarks tree. Hoisted above
// BookmarkFolder/Link via Context so a link can be dropped onto a
// sibling, onto another folder, or onto any folder elsewhere in the
// tree (matching Chrome's own bookmarks bar). Refs mirror state so
// the synchronous onDrop handler reads the latest values even before
// React commits the dragOver render.
interface BookmarkDragApi {
  draggedId: string | null;
  hoveredId: string | null;
  hoveredKind: "link" | "folder" | null;
  hoveredPos: "before" | "after" | null;
  startDrag: (id: string) => void;
  hoverLink: (id: string, pos: "before" | "after") => void;
  hoverFolder: (id: string) => void;
  clearHover: () => void;
  endDrag: () => void;
  // refs for synchronous reads inside onDrop
  draggedRef: React.MutableRefObject<string | null>;
  hoveredRef: React.MutableRefObject<{
    id: string;
    kind: "link" | "folder";
    pos?: "before" | "after";
  } | null>;
}

const BookmarkDragContext = React.createContext<BookmarkDragApi | null>(null);
const useBmDrag = (): BookmarkDragApi => {
  const ctx = React.useContext(BookmarkDragContext);
  if (!ctx) throw new Error("useBmDrag outside provider");
  return ctx;
};

const useBookmarkDragState = (): BookmarkDragApi => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{
    id: string;
    kind: "link" | "folder";
    pos?: "before" | "after";
  } | null>(null);
  const draggedRef = useRef<string | null>(null);
  const hoveredRef = useRef<{
    id: string;
    kind: "link" | "folder";
    pos?: "before" | "after";
  } | null>(null);

  return {
    draggedId,
    hoveredId: hovered?.id ?? null,
    hoveredKind: hovered?.kind ?? null,
    hoveredPos: hovered?.pos ?? null,
    draggedRef,
    hoveredRef,
    startDrag: (id) => {
      draggedRef.current = id;
      setDraggedId(id);
    },
    hoverLink: (id, pos) => {
      const next = { id, kind: "link" as const, pos };
      hoveredRef.current = next;
      setHovered(next);
    },
    hoverFolder: (id) => {
      const next = { id, kind: "folder" as const };
      hoveredRef.current = next;
      setHovered(next);
    },
    clearHover: () => {
      hoveredRef.current = null;
      setHovered(null);
    },
    endDrag: () => {
      draggedRef.current = null;
      hoveredRef.current = null;
      setDraggedId(null);
      setHovered(null);
    },
  };
};

interface BookmarkFolderProps {
  node: BookmarkNode;
  parentId: string | null;
  depth: number;
  filter: string;
  defaultOpen?: boolean;
}

const BookmarkFolder: React.FC<BookmarkFolderProps> = ({
  node,
  parentId,
  depth,
  filter,
  defaultOpen = true,
}) => {
  const t = useT();
  const drag = useBmDrag();
  const filtering = filter.length > 0;
  const [open, setOpen] = useState(defaultOpen || filtering);

  useEffect(() => {
    if (filtering) setOpen(true);
  }, [filtering]);

  const visibleChildren = useMemo(() => {
    if (!node.children) return [];
    if (!filtering) return node.children;
    return node.children.filter((c) => matches(c, filter));
  }, [node.children, filter, filtering]);

  // Drop INTO this folder — append the dragged bookmark to the end.
  // stopPropagation is critical: drag events bubble, so a drop on a
  // nested folder would otherwise also fire every ancestor folder's
  // handleFolderDrop, and the outermost ancestor's moveBookmark call
  // would win — bookmarks always landing in the root-level folder
  // regardless of where you actually dropped.
  const handleFolderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragged = drag.draggedRef.current;
    if (!dragged || dragged === node.id || filtering) {
      drag.endDrag();
      return;
    }
    moveBookmark(dragged, node.id);
    drag.endDrag();
  };

  // Drop ON a child link — insert at the link's position with
  // before/after offset. Reads from refs so the latest hover is
  // always correct even before React commits the dragOver render.
  const handleChildDrop = (childId: string) => {
    const dragged = drag.draggedRef.current;
    const hover = drag.hoveredRef.current;
    if (
      !dragged ||
      dragged === childId ||
      filtering ||
      !node.children ||
      hover?.kind !== "link"
    ) {
      drag.endDrag();
      return;
    }
    const targetIdx = node.children.findIndex((c) => c.id === childId);
    if (targetIdx < 0) {
      drag.endDrag();
      return;
    }
    const newIndex = hover.pos === "after" ? targetIdx + 1 : targetIdx;
    moveBookmark(dragged, node.id, newIndex);
    drag.endDrag();
  };

  const isFolderDropTarget =
    drag.hoveredKind === "folder" &&
    drag.hoveredId === node.id &&
    drag.draggedId !== node.id;

  if (filtering && visibleChildren.length === 0) return null;

  return (
    <li
      className={`bookmarks-folder${
        isFolderDropTarget ? " is-folder-drop-target" : ""
      }`}
      // Drop handlers live on the <li> wrapper (not the toggle
      // button) so the button's onClick fires reliably. Browsers
      // can get fussy when a button has both click + drag handlers.
      onDragOver={(e) => {
        if (!drag.draggedId || drag.draggedId === node.id || filtering)
          return;
        e.preventDefault();
        // stopPropagation so an ancestor folder's onDragOver doesn't
        // overwrite the deepest folder's hover state. Without this,
        // hovering a nested folder always shows the root folder as
        // the drop target.
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        drag.hoverFolder(node.id);
      }}
      onDragLeave={(e) => {
        // Only clear if the leave is leaving this folder entirely
        // (relatedTarget is outside the li). Prevents flicker as the
        // cursor moves from the button to its child icon/text.
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        if (drag.hoveredKind === "folder" && drag.hoveredId === node.id)
          drag.clearHover();
      }}
      onDrop={handleFolderDrop}
    >
      <button
        type="button"
        className="bookmarks-folder-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        <ChevronRightIcon
          className={`bookmarks-chevron${open ? " is-open" : ""}`}
          fontSize="small"
        />
        <FolderIcon fontSize="small" className="bookmarks-folder-icon" />
        <span className="bookmarks-folder-name">
          {node.title || t("bookmarks.heading")}
        </span>
      </button>
      {open && (
        <ul className="bookmarks-list">
          {visibleChildren.map((child) =>
            child.url ? (
              <BookmarkLink
                key={child.id}
                node={child}
                draggable={!filtering}
                depth={depth + 1}
                onDrop={() => handleChildDrop(child.id)}
              />
            ) : (
              <BookmarkFolder
                key={child.id}
                node={child}
                parentId={node.id}
                depth={depth + 1}
                filter={filter}
              />
            )
          )}
        </ul>
      )}
    </li>
  );
};

interface BookmarkLinkProps {
  node: BookmarkNode;
  draggable: boolean;
  onDrop: () => void;
  /** Folder nesting level — used to indent the link tile so it lines
   *  up under its sibling folders' chevrons (which already use
   *  `paddingLeft: 8 + depth * 20`). */
  depth: number;
}

const BookmarkLink: React.FC<BookmarkLinkProps> = ({
  node,
  draggable,
  onDrop,
  depth,
}) => {
  const t = useT();
  const drag = useBmDrag();
  const favicon = node.url ? getFavicon(node.url) : "";
  const [contextMenuPos, setContextMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const isDragging = drag.draggedId === node.id;
  const isDropTarget =
    drag.hoveredKind === "link" &&
    drag.hoveredId === node.id &&
    drag.draggedId !== node.id;

  const menuItems: ContextMenuItem[] = [
    {
      type: "action",
      label: t("bookmarks.delete"),
      onClick: () => removeBookmark(node.id),
      icon: <DeleteOutlineIcon style={{ fontSize: 14 }} />,
    },
  ];

  return (
    <li
      className={[
        "bookmarks-link-item",
        isDragging ? "is-dragging" : "",
        isDropTarget ? `drop-target drop-${drag.hoveredPos ?? "before"}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={draggable}
      onDragStart={(e) => {
        try {
          e.dataTransfer.setData("text/plain", node.id);
          e.dataTransfer.effectAllowed = "move";
        } catch {
          /* ignore */
        }
        drag.startDrag(node.id);
      }}
      onDragOver={(e) => {
        if (!drag.draggedId || drag.draggedId === node.id) return;
        e.preventDefault();
        // stopPropagation so the parent folder's onDragOver doesn't
        // overwrite this link's hover state with hoverFolder. Without
        // it, hover.kind ends up "folder" and handleChildDrop bails
        // (it requires hover.kind === "link") — same-folder reorders
        // silently fall through to the parent's handleFolderDrop which
        // appends to the end instead of inserting at position.
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const pos: "before" | "after" =
          e.clientY - rect.top < rect.height / 2 ? "before" : "after";
        drag.hoverLink(node.id, pos);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop();
      }}
      onDragEnd={drag.endDrag}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      <a
        href={node.url}
        className="bookmarks-link"
        title={node.url}
        // Indent matches the parent folder toggle's `8 + depth * 20`,
        // so links visually line up under (and inside of) their
        // sibling folders' chevrons rather than hugging the panel
        // edge regardless of nesting.
        style={{ paddingLeft: 8 + depth * 20 }}
        // <a href> is implicitly draggable, which would steal the drag
        // from the wrapping <li> and turn it into a "drag the URL"
        // link-drag (browser owns dataTransfer + dropEffect). Pin it
        // off so the <li> is the unambiguous drag source.
        draggable={false}
        // Suppress click navigation while a drag is in flight so the
        // mousedown that starts the drag doesn't also follow the link.
        onClick={(e) => {
          if (drag.draggedId) e.preventDefault();
        }}
      >
        {favicon ? (
          <img
            src={favicon}
            alt=""
            aria-hidden="true"
            className="bookmarks-favicon"
            draggable={false}
          />
        ) : (
          <div className="bookmarks-favicon bookmarks-favicon-fallback" aria-hidden="true">
            {node.title.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="bookmarks-link-title">{node.title || node.url}</span>
      </a>
      {contextMenuPos && (
        <ContextMenu
          position={contextMenuPos}
          onClose={() => setContextMenuPos(null)}
          items={menuItems}
        />
      )}
    </li>
  );
};

interface RightSidebarProps {
  visible: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ visible }) => {
  const t = useT();
  const { isDragging } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const sidebarRef = useRef<HTMLElement | null>(null);
  const { tree, error } = useChromeBookmarks(visible);
  const dragApi = useBookmarkDragState();
  const errorMessage = error
    ? "message" in error
      ? t(error.key, { message: error.message })
      : t(error.key)
    : null;

  // Track previous visible so we can show a transient callout when the
  // user toggles bookmarks on (not on every reload, only the transition).
  const wasVisible = useRef(visible);
  const [showCallout, setShowCallout] = useState(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setShowCallout(true);
      const t = window.setTimeout(() => setShowCallout(false), 3500);
      wasVisible.current = visible;
      return () => window.clearTimeout(t);
    }
    wasVisible.current = visible;
  }, [visible]);

  // When the widget is toggled off, also close the sidebar.
  useEffect(() => {
    if (!visible) setIsOpen(false);
  }, [visible]);

  // Edge-hover open + outside close (mirror of LeftSidebar). While
  // a widget drag is in flight both branches bail so swinging the
  // cursor past the right edge can't hijack the drag with a sidebar
  // reveal, and a sidebar that's already open stays put.
  useEffect(() => {
    if (!visible) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) return;
      const w = window.innerWidth;
      const sidebarWidth = Math.min(SIDEBAR_WIDTH, w);
      if (e.clientX > w - SIDEBAR_EDGE_TRIGGER) setIsOpen(true);
      else if (isOpen && e.clientX < w - sidebarWidth) setIsOpen(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [visible, isOpen, isDragging]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Cmd/Ctrl+B toggles the bookmarks panel — mirrors the Cmd/Ctrl+K
  // sidebar shortcut on the left. Only active when bookmarks widget
  // is enabled, otherwise pressing the combo would have no visible
  // effect.
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible]);

  // inert when closed
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    if (isOpen) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [isOpen]);

  if (!visible) return null;

  // Tree comes back as [{ id: "0", children: [{ id: "1", title: "Bookmarks Bar", ... }] }]
  // Skip the synthetic root, render its children as top-level folders.
  const topLevel = tree?.[0]?.children ?? [];

  // Whether the active search has any matching node anywhere in the
  // tree. Used to swap the folder list for a "no results" empty
  // state when nothing matches.
  const filtering = filter.length > 0;
  const hasResults = filtering
    ? topLevel.some((node) => matches(node, filter))
    : true;

  return (
    <>
      {showCallout && (
        <div className="bookmarks-toggle-callout" role="status" aria-live="polite">
          {t("bookmarks.callout")}
        </div>
      )}
      <aside
      ref={sidebarRef}
      id="bookmarks-sidebar"
      className={`right-sidebar ${isOpen ? "open" : ""}`}
      aria-label={t("bookmarks.ariaLabel")}
    >
      <div className="right-sidebar-content">
        <header className="bookmarks-header">
          <h4>{t("bookmarks.heading")}</h4>
        </header>

        <input
          id="bookmarks-search"
          type="search"
          className="bookmarks-search"
          placeholder={t("bookmarks.searchPlaceholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={t("bookmarks.searchAria")}
        />

        {errorMessage && <p className="bookmarks-error">{errorMessage}</p>}

        {!error && tree === null && (
          <p className="bookmarks-empty">{t("bookmarks.loading")}</p>
        )}

        {!error && tree !== null && topLevel.length === 0 && (
          <p className="bookmarks-empty">{t("bookmarks.empty")}</p>
        )}

        {!error && topLevel.length > 0 && hasResults && (
          <BookmarkDragContext.Provider value={dragApi}>
            <ul className="bookmarks-list bookmarks-root-list">
              {topLevel.map((node) => (
                <BookmarkFolder
                  key={node.id}
                  node={node}
                  parentId={null}
                  depth={0}
                  filter={filter}
                  defaultOpen
                />
              ))}
            </ul>
          </BookmarkDragContext.Provider>
        )}

        {!error && topLevel.length > 0 && !hasResults && (
          <div className="bookmarks-no-results" role="status" aria-live="polite">
            <img
              src="/assets/avatars/boh.gif"
              alt=""
              aria-hidden="true"
              className="bookmarks-no-results-avatar"
              draggable={false}
            />
            <p className="bookmarks-no-results-title">
              {t("bookmarks.noResultsTitle")}
            </p>
            <p className="bookmarks-no-results-sub">
              {t("bookmarks.noResultsSub", { query: filter })}
            </p>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};

export default RightSidebar;
