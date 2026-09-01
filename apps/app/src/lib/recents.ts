/**
 * Per-device "recently opened" tracking. Deliberately localStorage, not the
 * index doc: what THIS device opened is device behavior, not document data,
 * and must not sync or merge.
 */

const KEY = "rune-recents";
const MAX_RECENTS = 12;

export type RecentEntry = { pageId: string; openedAt: number };

export function readRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
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

export function recordOpen(pageId: string) {
  const next = [
    { pageId, openedAt: Date.now() },
    ...readRecents().filter((entry) => entry.pageId !== pageId),
  ].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — recents are a convenience, not data
  }
}

export function forgetRecent(pageId: string) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(readRecents().filter((entry) => entry.pageId !== pageId)),
    );
  } catch {
    // ignore
  }
}
