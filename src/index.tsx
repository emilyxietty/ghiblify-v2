import { createRoot } from "react-dom/client";
// Stylesheet only, imported statically on purpose. App itself is
// loaded dynamically below so its synchronous storage initializers
// can't run before the recovery completes - but that also moved every
// stylesheet out of <head> and behind those awaits, so the page spent
// the wait with no app CSS and then repainted all at once. CSS has no
// storage side effects, so pulling this one out front costs nothing
// and puts a <link> back in <head> at parse time.
import "./App.css";
import { cleanLegacyStorage } from "./storage/legacyMigrations";
import {
  restoreMirrorFromChrome,
  runOneTimeSetup,
} from "./storage/hybridStorage";

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

  // Import App only after storage is ready. App's dependency graph has
  // synchronous storage initializers, so a static import would let them
  // run before the awaited recovery above and reintroduce the data-loss race.
  const { default: App } = await import("./App");
  const container = document.getElementById("root");
  if (!container) return;
  createRoot(container).render(<App />);
};

void bootstrap();
