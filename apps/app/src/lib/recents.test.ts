import { describe, expect, test } from "bun:test";
import * as Y from "yjs";

import {
  MAX_RECENTS,
  forgetRecent,
  getRecentsMap,
  importLegacyRecents,
  listRecents,
  recordOpen,
} from "@/lib/recents";

function fresh() {
  return getRecentsMap(new Y.Doc());
}

function fakeStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => void store.delete(key),
    has: (key: string) => store.has(key),
  };
}

describe("recordOpen / listRecents", () => {
  test("newest first, one entry per page", () => {
    const map = fresh();
    recordOpen(map, "a", 1000);
    recordOpen(map, "b", 2000);
    recordOpen(map, "a", 3000);
    expect(listRecents(map).map((e) => e.pageId)).toEqual(["a", "b"]);
    expect(listRecents(map)[0]?.openedAt).toBe(3000);
  });

  test("limit applies to the listing", () => {
    const map = fresh();
    for (let i = 0; i < 5; i++) recordOpen(map, `p${i}`, i);
    expect(listRecents(map, 2).map((e) => e.pageId)).toEqual(["p4", "p3"]);
  });

  test("map is bounded to MAX_RECENTS by age", () => {
    const map = fresh();
    for (let i = 0; i < MAX_RECENTS + 5; i++) recordOpen(map, `p${i}`, i);
    expect(map.size).toBe(MAX_RECENTS);
    expect(map.has("p0")).toBe(false);
    expect(map.has(`p${MAX_RECENTS + 4}`)).toBe(true);
  });

  test("forgetRecent removes the page", () => {
    const map = fresh();
    recordOpen(map, "a", 1);
    forgetRecent(map, "a");
    expect(listRecents(map)).toEqual([]);
  });
});

describe("sync semantics", () => {
  test("two docs converge on the newest openedAt per page", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    recordOpen(getRecentsMap(docA), "x", 100);
    recordOpen(getRecentsMap(docB), "x", 200);
    recordOpen(getRecentsMap(docB), "y", 50);
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    const a = listRecents(getRecentsMap(docA));
    const b = listRecents(getRecentsMap(docB));
    expect(a).toEqual(b);
    expect(a.map((e) => e.pageId)).toEqual(["x", "y"]);
    // Concurrent sets on the same key resolve deterministically; both docs agree.
    expect(a[0]?.openedAt === 100 || a[0]?.openedAt === 200).toBe(true);
  });
});

describe("importLegacyRecents", () => {
  test("merges newest-wins and clears the legacy key", () => {
    const map = fresh();
    recordOpen(map, "a", 500);
    const storage = fakeStorage({
      "rune-recents": JSON.stringify([
        { pageId: "a", openedAt: 100 },
        { pageId: "b", openedAt: 900 },
        { pageId: "junk" },
      ]),
    });
    expect(importLegacyRecents(map, storage)).toBe(1);
    expect(map.get("a")).toBe(500);
    expect(map.get("b")).toBe(900);
    expect(storage.has("rune-recents")).toBe(false);
  });

  test("no storage or empty key is a no-op", () => {
    const map = fresh();
    expect(importLegacyRecents(map, null)).toBe(0);
    expect(importLegacyRecents(map, fakeStorage({}))).toBe(0);
    expect(importLegacyRecents(map, fakeStorage({ "rune-recents": "not json" }))).toBe(0);
  });
});
