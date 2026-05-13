import React, { useState } from "react";
import { Button } from "../../../components/Button/Button";
import TextInput from "../../../components/TextInput/TextInput";
import { useAppContext } from "../../../contexts/AppContext";
import { useT } from "../../../i18n/i18n";
import { SearchIcon } from "../../../components/Icons/Icons";
import { useScaledPx } from "../../../utils/viewportScale";
import "./SearchBar.css";

const SearchBar: React.FC = () => {
  const t = useT();
  const { widgets } = useAppContext();
  const searchbarSettings = widgets.searchbar.settings;
  const [query, setQuery] = useState("");
  // settings.width/height are reference-px (1920 baseline).
  const width = useScaledPx(searchbarSettings.width);
  const height = useScaledPx(searchbarSettings.height);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    // Use chrome.search.query() so the search routes through the user's
    // selected default search engine (Chrome Web Store policy: a new-tab
    // extension's search must respect the user's choice, not hardcode a
    // provider). Falls back to a direct Google URL only if the API
    // isn't available (e.g. running outside the extension context).
    const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
    if (chromeNs?.search?.query) {
      try {
        chromeNs.search.query({ text: q, disposition: "CURRENT_TAB" });
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[SearchBar] chrome.search.query failed, falling back",
          err
        );
      }
    }
    return;
  };

  return (
    <div
      style={{
        width,
        height,
        ["--sb-opacity" as any]:
          ((searchbarSettings as any).opacity ?? 50) / 100,
        ["--input-opacity" as any]:
          ((searchbarSettings as any).opacity ?? 50) / 100,
      }}
      className="widget-header"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="searchbar"
        role="search"
      >
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchbar.placeholder")}
          aria-label={t("searchbar.ariaLabelInput")}
        />
        <Button
          type="submit"
          size="small"
          variant="dark"
          disabled={!query.trim()}
          className="searchbar-search-btn"
          style={{ height }}
          aria-label={t("searchbar.ariaLabelButton")}
          data-tooltip={t("searchbar.tooltipButton")}
        >
          <SearchIcon />
        </Button>
      </form>
    </div>
  );
};

export default SearchBar;
