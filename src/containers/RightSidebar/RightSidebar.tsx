import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FolderIcon from "@mui/icons-material/Folder";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./RightSidebar.css";

interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

const SIDEBAR_WIDTH = 360;
const SIDEBAR_EDGE_TRIGGER = 10;

const useChromeBookmarks = (active: boolean) => {
  const [tree, setTree] = useState<BookmarkNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
    if (!chromeNs) {
      setError(
        "This page isn't running as a Chrome extension — chrome.* APIs are unavailable. Open the new tab inside the installed extension (URL should start with chrome-extension://)."
      );
      return;
    }
    const api = chromeNs.bookmarks;
    if (!api?.getTree) {
      setError(
        "chrome.bookmarks is missing. Either the bookmarks permission isn't active, or the extension isn't fully installed. Try: chrome://extensions → remove Ghiblify → Load unpacked → select dist/."
      );
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
          setError(`Bookmarks error: ${err.message}`);
          return;
        }
        setTree(nodes ?? []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          `Failed to load bookmarks: ${(err as Error).message ?? "unknown"}`
        );
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

interface BookmarkFolderProps {
  node: BookmarkNode;
  depth: number;
  filter: string;
  defaultOpen?: boolean;
}

const BookmarkFolder: React.FC<BookmarkFolderProps> = ({
  node,
  depth,
  filter,
  defaultOpen = true,
}) => {
  // When filtering, force-open every folder so matches are visible.
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

  if (filtering && visibleChildren.length === 0) return null;

  return (
    <li className="bookmarks-folder">
      <button
        type="button"
        className="bookmarks-folder-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <ChevronRightIcon
          className={`bookmarks-chevron${open ? " is-open" : ""}`}
          fontSize="small"
        />
        <FolderIcon fontSize="small" className="bookmarks-folder-icon" />
        <span className="bookmarks-folder-name">
          {node.title || "Bookmarks"}
        </span>
      </button>
      {open && (
        <ul className="bookmarks-list">
          {visibleChildren.map((child) =>
            child.url ? (
              <BookmarkLink key={child.id} node={child} depth={depth + 1} />
            ) : (
              <BookmarkFolder
                key={child.id}
                node={child}
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

const BookmarkLink: React.FC<{ node: BookmarkNode; depth: number }> = ({
  node,
  depth,
}) => {
  const favicon = node.url ? getFavicon(node.url) : "";
  return (
    <li className="bookmarks-link-item">
      <a
        href={node.url}
        className="bookmarks-link"
        title={node.url}
        style={{ paddingLeft: 8 + depth * 12 }}
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
    </li>
  );
};

interface RightSidebarProps {
  visible: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ visible }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const sidebarRef = useRef<HTMLElement | null>(null);
  const { tree, error } = useChromeBookmarks(visible);

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

  // Edge-hover open + outside close (mirror of LeftSidebar).
  useEffect(() => {
    if (!visible) return;
    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const sidebarWidth = Math.min(SIDEBAR_WIDTH, w);
      if (e.clientX > w - SIDEBAR_EDGE_TRIGGER) setIsOpen(true);
      else if (isOpen && e.clientX < w - sidebarWidth) setIsOpen(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [visible, isOpen]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

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

  return (
    <>
      {showCallout && (
        <div className="bookmarks-toggle-callout" role="status" aria-live="polite">
          Bookmarks panel — hover the right edge to open
        </div>
      )}
      <aside
      ref={sidebarRef}
      id="bookmarks-sidebar"
      className={`right-sidebar ${isOpen ? "open" : ""}`}
      aria-label="Bookmarks"
    >
      <div className="right-sidebar-content">
        <header className="bookmarks-header">
          <h4>Bookmarks</h4>
        </header>

        <input
          type="search"
          className="bookmarks-search"
          placeholder="Search bookmarks..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search bookmarks"
        />

        {error && <p className="bookmarks-error">{error}</p>}

        {!error && tree === null && (
          <p className="bookmarks-empty">Loading bookmarks…</p>
        )}

        {!error && tree !== null && topLevel.length === 0 && (
          <p className="bookmarks-empty">No bookmarks yet.</p>
        )}

        {!error && topLevel.length > 0 && (
          <ul className="bookmarks-list bookmarks-root-list">
            {topLevel.map((node) => (
              <BookmarkFolder
                key={node.id}
                node={node}
                depth={0}
                filter={filter}
                defaultOpen
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
    </>
  );
};

export default RightSidebar;
