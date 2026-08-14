// The one-way fold from the three retired background settings into
// `imageSelection`, kept apart from backgroundStorage.ts so it can be
// exercised on its own: it is pure, it touches no storage, and it is
// the only code path an existing user's settings pass through on
// upgrade. Everything it gets wrong is invisible until someone's
// wallpapers quietly stop appearing.

export interface LegacyBlob {
  /** Retired: URLs removed from the rotation one at a time. */
  blacklist?: string[];
  /** Retired: whole films switched off. */
  selection?: Record<string, boolean>;
  /** Retired: one switch for every moving image in the library.
   *  ABSENT MEANS ON - animated images have rotated by default since
   *  they were introduced, so an absent key must leave them in. */
  animatedBackgrounds?: boolean;
  /** The shape everything folds into. */
  imageSelection?: Record<string, string[]>;
  [key: string]: unknown;
}

export interface LibrarySource {
  title: string;
  links?: string[];
  animated?: string[];
}

export const sourceImages = (s: LibrarySource): string[] => [
  ...(s.links ?? []),
  ...(s.animated ?? []),
];

/** Returns the blob with the three legacy keys folded away, or null if
 *  there is nothing to do (no legacy keys, or no library to fold
 *  against - in which case the caller must leave the keys alone and
 *  retry rather than delete settings it cannot honour). */
export const foldLegacyIntoImageSelection = (
  blob: LegacyBlob,
  sources: LibrarySource[],
): LegacyBlob | null => {
  const hasLegacy =
    "blacklist" in blob || "selection" in blob || "animatedBackgrounds" in blob;
  if (!hasLegacy) return null;
  if (!sources.length) return null;

  const hidden = new Set(blob.blacklist ?? []);
  const filmOff = blob.selection ?? {};
  // Strictly `=== false`. An absent flag, or `true`, means the moving
  // images were showing, and they must keep showing.
  const dropAnimated = blob.animatedBackgrounds === false;
  const sel: Record<string, string[]> = { ...(blob.imageSelection ?? {}) };

  sources.forEach((s) => {
    const animated = s.animated ?? [];
    const all = sourceImages(s);
    if (!all.length) return;
    // A film switched off keeps nothing, whatever the other two say.
    if (filmOff[s.title] === false) {
      sel[s.title] = [];
      return;
    }
    const existing = sel[s.title];
    let keep = existing ? all.filter((l) => existing.includes(l)) : all;
    if (hidden.size) keep = keep.filter((l) => !hidden.has(l));
    if (dropAnimated && animated.length) {
      const moving = new Set(animated);
      keep = keep.filter((l) => !moving.has(l));
    }
    // Only films that actually lost something get an entry - an
    // untouched film must stay absent, both so future images join it
    // and so the common upgrade (nothing was ever switched off) leaves
    // no trace in storage at all.
    if (keep.length !== all.length) sel[s.title] = keep;
  });

  const next: LegacyBlob = { ...blob };
  delete next.blacklist;
  delete next.selection;
  delete next.animatedBackgrounds;
  if (Object.keys(sel).length) next.imageSelection = sel;
  else delete next.imageSelection;
  return next;
};
