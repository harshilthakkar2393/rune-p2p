import { describe, expect, test } from "bun:test";
import * as Y from "yjs";

import type { Node } from "@/lib/schema";
import {
  adoptOrphanPages,
  createFolder,
  createPage,
  ensureDefaultFolder,
  listChildren,
  listTrashed,
  moveNode,
  purgeExpired,
  removeNode,
  renameNode,
  restoreNode,
  trashNode,
  type NodesMap,
} from "@/lib/nodes";

function freshMap(): NodesMap {
  return new Y.Doc().getMap<Node>("nodes");
}

function unwrap<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) throw new Error(`expected ok, got: ${String(result.error)}`);
  return result.value as T;
}

function seeded() {
  const map = freshMap();
  const home = unwrap(createFolder(map, null, "Notes"));
  return { map, home };
}

describe("createPage", () => {
  test("creates an untitled page inside a folder", () => {
    const { map, home } = seeded();
    const page = unwrap(createPage(map, home.id));
    expect(page.title).toBe("");
    expect(page.folderId).toBe(home.id);
    expect(map.get(page.id)).toEqual(page);
  });

  test("rejects a missing parent folder", () => {
    const { map } = seeded();
    expect(createPage(map, "does-not-exist").isErr()).toBe(true);
  });

  test("rejects a page as parent", () => {
    const { map, home } = seeded();
    const page = unwrap(createPage(map, home.id));
    expect(createPage(map, page.id).isErr()).toBe(true);
  });

  test("stores creating device", () => {
    const { map, home } = seeded();
    const page = unwrap(createPage(map, home.id, { createdOn: "MacBook Pro" }));
    expect(page.createdOn).toBe("MacBook Pro");
  });
});

describe("createFolder", () => {
  test("rejects an empty name via schema", () => {
    const map = freshMap();
    expect(createFolder(map, null, "").isErr()).toBe(true);
  });

  test("stores a preset color", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Work", "blue"));
    expect(folder.color).toBe("blue");
  });
});

describe("ordering", () => {
  test("siblings keep creation order via sortKey", () => {
    const { map, home } = seeded();
    const first = unwrap(createPage(map, home.id));
    const second = unwrap(createPage(map, home.id));
    const third = unwrap(createPage(map, home.id));
    const ids = listChildren(map, home.id).map((node) => node.id);
    expect(ids).toEqual([first.id, second.id, third.id]);
  });
});

describe("renameNode", () => {
  test("renames a folder and touches updatedAt", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Old"));
    const renamed = unwrap(renameNode(map, folder.id, "New"));
    expect(renamed.type === "folder" && renamed.name).toBe("New");
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(folder.updatedAt);
  });

  test("allows empty page title (untitled dump)", () => {
    const { map, home } = seeded();
    const page = unwrap(createPage(map, home.id));
    unwrap(renameNode(map, page.id, "Dump 31-08-26"));
    const cleared = unwrap(renameNode(map, page.id, ""));
    expect(cleared.type === "page" && cleared.title).toBe("");
  });

  test("rejects empty folder name", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Keep"));
    expect(renameNode(map, folder.id, "").isErr()).toBe(true);
  });
});

describe("moveNode", () => {
  test("moves a page between folders", () => {
    const { map, home } = seeded();
    const personal = unwrap(createFolder(map, null, "Personal"));
    const page = unwrap(createPage(map, home.id));
    const moved = unwrap(moveNode(map, page.id, personal.id));
    expect(moved.type === "page" && moved.folderId).toBe(personal.id);
    expect(listChildren(map, home.id)).toHaveLength(0);
  });

  test("rejects moving a page to root", () => {
    const { map, home } = seeded();
    const page = unwrap(createPage(map, home.id));
    expect(moveNode(map, page.id, null).isErr()).toBe(true);
  });

  test("rejects moving a folder into itself or its descendant", () => {
    const map = freshMap();
    const parent = unwrap(createFolder(map, null, "Parent"));
    const child = unwrap(createFolder(map, parent.id, "Child"));
    expect(moveNode(map, parent.id, parent.id).isErr()).toBe(true);
    expect(moveNode(map, parent.id, child.id).isErr()).toBe(true);
  });
});

describe("trash", () => {
  test("trashNode hides subtree, listTrashed shows it, restore brings pages back", () => {
    const { map, home } = seeded();
    const doomed = unwrap(createFolder(map, null, "Doomed"));
    const page = unwrap(createPage(map, doomed.id));
    unwrap(trashNode(map, doomed.id));
    expect(listChildren(map, null).map((node) => node.id)).toEqual([home.id]);
    expect(listTrashed(map).map((node) => node.id)).toContain(page.id);
    const restored = unwrap(restoreNode(map, page.id));
    expect(restored.deletedAt).toBeUndefined();
  });

  test("the last live folder cannot be trashed", () => {
    const { map, home } = seeded();
    expect(trashNode(map, home.id).isErr()).toBe(true);
    const second = unwrap(createFolder(map, null, "Second"));
    expect(trashNode(map, second.id).isOk()).toBe(true);
    expect(trashNode(map, home.id).isErr()).toBe(true);
  });

  test("purgeExpired removes only nodes past retention", () => {
    const { map, home } = seeded();
    const oldPage = unwrap(createPage(map, home.id));
    const newPage = unwrap(createPage(map, home.id));
    unwrap(trashNode(map, oldPage.id));
    unwrap(trashNode(map, newPage.id));
    const node = map.get(oldPage.id);
    if (node)
      map.set(oldPage.id, {
        ...node,
        deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      });
    const { removedPageIds } = purgeExpired(map);
    expect(removedPageIds).toEqual([oldPage.id]);
    expect(map.get(newPage.id)).toBeDefined();
  });

  test("permanent removeNode takes trashed descendants too", () => {
    const { map } = seeded();
    const nest = unwrap(createFolder(map, null, "Nest"));
    const page = unwrap(createPage(map, nest.id));
    unwrap(trashNode(map, nest.id));
    const { removedPageIds } = unwrap(removeNode(map, nest.id));
    expect(removedPageIds).toEqual([page.id]);
    expect(map.get(nest.id)).toBeUndefined();
  });
});

describe("default folder + orphan adoption", () => {
  test("ensureDefaultFolder creates Notes once", () => {
    const map = freshMap();
    const first = ensureDefaultFolder(map);
    expect(first.name).toBe("Notes");
    const again = ensureDefaultFolder(map);
    expect(again.id).toBe(first.id);
  });

  test("adoptOrphanPages moves legacy/dangling pages into the default", () => {
    const { map, home } = seeded();
    const page = unwrap(createPage(map, home.id));
    // Simulate a legacy root page and a dangling-folder page.
    map.set(page.id, { ...page, folderId: null });
    const ghostFolder = unwrap(createFolder(map, null, "Ghost"));
    const stranded = unwrap(createPage(map, ghostFolder.id));
    map.delete(ghostFolder.id);

    const adopted = adoptOrphanPages(map);
    expect(adopted).toBe(2);
    const ids = listChildren(map, home.id).map((node) => node.id);
    expect(ids).toContain(page.id);
    expect(ids).toContain(stranded.id);
  });
});
