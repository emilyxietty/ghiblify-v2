import React, { useEffect, useRef, useState } from "react";
import { AccountCircleIcon, AppsIcon } from "../../../components/Icons/Icons";
import { useT } from "../../../i18n/i18n";
import { resolveSurfaceFrost } from "../../../config/widgetConfig";
import { useAppContext } from "../../../contexts/AppContext";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
import {
  hasPermission,
  requestPermission,
} from "../../../utils/chromePermissions";
import "./GoogleApps.css";

// Google-corner widget - a recreation of the waffle (apps menu) +
// account button cluster from Google's own new-tab page. The real
// launcher isn't reachable from an extension (no API, and the
// account's personalized app list is Google-internal), so this is a
// curated static grid of the standard Google apps.
//
// Icons: Chrome's local `_favicon` cache only knows sites the user
// has VISITED - never-opened product domains (sheets.google.com…)
// came back as grey globes. Google's public favicon service is the
// primary source (real product icons, no history required); the
// local cache is the offline fallback; a neutral dot is the floor.
//
// Account button: the "80%" avatar - `identity.email` (no OAuth, no
// consent screen) gives the signed-in profile's email, rendered as a
// Google-style letter circle. Signed out / restricted → the classic
// blank-profile silhouette.

// The full modern waffle set. `slug` names the BUNDLED icon under
// /assets/google/<slug>.png (downloaded from Google's favicon service
// at build-authoring time - real product icons, shipped offline).
const GOOGLE_APPS: Array<{ name: string; url: string; slug: string }> = [
  { name: "Account", url: "https://myaccount.google.com", slug: "account" },
  { name: "Search", url: "https://www.google.com", slug: "search" },
  { name: "Maps", url: "https://maps.google.com", slug: "maps" },
  { name: "YouTube", url: "https://www.youtube.com", slug: "youtube" },
  { name: "Play", url: "https://play.google.com", slug: "play" },
  { name: "Gmail", url: "https://mail.google.com", slug: "gmail" },
  { name: "Meet", url: "https://meet.google.com", slug: "meet" },
  { name: "Chat", url: "https://chat.google.com", slug: "chat" },
  { name: "Contacts", url: "https://contacts.google.com", slug: "contacts" },
  { name: "Drive", url: "https://drive.google.com", slug: "drive" },
  { name: "Calendar", url: "https://calendar.google.com", slug: "calendar" },
  { name: "Translate", url: "https://translate.google.com", slug: "translate" },
  { name: "Photos", url: "https://photos.google.com", slug: "photos" },
  { name: "Docs", url: "https://docs.google.com", slug: "docs" },
  { name: "Sheets", url: "https://sheets.google.com", slug: "sheets" },
  { name: "Slides", url: "https://slides.google.com", slug: "slides" },
  { name: "Keep", url: "https://keep.google.com", slug: "keep" },
  { name: "News", url: "https://news.google.com", slug: "news" },
  { name: "Shopping", url: "https://shopping.google.com", slug: "shopping" },
  { name: "Earth", url: "https://earth.google.com", slug: "earth" },
  { name: "Gemini", url: "https://gemini.google.com", slug: "gemini" },
  { name: "Classroom", url: "https://classroom.google.com", slug: "classroom" },
  { name: "One", url: "https://one.google.com", slug: "one" },
  { name: "YT Music", url: "https://music.youtube.com", slug: "ytmusic" },
];

const ACCOUNT_URL = "https://myaccount.google.com";

// Google's letter-avatar palette (approximately) - the email hashes to
// a stable colour so it doesn't reroll every load.
const LETTER_COLORS = [
  "#7cb342",
  "#f06292",
  "#4fc3f7",
  "#ffb74d",
  "#9575cd",
  "#4db6ac",
  "#e57373",
  "#64b5f6",
];

const letterColorFor = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return LETTER_COLORS[Math.abs(hash) % LETTER_COLORS.length];
};

/** Network-first favicon (real product icons), local cache fallback. */
const networkFavicon = (url: string): string => {
  const u = new URL("https://www.google.com/s2/favicons");
  u.searchParams.set("domain_url", url);
  u.searchParams.set("sz", "64");
  return u.toString();
};

const localFavicon = (url: string): string | null => {
  try {
    const ns = typeof chrome !== "undefined" ? chrome : undefined;
    if (!ns?.runtime?.getURL) return null;
    const u = new URL(ns.runtime.getURL("/_favicon/"));
    u.searchParams.set("pageUrl", url);
    u.searchParams.set("size", "64");
    return u.toString();
  } catch {
    return null;
  }
};

