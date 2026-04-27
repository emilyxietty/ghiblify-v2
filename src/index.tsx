import { createRoot } from "react-dom/client";
import App from "./App";
import { cleanLegacyStorage } from "./storage/legacyMigrations";
import { runOneTimeSetup } from "./storage/hybridStorage";

// Single combined gate for all one-time install work — drains v1
// (jQuery) Ghiblify storage entries AND copies pre-hybrid
// localStorage values into chrome.storage. Idempotent and
// fire-and-forget; the localStorage mirror already holds anything
// the app needs, so we don't await before mounting React.
runOneTimeSetup(cleanLegacyStorage);

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
