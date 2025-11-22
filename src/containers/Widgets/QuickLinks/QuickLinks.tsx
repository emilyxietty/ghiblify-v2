import Popper from "@mui/material/Popper";
import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import "./QuickLinks.css";

export const QuickLinks: React.FC = () => {
  const { quickLinks, updateQuickLinks, isDragging } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const popperRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) {
        setAnchorEl(null);
        return;
      }
      // clicks inside container/header should not close
      if (containerRef.current && containerRef.current.contains(target)) return;
      // clicks inside the popper dropdown should not close
      const dropdown = document.querySelector(
        ".quicklinks-dropdown"
      ) as HTMLElement | null;
      if (dropdown && dropdown.contains(target)) return;
      setAnchorEl(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // focus url input when popper opens
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
      // If URL already has a scheme (e.g. http:// or mailto:), leave it
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(t)) return t;
      // Otherwise assume https
      return `https://${t}`;
    };

    const newLink = {
      id: Date.now().toString(),
      title: title.trim() || url.trim(),
      url: normalizeUrl(url),
    };
    updateQuickLinks([newLink, ...quickLinks]);
    setTitle("");
    setUrl("");
    // keep popover open after adding
    if (headerRef.current) setAnchorEl(headerRef.current);
  };

  const removeLink = (id: string) => {
    updateQuickLinks(quickLinks.filter((l) => l.id !== id));
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
    window.open(href, "_blank");
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

  return (
    <div className="quicklinks-container" ref={containerRef}>
      <div
        className="quicklinks-header widget-header"
        role="button"
        tabIndex={0}
        onClick={() => {
          if (isDragging) return;
          if (anchorEl) setAnchorEl(null);
          else if (headerRef.current) setAnchorEl(headerRef.current);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (anchorEl) setAnchorEl(null);
            else if (headerRef.current) setAnchorEl(headerRef.current);
          }
        }}
        aria-expanded={Boolean(anchorEl)}
        ref={headerRef}
      >
        <span className="quicklinks-title">Links</span>
      </div>

      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        modifiers={
          [
            {
              name: "preventOverflow",
              options: { boundary: "viewport", padding: 8 },
            },
            { name: "flip", options: { fallbackPlacements: ["top"] } },
          ] as any
        }
      >
        <div
          className="quicklinks-dropdown"
          role="dialog"
          aria-modal={false}
          ref={popperRef}
        >
          <div className="quicklinks-add">
            <input
              className="quicklinks-input quicklinks-input-title"
              placeholder="label (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              ref={urlInputRef}
              className="quicklinks-input quicklinks-input-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addLink();
              }}
            />
            <button className="quicklinks-add-btn" onClick={addLink}>
              Add
            </button>
          </div>

          <ul className="quicklinks-list">
            {quickLinks.length === 0 ? (
              <li className="quicklinks-empty">No quick links saved</li>
            ) : (
              quickLinks.map((l, index) => {
                const favicon = getFavicon(l.url);
                return (
                  <li
                    key={l.id}
                    className={`quicklinks-item ${
                      draggedIndex === index ? "dragging" : ""
                    } ${dragOverIndex === index ? "drag-over" : ""}`}
                    draggable
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDrop={() => {
                      if (draggedIndex === null) return;
                      const updated = [...quickLinks];
                      const [removed] = updated.splice(draggedIndex, 1);
                      updated.splice(index, 0, removed);
                      updateQuickLinks(updated);
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                  >
                    {favicon ? (
                      <div
                        className="ql-favicon"
                        style={{ backgroundImage: `url(${favicon})` }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <button
                      className="quicklinks-link"
                      onClick={() => goTo(l)}
                      title={l.url}
                    >
                      <span className="ql-title">{l.title}</span>
                      <span className="ql-url">{l.url}</span>
                    </button>
                    <button
                      className="quicklinks-delete"
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
      </Popper>
    </div>
  );
};

export default QuickLinks;
