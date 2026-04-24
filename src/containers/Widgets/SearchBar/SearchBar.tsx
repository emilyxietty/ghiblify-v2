import SearchIcon from "@mui/icons-material/Search";
import React, { useState } from "react";
import { Button } from "../../../components/Button/Button";
import { useAppContext } from "../../../contexts/AppContext";
import "./SearchBar.css";
import TextInput from "../../../components/TextInput/TextInput";

const SearchBar: React.FC = () => {
  const { widgets } = useAppContext();
  const searchbarSettings = widgets.searchbar.settings;
  const [query, setQuery] = useState("");
  const width = searchbarSettings.width;
  const height = searchbarSettings.height;

  const isDark = !!searchbarSettings.darkMode;
  const darkClass = isDark ? "dark" : "";

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  };

  return (
    <div style={{ width, height }} className="widget-header">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`searchbar ${darkClass}`}
        role="search"
      >
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Google..."
          mode={isDark ? "dark" : "light"}
          aria-label="Search Google"
        />
        <Button
          type="submit"
          size="small"
          variant={isDark ? "dark" : "light"}
          disabled={!query.trim()}
          className={`searchbar-search-btn ${darkClass}`}
          style={{ height }}
          aria-label="Search Google"
          data-tooltip="Search Google"
        >
          <SearchIcon />
        </Button>
      </form>
    </div>
  );
};

export default SearchBar;
