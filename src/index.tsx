import { createRoot } from "react-dom/client";
import App from "./App";
import { cleanLegacyStorage } from "./storage/legacyMigrations";
import { migrateOnce } from "./storage/hybridStorage";

// One-shot cleanup of v1 (jQuery) Ghiblify storage entries that the
// new app no longer reads. Gated by a flag so it runs exactly once
// per install. Migrations for the data we DO carry over (todos +
// quick links) run separately and clear their own keys.
cleanLegacyStorage();

// One-shot copy of pre-hybrid localStorage values into chrome.storage
// so existing users' data flows into the new source-of-truth and
// `chrome.storage.sync` starts replicating their preferences across
// devices. Idempotent — gated by its own flag. Fire-and-forget
// because the localStorage mirror already has the data; chrome.storage
// just becomes the canonical home in the background.
migrateOnce();

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
