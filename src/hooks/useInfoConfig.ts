import { useEffect, useState } from "react";

interface InfoItem {
  title: string;
  size: "small" | "medium" | "large";
}

type InfoConfig = InfoItem[];

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

export const useInfoConfig = (filmTitle?: string) => {
  const [movieData, setMovieData] = useState<MovieMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filmTitle) {
      setLoading(false);
      return;
    }

    const loadMovieData = async () => {
      try {
        // Fetch movie metadata from local file
        const metadataResponse = await fetch(
          chrome.runtime.getURL("movie_metadata.json")
        );

        if (!metadataResponse.ok) {
          throw new Error(`HTTP error! status: ${metadataResponse.status}`);
        }

        const metadataData: MovieMetadataData = await metadataResponse.json();

        // Find the film by title (case-insensitive)
        const filmKey = Object.keys(metadataData).find(
          (key) => key.toLowerCase() === filmTitle.toLowerCase()
        );

        if (filmKey) {
          const metadata = metadataData[filmKey];
          // Pick a random quote
          const randomQuote =
            metadata.quotes[Math.floor(Math.random() * metadata.quotes.length)];
          setMovieData({ ...metadata, quotes: [randomQuote] });
        } else {
          console.warn(`No metadata found for film: ${filmTitle}`);
          setMovieData(null);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading movie data:", error);
        setLoading(false);
      }
    };

    loadMovieData();
  }, [filmTitle]);

  return {
    titlejp: movieData?.titlejp || "",
    title: movieData?.title || "",
    year: movieData?.year || "",
    screentime: movieData?.screentime || "",
    quote: movieData?.quotes?.[0] || "",
    loading,
  };
};
