import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dropdown } from "./components/Dropdown/Dropdown";
import {
  DiscordIcon,
  EmailIcon,
  LocalCafeIcon,
  StarIcon,
} from "./components/Icons/Icons";
import TooltipPortal from "./components/TooltipPortal/TooltipPortal";
import { SOCIALS } from "./config/socials";
import { LANGUAGES, getLocale, setLocale, useT } from "./i18n/i18n";
import {
  readSync,
  subscribe,
  write as writePersisted,
} from "./storage/hybridStorage";
// Theme palette variables — extracted from App.css so the popup
// inherits the user's chosen palette without importing the full
// 1000-line newtab stylesheet (which has body / widget / sidebar
// rules that conflict with the popup's layout). Just the
// `:root` defaults + each `html.theme-<name>` block defining
// `--dark`, `--light`, `--cream`, `--red`, `--rose`, etc. Options.css
// further down aliases its own tokens (--paper, --ink, etc.) to
// these.
import "./Options.css";
import "./styles/themePalettes.css";

// Theme names + their human labels. Mirrors `THEME_KEYS` in the
// LeftSidebar — duplicated rather than imported so the popup
// bundle doesn't drag in the full sidebar / AppContext graph.
// Labels come from i18n at render time (`themes.<name>`) so they
// translate per the user's chosen locale.
const PALETTE_KEYS = [
  "ghibli",
  "spirited",
  "howls",
  "totoro",
  "ponyo",
  "sky",
  "butter",
  "mint",
  "spring",
  "peony",
  "light",
  "dark",
  "frost",
] as const;
type PaletteName = (typeof PALETTE_KEYS)[number];

// Mirrors `LIGHT_MODE_THEMES` in AppContext — themes whose paint
// surfaces are bright, so chrome should render in light mode to
// match the newtab's vibe. Duplicated rather than imported so we
// don't drag the entire AppContext module (with its heavy widget
// graph) into the lightweight options popup bundle.
const LIGHT_THEMES = new Set(["butter", "mint", "spring", "peony", "light"]);

interface AppearanceSnapshot {
  theme?: string;
  highContrast?: boolean;
  cursor?: string;
  font?: string;
}

/** Merge-write the appearance object back to the same key the
 *  newtab uses. The newtab subscribes via `subscribePersisted` in
 *  AppContext, so palette changes here propagate live. */
const setAppearancePatch = (patch: Partial<AppearanceSnapshot>): void => {
  const current = readSync<AppearanceSnapshot>("ghiblify_appearance", {});
  writePersisted("ghiblify_appearance", { ...current, ...patch });
};

const isDarkTheme = (theme: string | undefined): boolean => {
  if (!theme) return true; // fall back to dark (matches newtab default)
  return !LIGHT_THEMES.has(theme);
};

/**
 * Reads the user's appearance preference from the SAME storage key
 * the newtab writes to (`ghiblify_appearance`), and applies a
 * `dark-mode` / `light-mode` class to <html>. The Options.css `:root`
 * vars default to light; the `html.dark-mode` block overrides them
 * for dark themes. Subscribes to storage changes so the popup
 * updates live if the user switches themes in the newtab while the
 * popup is open.
 */
