/**
 * Local search history.
 *
 * Chrome's own omnibox mixes remote suggestions with what you've
 * searched before; reading the *browser's* history would need the
 * `history` permission, which is far too broad for a dropdown. So the
 * widget keeps its own list of what was searched from this new tab —
 * nothing leaves the machine, and it works offline, which the remote
 * suggestions don't.
 */

const KEY = "ghiblify_search_history";
const MAX_ENTRIES = 25;

export const readSearchHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
};

/** Most recent first, de-duplicated case-insensitively. */
export const pushSearchHistory = (query: string): string[] => {
  const q = query.trim();
  if (!q) return readSearchHistory();
  const lower = q.toLowerCase();
  const next = [
    q,
    ...readSearchHistory().filter((v) => v.toLowerCase() !== lower),
  ].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
};

export const removeSearchHistoryEntry = (query: string): string[] => {
  const next = readSearchHistory().filter((v) => v !== query);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
};

/** Entries starting with what's typed. An empty query returns the most
 *  recent few, which is what a freshly focused, empty field shows. */
export const matchHistory = (
  history: string[],
  query: string,
  limit = 4
): string[] => {
  const q = query.trim().toLowerCase();
  if (!q) return history.slice(0, limit);
  return history
    .filter((v) => v.toLowerCase().startsWith(q) && v.toLowerCase() !== q)
    .slice(0, limit);
};
