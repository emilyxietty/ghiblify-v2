import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import {
  CenterFocusStrongIcon,
  CloseIcon,
  MicIcon,
  RestoreIcon,
  SearchIcon,
} from "../../../components/Icons/Icons";
import {
  matchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistoryEntry,
} from "../../../utils/searchHistory";
import { fetchSuggestions, splitSuggestion } from "../../../utils/searchSuggest";
import { requestPermission } from "../../../utils/chromePermissions";
import { useScaledPx } from "../../../utils/viewportScale";
import "./SearchBar.css";

const SUGGEST_DEBOUNCE_MS = 120;

/** Reference-px floor for the pill - matches the `height` bound in
 *  widgetConfig, and overrides shorter values stored by older builds.
 *  CSS applies a second, absolute floor in real px (see
 *  `.searchbar`), because reference px shrink on smaller viewports. */
const MIN_PILL_HEIGHT = 56;

/* eslint-disable @typescript-eslint/no-explicit-any */
const chromeNs = (): any => (typeof chrome !== "undefined" ? chrome : undefined);

/** Chrome exposes the Web Speech API under a vendor prefix. */
const SpeechRecognitionCtor = (): any =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const SearchBar: React.FC = () => {
  const t = useT();
  const { widgets } = useAppContext();
  const searchbarSettings = widgets.searchbar.settings;
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());
  // -1 = nothing highlighted, so Enter submits what's typed.
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lensFormRef = useRef<HTMLFormElement | null>(null);
  const lensInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // settings.width/height are reference-px (1920 baseline). Height is
  // clamped up to MIN_PILL_HEIGHT before scaling: users carry a stored
  // height from when this widget was a thin input, and at 40px the
  // pill's icon buttons touch its edges.
  const width = useScaledPx(searchbarSettings.width);
  const height = useScaledPx(
    Math.max(searchbarSettings.height, MIN_PILL_HEIGHT)
  );

  const submit = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setHistory(pushSearchHistory(q));
    setSuggestions([]);
    setActiveIdx(-1);
    // chrome.search.query() routes through the user's chosen default
    // search engine. Chrome Web Store policy for a new-tab extension
    // requires respecting that choice rather than hardcoding a provider
    // - which is why suggestions coming from Google (below) never
    // decide where the search actually goes.
    const ns = chromeNs();
    if (ns?.search?.query) {
      try {
        ns.search.query({ text: q, disposition: "CURRENT_TAB" });
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[SearchBar] chrome.search.query failed", err);
      }
    }
  };

  // Debounced suggestions. Aborting matters more than the debounce: a
  // slower early response can otherwise land after a later one and
  // repopulate the list with stale completions.
  useEffect(() => {
    const q = query.trim();
    if (!q || !focused) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const list = await fetchSuggestions(q, controller.signal);
        setSuggestions(list.slice(0, 8));
        setActiveIdx(-1);
      } catch (err) {
        // Offline, or the host permission for suggestqueries.google.com
        // isn't active yet (the extension has to be reloaded after a
        // manifest change). Local history below still populates the
        // dropdown, so the failure is quiet - but logged, because
        // "no suggestions" is otherwise indistinguishable from
        // "the endpoint returned nothing".
        if ((err as Error)?.name !== "AbortError") {
          // eslint-disable-next-line no-console
          console.debug("[SearchBar] suggestions unavailable:", err);
        }
        setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, focused]);

  // Stop the mic if the widget goes away mid-listen.
  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    },
    []
  );

  const startVoiceSearch = async () => {
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }
    // Two gates, in order. First `audioCapture`: an extension page is
    // never shown the browser's mic prompt, so without that grant
    // getUserMedia is denied outright. Requesting it here keeps the
    // user gesture on the stack, which chrome.permissions.request
    // requires. Then getUserMedia itself, which is what actually opens
    // the device - speech recognition won't start otherwise.
    const granted = await requestPermission("audioCapture");
    if (!granted) {
      // Visible feedback instead of a silent no-op: flash the mic as
      // denied for a beat. Clicking again re-prompts - the permission
      // request always rides the click gesture.
      setMicDenied(true);
      window.setTimeout(() => setMicDenied(false), 1600);
      return;
    }
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({
        audio: true,
      });
      stream?.getTracks().forEach((track) => track.stop());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("[SearchBar] microphone unavailable:", err);
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        setQuery(transcript);
        // Google fires the search as soon as the phrase is final.
        if (event.results[event.results.length - 1].isFinal) {
          recognition.stop();
          submit(transcript);
        }
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      inputRef.current?.focus();
    } catch {
      setListening(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rowCount === 0) return;
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      // Wraps through -1 so arrowing past either end returns to what
      // the user actually typed, like the omnibox.
      const next = activeIdx + delta;
      setActiveIdx(next < -1 ? rowCount - 1 : next >= rowCount ? -1 : next);
      return;
    }
    if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIdx(-1);
      return;
    }
    if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      submit(rows[activeIdx]?.value);
    }
  };

  // History first, then remote completions with any duplicate of a
  // history row dropped. An empty but focused field shows recent
  // searches on their own - same as the omnibox.
  const historyRows = matchHistory(history, query);
  const rows: Array<{ kind: "history" | "suggest"; value: string }> = [
    ...historyRows.map((value) => ({ kind: "history" as const, value })),
    ...suggestions
      .filter(
        (sug) =>
          !historyRows.some((h) => h.toLowerCase() === sug.toLowerCase())
      )
      .map((value) => ({ kind: "suggest" as const, value })),
  ].slice(0, 10);

  const rowCount = rows.length;
  const showSuggestions = focused && rowCount > 0;
  const displayValue = activeIdx >= 0 ? rows[activeIdx]?.value ?? query : query;

  return (
    <div
      style={{
        width,
        ["--sb-opacity" as any]:
          ((searchbarSettings as any).opacity ?? 50) / 100,
        ["--input-opacity" as any]:
          ((searchbarSettings as any).opacity ?? 50) / 100,
      }}
      className="widget-header searchbar-widget"
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit(displayValue);
        }}
        className={`searchbar${showSuggestions ? " has-suggestions" : ""}`}
        role="search"
        // Passed as a var rather than as `minHeight` so the stylesheet
        // can floor it - an inline min-height would win outright and a
        // scaled-down value could leave the pill squashed.
        style={{ ["--sb-min-height" as any]: `${height}px` }}
      >
        <SearchIcon className="searchbar-leading-icon" />

        <input
          ref={inputRef}
          type="text"
          className="searchbar-input"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(-1);
          }}
          onFocus={() => setFocused(true)}
          // Delayed so a click on a suggestion row lands before the
          // list unmounts underneath the pointer.
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={t("searchbar.placeholder")}
          aria-label={t("searchbar.ariaLabelInput")}
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          role="combobox"
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            type="button"
            className="searchbar-icon-btn searchbar-clear"
            aria-label={t("searchbar.clearAria")}
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setActiveIdx(-1);
              inputRef.current?.focus();
            }}
          >
            <CloseIcon style={{ fontSize: 20 }} />
          </button>
        )}

        {/* The trailing controls travel as one cluster with a tighter
            gap of their own - with everything on the form's gap, the
            divider added its spacing on both sides and the clear button
            drifted away from the rest. */}
        <span className="searchbar-actions">
        <span className="searchbar-divider" aria-hidden="true" />

        {SpeechRecognitionCtor() && (
          <button
            type="button"
            className={`searchbar-icon-btn searchbar-mic${
              listening ? " is-listening" : ""
            }${micDenied ? " is-denied" : ""}`}
            aria-label={t("searchbar.voiceAria")}
            data-tooltip={
              micDenied
                ? t("searchbar.voiceDenied")
                : t("searchbar.voiceTooltip")
            }
            onClick={() => void startVoiceSearch()}
          >
            <MicIcon style={{ fontSize: 20 }} />
          </button>
        )}

        <button
          type="button"
          className="searchbar-icon-btn searchbar-lens"
          aria-label={t("searchbar.imageAria")}
          data-tooltip={t("searchbar.imageTooltip")}
          onClick={() => lensInputRef.current?.click()}
        >
          <CenterFocusStrongIcon style={{ fontSize: 20 }} />
        </button>

        {/* Go button - only once there's something to search for. It's
            redundant with Enter, but a visible target is what people
            reach for with the mouse, and it appearing as you type is
            its own hint that the field is live. */}
        {displayValue.trim() && (
          <button
            type="submit"
            className="searchbar-go"
            aria-label={t("searchbar.ariaLabelButton")}
            data-tooltip={t("searchbar.tooltipButton")}
          >
            <SearchIcon style={{ fontSize: 20 }} />
          </button>
        )}
        </span>

        {showSuggestions && (
          <ul className="searchbar-suggestions" role="listbox">
            {rows.map((row, i) => {
              const { matched, rest } = splitSuggestion(row.value, query);
              return (
                <li key={`${row.kind}:${row.value}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    className={`searchbar-suggestion${
                      i === activeIdx ? " is-active" : ""
                    }${row.kind === "history" ? " is-history" : ""}`}
                    onMouseEnter={() => setActiveIdx(i)}
                    // mousedown, not click: the input's blur would
                    // otherwise tear the list down first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      submit(row.value);
                    }}
                  >
                    {row.kind === "history" ? (
                      <RestoreIcon
                        className="searchbar-suggestion-icon"
                        style={{ fontSize: 16 }}
                      />
                    ) : (
                      <SearchIcon
                        className="searchbar-suggestion-icon"
                        style={{ fontSize: 16 }}
                      />
                    )}
                    <span className="searchbar-suggestion-text">
                      {matched}
                      <b>{rest}</b>
                    </span>
                    {row.kind === "history" && (
                      <span
                        className="searchbar-suggestion-remove"
                        role="button"
                        aria-label={t("searchbar.removeHistoryAria", {
                          query: row.value,
                        })}
                        onMouseDown={(e) => {
                          // Stops the row's own mousedown from firing
                          // the search we're trying to forget.
                          e.preventDefault();
                          e.stopPropagation();
                          setHistory(removeSearchHistoryEntry(row.value));
                        }}
                      >
                        <CloseIcon style={{ fontSize: 14 }} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      {/* Search-by-image. The picked file is submitted straight to
          Google Lens as a normal multipart form post in a new tab - the file never passes through this extension, and there's no
          upload endpoint of our own to keep. */}
      <form
        ref={lensFormRef}
        action="https://lens.google.com/upload"
        method="POST"
        encType="multipart/form-data"
        target="_blank"
        rel="noreferrer"
        hidden
      >
        <input
          ref={lensInputRef}
          type="file"
          name="encoded_image"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.length) lensFormRef.current?.submit();
          }}
        />
      </form>
    </div>
  );
};

export default SearchBar;
