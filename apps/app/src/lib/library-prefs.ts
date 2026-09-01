/** Library presentation prefs — per-device, localStorage, never synced. */

export const LIBRARY_SORTS = ["newest", "updated"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export type LibraryPrefs = {
  sort: LibrarySort;
};

const KEY = "rune-library-prefs";

const DEFAULTS: LibraryPrefs = {
  sort: "newest",
};

function isLibrarySort(value: unknown): value is LibrarySort {
  return typeof value === "string" && (LIBRARY_SORTS as readonly string[]).includes(value);
}

export function readLibraryPrefs(): LibraryPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as { sort?: unknown };
    // Legacy values (e.g. the removed "random") fall back to the default.
    return { sort: isLibrarySort(parsed.sort) ? parsed.sort : DEFAULTS.sort };
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
