import type * as Y from "yjs";

import { getIndexDoc } from "@/lib/index-doc";

/**
 * "Recently opened" lives in the index doc as its own Y.Map (pageId → last
 * openedAt), so Home shows the same recents on every paired device. Concurrent
 * opens merge last-writer-wins per page, which is exactly the semantics of
 * "when was this last opened".
 */

const RECENTS_MAP = "recents";
const LEGACY_KEY = "rune-recents";
/** Entries kept in the map; Home shows fewer. */
export const MAX_RECENTS = 50;

export type RecentEntry = { pageId: string; openedAt: number };
export type RecentsMap = Y.Map<number>;

export function getRecentsMap(doc: Y.Doc = getIndexDoc()): RecentsMap {
  return doc.getMap<number>(RECENTS_MAP);
}

/** Newest first. */
export function listRecents(map: RecentsMap, limit = MAX_RECENTS): RecentEntry[] {
  return Array.from(map.entries())
    .map(([pageId, openedAt]) => ({ pageId, openedAt }))
    .toSorted((a, b) => b.openedAt - a.openedAt)
    .slice(0, limit);
}

export function recordOpen(map: RecentsMap, pageId: string, now = Date.now()): void {
  const transact = (fn: () => void) => (map.doc ? map.doc.transact(fn) : fn());
  transact(() => {
    map.set(pageId, now);
    // Bound the map: drop everything past MAX_RECENTS by age.
    for (const stale of listRecents(map, Infinity).slice(MAX_RECENTS)) map.delete(stale.pageId);
  });
}

export function forgetRecent(map: RecentsMap, pageId: string): void {
  map.delete(pageId);
}

/** Legacy per-device recents (pre-sync). Read once, merge newest-wins, then forget the key. */
export function readLegacyRecents(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = safeStorage(),
): RecentEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RecentEntry).pageId === "string" &&
        typeof (entry as RecentEntry).openedAt === "number",
    );
  } catch {
    return [];
  }
}

export function importLegacyRecents(
  map: RecentsMap,
  storage: Pick<Storage, "getItem" | "removeItem"> | null = safeStorage(),
): number {
  const legacy = readLegacyRecents(storage);
  if (legacy.length === 0) return 0;
  let imported = 0;
  const transact = (fn: () => void) => (map.doc ? map.doc.transact(fn) : fn());
  transact(() => {
    for (const { pageId, openedAt } of legacy) {
      const existing = map.get(pageId);
      if (existing === undefined || existing < openedAt) {
        map.set(pageId, openedAt);
        imported += 1;
      }
    }
  });
  try {
    storage?.removeItem(LEGACY_KEY);
  } catch {
    // leaving the key behind only means a harmless re-merge next start
  }
  return imported;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
