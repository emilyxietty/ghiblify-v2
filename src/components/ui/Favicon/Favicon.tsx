import React, { useEffect, useState } from "react";
import {
  faviconCacheUrl,
  isFaviconCacheUrl,
  isPlaceholderFavicon,
} from "../../../utils/faviconCache";

const normalizeUrl = (raw: string): string => {
  const t = raw.trim();
  if (!t) return t;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(t)) return t;
  return `https://${t}`;
};

/**
 * Every source worth trying for one link's icon, best first.
 *
 * Chrome's `_favicon` cache is keyed by the *exact* URL, and it only has
 * pages the user has actually visited. That's why "tiktok.com" comes up
 * blank while "www.tiktok.com" works - they're two different keys, and
 * only the one Chrome has seen is in the cache. So: try what was typed,
 * then the same host with (or without) `www.`, then a remote lookup by
 * hostname, which needs no local history at all.
 */
export const faviconCandidates = (rawUrl: string, size = 64): string[] => {
  const full = normalizeUrl(rawUrl);
  if (!full) return [];
  const out: string[] = [];
  const push = (v: string | null) => {
    if (v && !out.includes(v)) out.push(v);
  };

  push(faviconCacheUrl(full, size));

  let host = "";
  try {
    const parsed = new URL(full);
    host = parsed.hostname;
    const swapped = host.startsWith("www.")
      ? host.slice(4)
      : `www.${host}`;
    push(faviconCacheUrl(`${parsed.protocol}//${swapped}/`, size));
    // Origin-only, in case the cache holds the site's home page but not
    // the deep link that was pasted.
    push(faviconCacheUrl(`${parsed.origin}/`, size));
  } catch {
    /* unparseable - the chrome entry above is all we have */
  }

  if (host) {
    push(
      `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(
        host
      )}`
    );
  }
  return out;
};

interface FaviconProps {
  url: string;
  size?: number;
  className?: string;
  /** Rendered when every source fails - usually the site's initial. */
  fallback?: React.ReactNode;
  fallbackClassName?: string;
}

/**
 * A link's icon, with fallbacks.
 *
 * Walks `faviconCandidates` on each error rather than picking one source
 * up front: whether Chrome's cache has a given URL isn't knowable until
 * the request comes back.
 */
export const Favicon: React.FC<FaviconProps> = ({
  url,
  size = 64,
  className,
  fallback,
  fallbackClassName,
}) => {
  const candidates = faviconCandidates(url, size);
  const [idx, setIdx] = useState(0);
  // The candidate that loaded and is not the browser's generic globe.
  const [shown, setShown] = useState(-1);

  // A new URL restarts the chain - otherwise an exhausted index from the
  // previous link would render this one as the fallback forever.
  useEffect(() => {
    setIdx(0);
    setShown(-1);
  }, [url]);

  const next = (from: number) => setIdx((i) => (i === from ? i + 1 : i));

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const at = idx;
    if (!isFaviconCacheUrl(candidates[at])) {
      setShown(at);
      return;
    }
    const img = e.currentTarget;
    void isPlaceholderFavicon(img, size).then((placeholder) =>
      placeholder ? next(at) : setShown(at),
    );
  };

  if (idx >= candidates.length) {
    return (
      <div className={fallbackClassName ?? className} aria-hidden="true">
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={candidates[idx]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={shown === idx ? undefined : { visibility: "hidden" }}
      onLoad={onLoad}
      onError={() => next(idx)}
    />
  );
};

export default Favicon;
