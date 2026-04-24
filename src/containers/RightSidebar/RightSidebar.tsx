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
        "This page isn't running as a Chrome extension — chrome.* APIs are unavailable. Open the new tab inside the installed extension."
      );
      return;
    }
    const api = chromeNs.bookmarks;
    if (!api?.getTree) {
      setError(
        "chrome.bookmarks is missing. The bookmarks permission isn't active for this extension. Reload the extension in chrome://extensions (the version bump should re-prompt for permission), or remove + re-add the unpacked extension to force a fresh grant."
      );
      return;
    }
    let cancelled = false;
    const fetchTree = () => {
      try {
        api.getTree((nodes: BookmarkNode[]) => {
          if (cancelled) return;
          setTree(nodes ?? []);
          setError(null);
        });
      } catch (err) {
        setError(`Failed to load bookmarks: ${(err as Error).message}`);
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

const getFavicon = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(
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
  defaultOpen = false,
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
            {topLevel.map((node, idx) => (
              <BookmarkFolder
                key={node.id}
                node={node}
                depth={0}
                filter={filter}
                defaultOpen={idx === 0}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default RightSidebar;
