import { createRoot } from "react-dom/client";
import App from "./App";
import { cleanLegacyStorage } from "./storage/legacyMigrations";

// One-shot cleanup of v1 (jQuery) Ghiblify storage entries that the
// new app no longer reads. Gated by a localStorage flag so it runs
// exactly once per profile. Migrations for the data we DO carry over
// (todos + quick links) run separately and clear their own keys.
cleanLegacyStorage();

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
