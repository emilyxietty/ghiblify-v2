import SearchIcon from "@mui/icons-material/Search";
import React, { useState } from "react";
import { Button } from "../../../components/Button/Button";
import { useAppContext } from "../../../contexts/AppContext";
import "./SearchBar.css";
import TextInput from "../../../components/TextInput/TextInput";

const SearchBar: React.FC = () => {
  const { searchbarSettings } = useAppContext();
  const [query, setQuery] = useState("");
  const width = searchbarSettings.width;
  const height = searchbarSettings.height;

  const isDark = !!searchbarSettings.darkMode;
  const darkClass = isDark ? "dark" : "";
  return (
    <div style={{ width, height }} className="widget-header">
      <form
        onSubmit={(e) => e.preventDefault()}
        className={`searchbar ${darkClass}`}
      >
        <TextInput
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Google..."
        //   className={`searchbar-input ${darkClass}`}
          mode={isDark ? "dark" : "light"}
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
            variant={isDark ? "dark" : "light"}
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
