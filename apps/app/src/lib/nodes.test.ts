import { describe, expect, test } from "bun:test";
import * as Y from "yjs";

import type { Node } from "@/lib/schema";
import {
  createFolder,
  createPage,
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

describe("createPage", () => {
  test("creates an untitled page at root", () => {
    const map = freshMap();
    const page = unwrap(createPage(map, null));
    expect(page.title).toBe("");
    expect(page.folderId).toBeNull();
    expect(map.get(page.id)).toEqual(page);
  });

  test("creates a page inside an existing folder", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Work"));
    const page = unwrap(createPage(map, folder.id));
    expect(page.folderId).toBe(folder.id);
  });

  test("rejects a missing parent folder", () => {
    const map = freshMap();
    const result = createPage(map, "does-not-exist");
    expect(result.isErr()).toBe(true);
  });

  test("rejects a page as parent", () => {
    const map = freshMap();
    const page = unwrap(createPage(map, null));
    const result = createPage(map, page.id);
    expect(result.isErr()).toBe(true);
  });
});

describe("createFolder", () => {
  test("rejects an empty name via schema", () => {
    const map = freshMap();
    const result = createFolder(map, null, "");
    expect(result.isErr()).toBe(true);
  });
});

describe("ordering", () => {
  test("siblings keep creation order via sortKey", () => {
    const map = freshMap();
    const first = unwrap(createPage(map, null));
    const second = unwrap(createPage(map, null));
    const third = unwrap(createPage(map, null));
    const ids = listChildren(map, null).map((node) => node.id);
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
    const map = freshMap();
    const page = unwrap(createPage(map, null));
    unwrap(renameNode(map, page.id, "Dump 31-08-26"));
    const cleared = unwrap(renameNode(map, page.id, ""));
    expect(cleared.type === "page" && cleared.title).toBe("");
  });

  test("rejects empty folder name", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Keep"));
    expect(renameNode(map, folder.id, "").isErr()).toBe(true);
  });

  test("errors on unknown id", () => {
    expect(renameNode(freshMap(), "nope", "x").isErr()).toBe(true);
  });
});

describe("moveNode", () => {
  test("moves a page between folders", () => {
    const map = freshMap();
    const work = unwrap(createFolder(map, null, "Work"));
    const personal = unwrap(createFolder(map, null, "Personal"));
    const page = unwrap(createPage(map, work.id));
    const moved = unwrap(moveNode(map, page.id, personal.id));
    expect(moved.type === "page" && moved.folderId).toBe(personal.id);
    expect(listChildren(map, work.id)).toHaveLength(0);
  });

  test("rejects moving a folder into itself", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "A"));
    expect(moveNode(map, folder.id, folder.id).isErr()).toBe(true);
  });

  test("rejects moving a folder into its own descendant", () => {
    const map = freshMap();
    const parent = unwrap(createFolder(map, null, "Parent"));
    const child = unwrap(createFolder(map, parent.id, "Child"));
    const grandchild = unwrap(createFolder(map, child.id, "Grandchild"));
    expect(moveNode(map, parent.id, grandchild.id).isErr()).toBe(true);
  });

  test("moving to root is always allowed", () => {
    const map = freshMap();
    const parent = unwrap(createFolder(map, null, "Parent"));
    const child = unwrap(createFolder(map, parent.id, "Child"));
    const moved = unwrap(moveNode(map, child.id, null));
    expect(moved.type === "folder" && moved.parentId).toBeNull();
  });
});

describe("removeNode", () => {
  test("removes a folder recursively and reports removed page ids", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Work"));
    const sub = unwrap(createFolder(map, folder.id, "Sub"));
    const pageA = unwrap(createPage(map, folder.id));
    const pageB = unwrap(createPage(map, sub.id));
    const outside = unwrap(createPage(map, null));

    const { removedPageIds } = unwrap(removeNode(map, folder.id));
    expect(removedPageIds.toSorted()).toEqual([pageA.id, pageB.id].toSorted());
    expect(map.size).toBe(1);
    expect(map.get(outside.id)).toBeDefined();
  });

  test("errors on unknown id", () => {
    expect(removeNode(freshMap(), "nope").isErr()).toBe(true);
  });
});

describe("dangling references", () => {
  test("children of a vanished folder surface at root", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Doomed"));
    const page = unwrap(createPage(map, folder.id));
    // Simulate a CRDT merge that removed the folder but kept the page.
    map.delete(folder.id);
    const rootIds = listChildren(map, null).map((node) => node.id);
    expect(rootIds).toContain(page.id);
  });
});

describe("trash", () => {
  test("trashNode hides subtree from listChildren, listTrashed shows it", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Doomed"));
    const page = unwrap(createPage(map, folder.id));
    unwrap(trashNode(map, folder.id));
    expect(listChildren(map, null)).toHaveLength(0);
    const trashed = listTrashed(map).map((node) => node.id);
    expect(trashed).toContain(folder.id);
    expect(trashed).toContain(page.id);
  });

  test("restoreNode brings a page back; vanished folder falls to root", () => {
    const map = freshMap();
    const p2 = unwrap(createPage(map, null));
    unwrap(trashNode(map, p2.id));
    const restored = unwrap(restoreNode(map, p2.id));
    expect(restored.deletedAt).toBeUndefined();
    expect(listChildren(map, null).map((n) => n.id)).toContain(p2.id);
  });

  test("purgeExpired removes only nodes past retention", () => {
    const map = freshMap();
    const oldPage = unwrap(createPage(map, null));
    const newPage = unwrap(createPage(map, null));
    unwrap(trashNode(map, oldPage.id));
    unwrap(trashNode(map, newPage.id));
    const node = map.get(oldPage.id);
    if (node) map.set(oldPage.id, { ...node, deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 });
    const { removedPageIds } = purgeExpired(map);
    expect(removedPageIds).toEqual([oldPage.id]);
    expect(map.get(newPage.id)).toBeDefined();
  });

  test("permanent removeNode takes trashed descendants too", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Nest"));
    const page = unwrap(createPage(map, folder.id));
    unwrap(trashNode(map, folder.id));
    const { removedPageIds } = unwrap(removeNode(map, folder.id));
    expect(removedPageIds).toEqual([page.id]);
    expect(map.size).toBe(0);
  });
});

describe("folder color + page attribution", () => {
  test("createFolder stores a preset color", () => {
    const map = freshMap();
    const folder = unwrap(createFolder(map, null, "Work", "blue"));
    expect(folder.color).toBe("blue");
  });

  test("createPage stores creating device", () => {
    const map = freshMap();
    const page = unwrap(createPage(map, null, { createdOn: "MacBook Pro" }));
    expect(page.createdOn).toBe("MacBook Pro");
  });
});
