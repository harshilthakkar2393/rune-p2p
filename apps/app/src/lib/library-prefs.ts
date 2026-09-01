/** Library presentation prefs — per-device, localStorage, never synced. */

export type LibrarySort = "newest" | "updated" | "random";
export type LibraryLayout = "gallery" | "list";

export type LibraryPrefs = {
  sort: LibrarySort;
  layout: LibraryLayout;
};

const KEY = "rune-library-prefs";

const DEFAULTS: LibraryPrefs = {
  sort: "newest",
  layout: "gallery",
};

export function readLibraryPrefs(): LibraryPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LibraryPrefs> & {
      showPreviews?: boolean; // legacy key, ignored
    };
    return {
      sort: parsed.sort ?? DEFAULTS.sort,
      layout: parsed.layout ?? DEFAULTS.layout,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeLibraryPrefs(prefs: LibraryPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // convenience only
  }
}
