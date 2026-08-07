import React, { useEffect, useRef, useState } from "react";
import { AccountCircleIcon, AppsIcon } from "../../../components/Icons/Icons";
import { useT } from "../../../i18n/i18n";
import { resolveSurfaceFrost } from "../../../config/widgetConfig";
import {
  hexToRgbChannels,
  isHighlightTextColor,
  resolveForeground,
} from "../../../utils/textHighlight";
import { useAppContext } from "../../../contexts/AppContext";
import { useWidgetSettings } from "../../../hooks/useWidgetSettings";
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

// A curated shortlist rather than Google's full waffle: the real
// launcher is a 24-tile wall most people use eight of, and a shorter
// grid is quicker to scan on a new-tab page. `slug` names the BUNDLED
// icon under
// /assets/google/<slug>.png (downloaded from Google's favicon service
// at build-authoring time - real product icons, shipped offline).
const GOOGLE_APPS: Array<{ name: string; url: string; slug: string }> = [
  { name: "Drive", url: "https://drive.google.com", slug: "drive" },
  { name: "Photos", url: "https://photos.google.com", slug: "photos" },
  { name: "Gmail", url: "https://mail.google.com", slug: "gmail" },
  { name: "Calendar", url: "https://calendar.google.com", slug: "calendar" },
  { name: "Meet", url: "https://meet.google.com", slug: "meet" },
  { name: "Chat", url: "https://chat.google.com", slug: "chat" },
  { name: "Maps", url: "https://maps.google.com", slug: "maps" },
  { name: "Account", url: "https://myaccount.google.com", slug: "account" },
];

const ACCOUNT_URL = "https://myaccount.google.com";

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
  const rootRef = useRef<HTMLDivElement | null>(null);

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
  const gInk = isHighlightTextColor(settings.textColor)
    ? settings.textColor
    : "auto";
  const surfaceRgb =
    typeof settings.surfaceColor === "string"
      ? hexToRgbChannels(settings.surfaceColor)
      : null;
  const surfaceStyle: Record<string, string | number> = {
    "--gapps-opacity": gFrosted ? 0.14 : (settings.opacity ?? 75) / 100,
    ...((): Record<string, string> => {
      if (typeof settings.surfaceColor === "string")
        return { "--gapps-ink": resolveForeground(settings.surfaceColor, gInk) };
      if (gInk === "light") return { "--gapps-ink": "#ffffff" };
      if (gInk === "dark") return { "--gapps-ink": "#1f2420" };
      return {};
    })(),
    ...(surfaceRgb
      ? {
          "--dark-rgb": surfaceRgb,
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
        data-tooltip={t("widgets.gapps.accountAria")}
        draggable={false}
      >
        <AccountCircleIcon style={{ fontSize: 26 }} />
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
