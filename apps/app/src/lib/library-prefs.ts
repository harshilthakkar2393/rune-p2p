/** Library presentation prefs — per-device, localStorage, never synced. */

export type LibrarySort = "newest" | "updated" | "random";

export type LibraryPrefs = {
  sort: LibrarySort;
};

const KEY = "rune-library-prefs";

const DEFAULTS: LibraryPrefs = {
  sort: "newest",
};

export function readLibraryPrefs(): LibraryPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LibraryPrefs> & {
      showPreviews?: boolean; // legacy keys, ignored
      layout?: string;
    };
    return { sort: parsed.sort ?? DEFAULTS.sort };
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
