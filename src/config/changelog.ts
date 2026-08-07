/**
 * Release notes shown by the ChangelogModal.
 *
 * Kept as data rather than markup so a release is one entry plus its
 * strings, and so the modal never has to grow a branch per version.
 * Items are i18n key SUFFIXES under `changelog.notes.` - release notes
 * are user-facing copy, so they get translated like everything else
 * rather than shipping English into six other locales.
 *
 * Newest first: the modal renders them in array order, and the version
 * a user just updated into is the one they opened this to read.
 *
 * Note the deliberate limit - this list is a highlight reel, not a
 * commit log. Anything that needs more room than a line belongs on the
 * Discord the modal links to underneath.
 */
export interface ReleaseNotes {
  /** Matches the manifest version this shipped as. */
  version: string;
  /** i18n key suffixes under `changelog.notes.`, in display order. */
  items: readonly string[];
}

export const CHANGELOG: readonly ReleaseNotes[] = [
  {
    version: "2.5.0",
    items: [
      "v250Notes",
      "v250Dock",
      "v250Weather",
      "v250Links",
      "v250Surfaces",
      "v250Editing",
      "v250Under",
    ],
  },
];
