/** Grid presentation prefs shared by Pages and Folder views — per-device, localStorage, never synced. */

export const GRID_SORTS = ["newest", "updated"] as const;
export type GridSort = (typeof GRID_SORTS)[number];

export type GridPrefs = {
  sort: GridSort;
};

const KEY = "rune-grid-prefs";

const DEFAULTS: GridPrefs = {
  sort: "newest",
};

function isGridSort(value: unknown): value is GridSort {
  return typeof value === "string" && (GRID_SORTS as readonly string[]).includes(value);
}

export function readGridPrefs(): GridPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as { sort?: unknown };
    // Legacy values (e.g. the removed "random") fall back to the default.
    return { sort: isGridSort(parsed.sort) ? parsed.sort : DEFAULTS.sort };
  } catch {
    return DEFAULTS;
  }
}

export function writeGridPrefs(prefs: GridPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // convenience only
  }
}
