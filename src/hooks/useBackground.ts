import { useEffect, useState } from "react";

interface BackgroundItem {
  link: string;
  title: string;
  titlejp: string;
  year: string;
  screentime: string;
  quote: string;
}

interface BackgroundSource {
  title: string;
  links: string[];
}

interface BackgroundData {
  default: {
    link: string;
    source: string;
  };
  sources: BackgroundSource[];
}

interface MovieMetadata {
  title: string;
  titlejp: string;
  year: string;
  screentime: string;
  quotes: string[];
}

interface MovieMetadataData {
  [key: string]: MovieMetadata;
}

export const useBackground = () => {
  const [currentBackground, setCurrentBackground] = useState<string>("");
  const [filmTitle, setFilmTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBackground = async () => {
      try {
        const [bgResponse, metadataResponse] = await Promise.all([
          fetch(chrome.runtime.getURL("background_en.json")),
          fetch(chrome.runtime.getURL("movie_metadata.json")),
        ]);

        const bgData: BackgroundData = await bgResponse.json();
        const metadataData: MovieMetadataData = await metadataResponse.json();

        // Collect all links with their source titles
        const allLinks: { link: string; sourceTitle: string }[] = [];

        bgData.sources.forEach((source) => {
          source.links.forEach((link) => {
            allLinks.push({ link, sourceTitle: source.title });
          });
        });

        // Pick a random link
        const randomIndex = Math.floor(Math.random() * allLinks.length);
        const selected = allLinks[randomIndex];

        // Get metadata for this source
        const metadata = metadataData[selected.sourceTitle];

        if (metadata) {
          setCurrentBackground(selected.link);
          setFilmTitle(metadata.title);
        } else {
          // Fallback to default if metadata not found
          setCurrentBackground(bgData.default.link);
          setFilmTitle(metadataData["spirited away"].title);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading background:", error);
        setLoading(false);
      }
    };

    loadBackground();
  }, []);

  return { currentBackground, filmTitle, loading };
};
