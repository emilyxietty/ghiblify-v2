// Web-demo entry point. Mirrors src/index.tsx, with the chrome shim
// installed first - hybridStorage and i18n capture `chrome` and read
// the storage mirror at module scope, so the shim has to win the race
// against their module bodies.
import "./chromeShim";

import { createRoot } from "react-dom/client";
import "../App.css";
import { cleanLegacyStorage } from "../storage/legacyMigrations";
import {
  restoreMirrorFromChrome,
  runOneTimeSetup,
} from "../storage/hybridStorage";

const bootstrap = async () => {
  try {
    await runOneTimeSetup(cleanLegacyStorage);
  } catch {
    /* the mirror remains usable */
  }
  try {
    await restoreMirrorFromChrome();
  } catch {
    /* boot from the mirror */
  }

  const { default: App } = await import("../App");
  const container = document.getElementById("root");
  if (!container) return;
  createRoot(container).render(<App />);
};

void bootstrap();
