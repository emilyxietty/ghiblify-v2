/**
 * Optional Chrome permissions.
 *
 * `bookmarks` and `audioCapture` are declared under
 * `optional_permissions` in the manifest rather than `permissions`, so a
 * fresh install asks for neither.
 *
 * `geolocation` is deliberately ABSENT from the manifest entirely.
 * Chrome refuses to make it optional (it's on the documented
 * cannot-be-optional list), and it carried the scary "detect your
 * physical location" install warning - so the Weather widget now
 * resolves approximate location from the IP via BigDataCloud's
 * keyless client endpoint (a host we already hold), gated by the
 * `weather.useDeviceLocation` app setting. No permission involved.
 * The optional grants below are requested from the Settings modal
 * (or the in-place prompt on the feature that needs one) and can be
 * revoked again at any time.
 *
 * Two consequences worth knowing:
 *   - `chrome.permissions.request()` only works while a user gesture is
 *     on the stack, so every call site is a click handler.
 *   - Grants survive across tabs but not across reinstalls. Chrome fires
 *     onAdded / onRemoved in *every* extension page, so the hook below
 *     keeps a new tab in sync when the toggle is flipped in another one.
 */

import { useCallback, useEffect, useState } from "react";

export type OptionalPermission =
  | "bookmarks"
  // Voice search. An extension page never gets the browser's mic
  // prompt - getUserMedia is denied outright unless the extension holds
  // `audioCapture` - so this grant is the only route to the microphone.
  | "audioCapture";

/* eslint-disable @typescript-eslint/no-explicit-any */
const permissionsApi = (): any => {
  const ns: any = typeof chrome !== "undefined" ? chrome : undefined;
  return ns?.permissions;
};

/** Promise wrapper - the API is promise-based in MV3 but falls back to
 *  the callback form on older builds. */
const call = <T,>(
  method: "contains" | "request" | "remove",
  value: T
): Promise<boolean> => {
  const api = permissionsApi();
  if (!api?.[method]) return Promise.resolve(false);
  try {
    const result = api[method](value);
    if (result && typeof result.then === "function") {
      return (result as Promise<boolean>).catch((err: unknown) => {
        // Worth seeing: the usual cause is "This function must be called
        // during a user gesture", which is invisible otherwise - the
        // toggle just doesn't move.
        // eslint-disable-next-line no-console
        console.debug(`[permissions] ${method} failed`, value, err);
        return false;
      });
    }
    return new Promise<boolean>((resolve) => {
      api[method](value, (granted: boolean) => {
        const ns: any = typeof chrome !== "undefined" ? chrome : undefined;
        if (ns?.runtime?.lastError) {
          // eslint-disable-next-line no-console
          console.debug(
            `[permissions] ${method} failed`,
            value,
            ns.runtime.lastError.message
          );
        }
        resolve(!!granted);
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug(`[permissions] ${method} threw`, value, err);
    return Promise.resolve(false);
  }
};

/** False outside an extension page (plain `vite preview`, tests). Callers
 *  that gate a feature on a grant should treat "no API" as "don't gate" - *
 * there's nothing to grant and nothing to prompt with. */
export const permissionsApiAvailable = (): boolean =>
  !!permissionsApi()?.contains;

export const hasPermission = (name: OptionalPermission): Promise<boolean> =>
  call("contains", { permissions: [name] });

export const requestPermission = (name: OptionalPermission): Promise<boolean> =>
  call("request", { permissions: [name] });

export const removePermission = (name: OptionalPermission): Promise<boolean> =>
  call("remove", { permissions: [name] });

/**
 * Track one optional permission.
 *
 * `granted` is null until the first `contains()` resolves, so callers can
 * tell "not yet known" from "known to be missing" and avoid flashing a
 * permission prompt on every mount.
 */
export const useOptionalPermission = (name: OptionalPermission) => {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      hasPermission(name).then((v) => {
        if (!cancelled) setGranted(v);
      });
    };
    sync();

    // Another tab (or the Chrome UI itself) can add/remove the grant.
    const api = permissionsApi();
    api?.onAdded?.addListener(sync);
    api?.onRemoved?.addListener(sync);
    return () => {
      cancelled = true;
      api?.onAdded?.removeListener(sync);
      api?.onRemoved?.removeListener(sync);
    };
  }, [name]);

  const request = useCallback(async () => {
    const ok = await requestPermission(name);
    setGranted(ok);
    return ok;
  }, [name]);

  const revoke = useCallback(async () => {
    const removed = await removePermission(name);
    if (removed) setGranted(false);
    return removed;
  }, [name]);

  return { granted, request, revoke };
};