const AppTile: React.FC<{ name: string; url: string; slug: string }> = ({
  name,
  url,
  slug,
}) => {
  // Fallback ladder: BUNDLED product icon (correct + offline) →
  // network favicon service → local favicon cache → neutral dot.
  const [stage, setStage] = useState(0);
  const local = localFavicon(url);
  const src =
    stage === 0
      ? `/assets/google/${slug}.png`
      : stage === 1
        ? networkFavicon(url)
        : stage === 2
          ? local
          : null;
  return (
    <a
      className="gapps-tile"
      href={url}
      role="menuitem"
      draggable={false}
    >
      {src ? (
        <img
          className="gapps-tile-icon"
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() =>
            setStage((s) => (s === 1 && !local ? 3 : s + 1))
          }
        />
      ) : (
        <span className="gapps-tile-icon gapps-tile-fallback" />
      )}
      <span className="gapps-tile-name">{name}</span>
    </a>
  );
};

export const GoogleApps: React.FC = () => {
  const t = useT();
  const { settings } = useWidgetSettings("googleApps");
  const { appearance } = useAppContext();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // `identity.email` is an OPTIONAL grant (it carries an install
  // warning, and adding those as required in an update auto-disables
  // the extension for existing users). granted === null means "still
  // checking".
  const [emailGranted, setEmailGranted] = useState<boolean | null>(null);

  const loadEmail = () => {
    try {
      const ns: any = typeof chrome !== "undefined" ? chrome : undefined;
      ns?.identity?.getProfileUserInfo?.(
        { accountStatus: "ANY" },
        (info: { email?: string }) => setEmail(info?.email || null)
      );
    } catch {
      setEmail(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void hasPermission("identity.email").then((granted) => {
      if (cancelled) return;
      setEmailGranted(granted);
      if (granted) loadEmail();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Outside click / Escape closes the grid, like the real waffle.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Surface plumbing, mirroring QuickLinks: the chips write
  // `surfaceColor` as a hex string, but the CSS paints
  // `rgba(var(--dark-rgb), a)`, so it has to be unpacked into a
  // triple here. Frost is drawn on the shell, so the solid fill
  // collapses to a whisper when glass is on rather than stacking two
  // surfaces.
  const gFrosted = resolveSurfaceFrost(settings.frosted, appearance.theme);
  const surfaceStyle: Record<string, string | number> = {
    "--gapps-opacity": gFrosted ? 0.14 : (settings.opacity ?? 75) / 100,
    ...(typeof settings.surfaceColor === "string"
      ? {
          "--dark-rgb": settings.surfaceColor
            .replace("#", "")
            .match(/../g)!
            .map((h) => parseInt(h, 16))
            .join(", "),
        }
      : {}),
  };

  return (
    <div
      ref={rootRef}
      className="gapps-widget widget-header"
      style={surfaceStyle as React.CSSProperties}
    >
      <button
        type="button"
        className={`gapps-btn${open ? " is-open" : ""}`}
        aria-label={t("widgets.gapps.menuAria")}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={t("widgets.gapps.menuAria")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <AppsIcon style={{ fontSize: 20 }} />
      </button>
      <a
        className="gapps-btn gapps-account"
        href={ACCOUNT_URL}
        aria-label={t("widgets.gapps.accountAria")}
        data-tooltip={
          email ||
          (emailGranted === false
            ? t("widgets.gapps.personalize")
            : t("widgets.gapps.accountAria"))
        }
        draggable={false}
        // First click while ungranted personalizes instead of
        // navigating: the click is the user gesture the permission
        // request needs. Granted (or denied) clicks navigate normally.
        onClick={(e) => {
          if (emailGranted !== false) return;
          e.preventDefault();
          void requestPermission("identity.email").then((ok) => {
            setEmailGranted(ok);
            if (ok) loadEmail();
          });
        }}
      >
        {email ? (
          <span
            className="gapps-letter"
            style={{ background: letterColorFor(email) }}
            aria-hidden="true"
          >
            {email[0].toUpperCase()}
          </span>
        ) : (
          <AccountCircleIcon style={{ fontSize: 26 }} />
        )}
      </a>

      {open && (
        <div className="gapps-panel" role="menu">
          <div className="gapps-grid">
            {GOOGLE_APPS.map((app) => (
              <AppTile
                key={app.slug}
                name={app.name}
                url={app.url}
                slug={app.slug}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleApps;