const useNewtabTheme = (): void => {
  const [theme, setTheme] = useState<string | undefined>(() => {
    const saved = readSync<AppearanceSnapshot>("ghiblify_appearance", {});
    return saved?.theme;
  });

  useEffect(() => {
    return subscribe("ghiblify_appearance", (next) => {
      const t = (next as AppearanceSnapshot | null)?.theme;
      setTheme(t);
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Strip any prior theme-* class then apply the active one so the
    // per-theme CSS vars (--dark, --light, --cream, --red, --rose,
    // ...) from App.css cascade onto Options' aliased tokens.
    PALETTE_KEYS.forEach((p) => root.classList.remove(`theme-${p}`));
    const active = (theme as PaletteName | undefined) ?? "ghibli";
    root.classList.add(`theme-${active}`);
    // Also apply the light/dark binary so Options.css's
    // `html.dark-mode` block (which adjusts shadows / gradients
    // not driven by theme vars) keeps working.
    const dark = isDarkTheme(theme);
    root.classList.toggle("dark-mode", dark);
    root.classList.toggle("light-mode", !dark);
  }, [theme]);
};

/**
 * Options popup — opens from the toolbar action icon. Rendered as a
 * React component so we can grow it into a real settings surface
 * later (e.g., expose newtab preferences here, communicate with the
 * newtab via `chrome.storage`'s onChanged listener).
 *
 * For now it mirrors the previous static markup: hero / about /
 * socials / support actions / footer.
 */

interface ActionLink {
  /** Translation-key stub — labels look up `options.<key>Label` and
   *  `options.<key>Sub`. Sub may be a literal (emailLabel sub uses
   *  the literal email address). */
  key: string;
  href: string;
  literalSub?: string;
  Icon: React.FC<
    React.SVGProps<SVGSVGElement> & { fontSize?: number | string }
  >;
}

const ACTIONS: ActionLink[] = [
  {
    key: "rate",
    href: "https://chromewebstore.google.com/detail/ghiblify-new-tab/kdaipjfpbngmcginhhahacjkkkpbaefh/reviews",
    Icon: StarIcon,
  },
  {
    key: "coffee",
    href: "https://www.buymeacoffee.com/emilyxietty",
    Icon: LocalCafeIcon,
  },
  {
    // Reuses `report.discordTitle` for the label (already translated
    // across all 7 locales).
    key: "discord",
    href: "https://discord.gg/8re4UaZ2fX",
    Icon: DiscordIcon,
  },
  {
    key: "email",
    href: "mailto:emily.xietty@gmail.com?subject=Ghiblify%20feedback",
    literalSub: "emily.xietty@gmail.com",
    Icon: EmailIcon,
  },
];

const ACTION_LABEL_KEY: Record<string, string> = {
  rate: "options.rateLabel",
  coffee: "options.coffeeLabel",
  // Reuse the existing translation from the Report modal.
  discord: "report.discordTitle",
  email: "options.emailLabel",
};

export const Options: React.FC = () => {
  const t = useT();
  // Read the user's newtab theme and apply light/dark mode to <html>
  // so the popup chrome matches the vibe of the active palette.
  useNewtabTheme();

  // Locale state — re-renders on locale change (the i18n module
  // already subscribes to chrome.storage so cross-page changes
  // propagate). `useT()` re-renders on dictionary swap; we keep
  // our own `locale` state for the Dropdown's `value` prop.
  const [locale, setLocalLocale] = useState<string>(() => getLocale());
  useEffect(() => {
    return subscribe("ghiblify_locale", (next) => {
      if (typeof next === "string") setLocalLocale(next);
    });
  }, []);

  // Palette state — same pattern as locale.
  const [palette, setPalette] = useState<string | undefined>(() => {
    const saved = readSync<AppearanceSnapshot>("ghiblify_appearance", {});
    return saved?.theme;
  });
  useEffect(() => {
    return subscribe("ghiblify_appearance", (next) => {
      setPalette((next as AppearanceSnapshot | null)?.theme);
    });
  }, []);

  const onPickLocale = (code: string) => {
    setLocale(code); // i18n handles persistence + listener notification
  };
  const onPickPalette = (name: string) => {
    setAppearancePatch({ theme: name });
  };

  return (
    <>
      <TooltipPortal />
      <main className="page">
        <header className="hero">
          <img src="icon128.png" alt="" className="hero-icon" />
          <div className="hero-text">
            <div className="hero-title">Ghiblify</div>
            <div className="hero-subtitle">{t("options.subtitle")}</div>
          </div>
        </header>

        <section className="card">
          <h2>{t("options.aboutTitle")}</h2>
          <p>{t("options.aboutBody")}</p>
        </section>

        <section className="card">
          <h2>{t("options.preferences")}</h2>
          <div className="prefs-row">
            <label className="prefs-label" htmlFor="options-locale-picker">
              {t("options.language")}
            </label>
            <Dropdown
              className="prefs-dropdown"
              size="small"
              variant="outline-light"
              portal
              options={LANGUAGES.map((l) => ({
                value: l.code,
                label: l.label,
              }))}
              value={locale}
              onChange={onPickLocale}
            />
          </div>
          <div className="prefs-row prefs-row-stacked">
            <span className="prefs-label">{t("options.palette")}</span>
            <div
              className="theme-swatches"
              role="radiogroup"
              aria-label={t("options.palette")}
            >
              {PALETTE_KEYS.map((name) => {
                const selected = (palette ?? "ghibli") === name;
                const label = t(`themes.${name}`);
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    data-tooltip={label}
                    className={`theme-swatch theme-${name}${selected ? " is-selected" : ""}`}
                    onClick={() => onPickPalette(name)}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <section className="card">
          <h2>{t("socials.modalTitle")}</h2>
          <div className="socials">
            {SOCIALS.map(({ key, href, label, Icon }) => (
              <a
                key={key}
                className="social"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon />
                {label}
              </a>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>{t("options.supportTitle")}</h2>
          <div className="actions">
            {ACTIONS.map(({ key, href, literalSub, Icon }) => (
              <a
                key={key}
                className="action"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="action-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="action-text">
                  <span className="action-label">
                    {t(ACTION_LABEL_KEY[key])}
                  </span>
                  <span className="action-sub">
                    {literalSub ?? t(`options.${key}Sub`)}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <p className="footer">
          {t("options.footerCredit")} ·{" "}
          <a
            href="https://github.com/emilyxietty/ghiblify-v2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("options.viewSource")}
          </a>{" "}
          ·{" "}
          <a
            href="https://emilyxietty.github.io/chromeprivacy.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("options.privacy")}
          </a>
        </p>
      </main>
    </>
  );
};

export default Options;

// Mount — this file is the Vite entry for `options.html`. The Chrome
// extension popup is its own document with its own JS bundle;
// shared modules (React, the Icons module) get code-split by Vite
// into a common chunk so they don't double-ship with the newtab
// bundle.
const container = document.getElementById("options-root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>,
  );
}
