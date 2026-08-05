import { createRoot } from "react-dom/client";
import App from "./App";
import { cleanLegacyStorage } from "./storage/legacyMigrations";
import {
  restoreMirrorFromChrome,
  runOneTimeSetup,
} from "./storage/hybridStorage";

// Mirror recovery FIRST: if the user cleared browsing data, the
// localStorage mirror is gone while chrome.storage still holds their
// real settings — booting from the empty mirror and then persisting
// anything would overwrite that data with defaults (the "my quick
// links reset themselves" bug). Restore the mirror, then reload once
// so the synchronous init path re-runs against recovered data. The
// sessionStorage guard makes the reload strictly once-per-tab, so a
// genuinely fresh install can never reload-loop. React mounts
// immediately regardless — the restore resolves in milliseconds and
// only triggers the reload in the rare wiped-mirror case.
const REHYDRATE_GUARD = "ghiblify_rehydrated_this_tab";
restoreMirrorFromChrome()
  .then((restored) => {
    let guarded = false;
    try {
      guarded = sessionStorage.getItem(REHYDRATE_GUARD) === "1";
      if (restored && !guarded) sessionStorage.setItem(REHYDRATE_GUARD, "1");
    } catch {
      guarded = true; // no sessionStorage — don't risk a loop
    }
    if (restored && !guarded) {
      window.location.reload();
      return;
    }
    // Single combined gate for all one-time install work — drains v1
    // (jQuery) Ghiblify storage entries AND copies pre-hybrid
    // localStorage values into chrome.storage. Idempotent. Run AFTER
    // the restore so a wiped-mirror boot can't migrate emptiness.
    runOneTimeSetup(cleanLegacyStorage);
  })
  .catch(() => {
    runOneTimeSetup(cleanLegacyStorage);
  });

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
