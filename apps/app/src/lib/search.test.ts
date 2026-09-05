import { describe, expect, test } from "bun:test";

import { matchText, searchNodes } from "@/lib/search";
import type { Folder, Page } from "@/lib/schema";

const page = (id: string, title: string, updatedAt: number, extra: Partial<Page> = {}): Page =>
  ({
    id,
    type: "page",
    title,
    folderId: "f1",
    createdAt: 1,
    updatedAt,
    deletedAt: undefined,
    ...extra,
  }) as Page;
const folder = (id: string, name: string, extra: Partial<Folder> = {}): Folder =>
  ({ id, type: "folder", name, color: "blue", createdAt: 1, updatedAt: 1, ...extra }) as Folder;

describe("matchText", () => {
  test("is case-insensitive and returns the hit range", () => {
    expect(matchText("Kyoto list", "kyo")).toEqual({ start: 0, end: 3 });
    expect(matchText("Tokyo → Kyoto train", "KYO")).toEqual({ start: 2, end: 5 });
  });
  test("returns null for empty or whitespace queries and for misses", () => {
    expect(matchText("Kyoto list", "")).toBeNull();
    expect(matchText("Kyoto list", "   ")).toBeNull();
    expect(matchText("Kyoto list", "osaka")).toBeNull();
  });
});

describe("searchNodes", () => {
  const nodes = [
    page("p1", "Kyoto list", 30),
    page("p2", "Kyoto food to try", 50),
    page("p3", "", 40),
    page("p4", "Kyoto trashed", 60, { deletedAt: 5 }),
    folder("f1", "Travel"),
    folder("f2", "Kyoto planning"),
    folder("f3", "Gone", { deletedAt: 5 }),
  ];
  test("matches live pages by title, newest updated first", () => {
    const { pages } = searchNodes(nodes, "kyoto");
    expect(pages.map((hit) => hit.page.id)).toEqual(["p2", "p1"]);
    expect(pages[0]?.match).toEqual({ start: 0, end: 5 });
  });
  test("untitled pages match their display title", () => {
    const { pages } = searchNodes(nodes, "unt");
    expect(pages.map((hit) => hit.page.id)).toEqual(["p3"]);
  });
  test("matches live folders by name", () => {
    const { folders } = searchNodes(nodes, "kyo");
    expect(folders.map((hit) => hit.folder.id)).toEqual(["f2"]);
  });
  test("empty query returns nothing", () => {
    expect(searchNodes(nodes, " ")).toEqual({ pages: [], folders: [] });
  });
});
