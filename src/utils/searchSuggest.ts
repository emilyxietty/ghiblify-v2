/**
 * Autocomplete suggestions.
 *
 * Google's suggest endpoint is the same one Chrome's own omnibox uses.
 * It sends no CORS headers, so this only works from an extension page
 * with `https://suggestqueries.google.com/*` in host_permissions - * which
 * is why there's no graceful web fallback here: outside the
 * extension the fetch simply fails and the caller shows no dropdown.
 *
 * Note what this does *not* do: it doesn't decide where the search
 * goes. Submitting still routes through `chrome.search.query`, i.e. the
 * user's chosen default engine. Suggestions come from Google because
 * Chrome exposes no API for the current engine's suggest endpoint.
 */

const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";

export const fetchSuggestions = async (
  query: string,
  signal?: AbortSignal
): Promise<string[]> => {
  const q = query.trim();
  if (!q) return [];
  const url = new URL(SUGGEST_URL);
  // `client=chrome` returns plain JSON; the default (`toolbar`) returns
  // XML, and `firefox` is undocumented enough to be worth avoiding.
  url.searchParams.set("client", "chrome");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Suggest HTTP ${res.status}`);
  const json = await res.json();
  // Shape: [query, [suggestions], [descriptions], [], {metadata}]
  const list = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  return list.filter((s: unknown): s is string => typeof s === "string");
};

/**
 * Split a suggestion around the text already typed.
 *
 * Google renders the part you typed in normal weight and the completion
 * in bold; returning the pieces lets the row do that without dangerously
 * setting inner HTML from a remote response.
 */
export const splitSuggestion = (
  suggestion: string,
  typed: string
): { matched: string; rest: string } => {
  const t = typed.trim().toLowerCase();
  if (t && suggestion.toLowerCase().startsWith(t)) {
    return { matched: suggestion.slice(0, t.length), rest: suggestion.slice(t.length) };
  }
  return { matched: "", rest: suggestion };
};
