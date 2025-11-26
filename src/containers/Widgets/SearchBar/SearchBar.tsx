import SearchIcon from "@mui/icons-material/Search";
import React, { useState } from "react";
import { Button } from "../../../components/Button/Button";
import { useAppContext } from "../../../contexts/AppContext";
import "./SearchBar.css";

const SearchBar: React.FC = () => {
  const { searchbarSettings } = useAppContext();
  const [query, setQuery] = useState("");
  const width = searchbarSettings?.width || 300;
  const height = searchbarSettings?.height || 32;

  const darkClass = searchbarSettings.darkMode ? "dark" : "";
  return (
    <div style={{ width, height }} className="widget-header">
      <form
        onSubmit={(e) => e.preventDefault()}
        className={`searchbar ${darkClass}`}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Google..."
          className={`searchbar-input ${darkClass}`}
        />
        <a
          href={
            query.trim()
              ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
              : undefined
          }
          style={{ height }}
          className={`searchbar-search-link ${darkClass}`}
        >
          <Button
            type="button"
            size="small"
            variant={darkClass ? "dark" : "light"}
            disabled={!query.trim()}
            className={`searchbar-search-btn ${darkClass}`}
            style={{ height }}
          >
            <SearchIcon />
          </Button>
        </a>
      </form>
    </div>
  );
};

export default SearchBar;
