import { generateKeyBetween } from "fractional-indexing";
import { nanoid } from "nanoid";
import { Result, TaggedError } from "better-result";
import type * as Y from "yjs";

import { NodeSchema, type Folder, type Node, type Page } from "@/lib/schema";

/**
 * CRUD over the index Y.Map. All mutations go through here so the two
 * invariants zod can't express are enforced in one place:
 * - folder parent chains never cycle
 * - dangling parent references degrade to root instead of throwing
 * Persistence and sync are not this module's concern — mutating the map is enough.
 */

export type NodesMap = Y.Map<Node>;

export class NodeNotFoundError extends TaggedError("NodeNotFoundError")<{
  id: string;
  message: string;
}> {
  constructor(args: { id: string }) {
    super({ ...args, message: `Node not found: ${args.id}` });
  }
}

export class NotAFolderError extends TaggedError("NotAFolderError")<{
  id: string;
  message: string;
}> {
  constructor(args: { id: string }) {
    super({ ...args, message: `Not an existing folder: ${args.id}` });
  }
}

export class FolderCycleError extends TaggedError("FolderCycleError")<{
  id: string;
  targetId: string;
  message: string;
}> {
  constructor(args: { id: string; targetId: string }) {
    super({
      ...args,
      message: `Moving folder ${args.id} into ${args.targetId} would create a cycle`,
    });
  }
}

export class InvalidNodeError extends TaggedError("InvalidNodeError")<{
  message: string;
  cause: unknown;
}> {
  constructor(args: { cause: unknown }) {
    super({ ...args, message: `Node failed schema validation: ${String(args.cause)}` });
  }
}

function parentIdOf(node: Node): string | null {
  return node.type === "folder" ? node.parentId : node.folderId;
}

/** Dangling refs resolve to root: a parent that is missing or not a folder counts as null. */
function resolvedParentId(map: NodesMap, node: Node): string | null {
  const parentId = parentIdOf(node);
  if (parentId === null) return null;
  const parent = map.get(parentId);
  return parent?.type === "folder" ? parentId : null;
}

export function listChildren(map: NodesMap, parentId: string | null): Node[] {
  const children: Node[] = [];
  for (const node of map.values()) {
    if (resolvedParentId(map, node) === parentId) children.push(node);
  }
  return children.toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function nextSortKey(map: NodesMap, parentId: string | null): string {
  const siblings = listChildren(map, parentId);
  const last = siblings.at(-1);
  return generateKeyBetween(last?.sortKey ?? null, null);
}

function requireFolder(
  map: NodesMap,
  folderId: string,
): Result<Folder, NotAFolderError> {
  const node = map.get(folderId);
  return node?.type === "folder"
    ? Result.ok(node)
    : Result.err(new NotAFolderError({ id: folderId }));
}

function validateAndSet(map: NodesMap, node: Node): Result<Node, InvalidNodeError> {
  const parsed = NodeSchema.safeParse(node);
  if (!parsed.success) return Result.err(new InvalidNodeError({ cause: parsed.error }));
  map.set(parsed.data.id, parsed.data);
  return Result.ok(parsed.data);
}

export function createPage(
  map: NodesMap,
  folderId: string | null,
): Result<Page, NotAFolderError | InvalidNodeError> {
  if (folderId !== null) {
    const folder = requireFolder(map, folderId);
    if (folder.isErr()) return Result.err(folder.error);
  }
  const now = Date.now();
  const page: Page = {
    id: nanoid(),
    type: "page",
    title: "",
    folderId,
    sortKey: nextSortKey(map, folderId),
    createdAt: now,
    updatedAt: now,
  };
  return validateAndSet(map, page) as Result<Page, InvalidNodeError>;
}

export function createFolder(
  map: NodesMap,
  parentId: string | null,
  name: string,
): Result<Folder, NotAFolderError | InvalidNodeError> {
  if (parentId !== null) {
    const parent = requireFolder(map, parentId);
    if (parent.isErr()) return Result.err(parent.error);
  }
  const now = Date.now();
  const folder: Folder = {
    id: nanoid(),
    type: "folder",
    name,
    parentId,
    sortKey: nextSortKey(map, parentId),
    createdAt: now,
    updatedAt: now,
  };
  return validateAndSet(map, folder) as Result<Folder, InvalidNodeError>;
}

export function renameNode(
  map: NodesMap,
  id: string,
  name: string,
): Result<Node, NodeNotFoundError | InvalidNodeError> {
  const node = map.get(id);
  if (!node) return Result.err(new NodeNotFoundError({ id }));
  const renamed: Node =
    node.type === "folder"
      ? { ...node, name, updatedAt: Date.now() }
      : { ...node, title: name, updatedAt: Date.now() };
  return validateAndSet(map, renamed);
}

export function moveNode(
  map: NodesMap,
  id: string,
  newParentId: string | null,
): Result<Node, NodeNotFoundError | NotAFolderError | FolderCycleError | InvalidNodeError> {
  const node = map.get(id);
  if (!node) return Result.err(new NodeNotFoundError({ id }));

  if (newParentId !== null) {
    const parent = requireFolder(map, newParentId);
    if (parent.isErr()) return Result.err(parent.error);
  }

  if (node.type === "folder" && newParentId !== null) {
    // Walk up from the destination; hitting ourselves means we'd become our own ancestor.
    let ancestorId: string | null = newParentId;
    while (ancestorId !== null) {
      if (ancestorId === id) {
        return Result.err(new FolderCycleError({ id, targetId: newParentId }));
      }
      const ancestor: Node | undefined = map.get(ancestorId);
      ancestorId = ancestor ? parentIdOf(ancestor) : null;
    }
  }

  const sortKey = nextSortKey(map, newParentId);
  const moved: Node =
    node.type === "folder"
      ? { ...node, parentId: newParentId, sortKey, updatedAt: Date.now() }
      : { ...node, folderId: newParentId, sortKey, updatedAt: Date.now() };
  return validateAndSet(map, moved);
}

/** Recursive delete. Returns removed page ids so the caller can drop their content DBs. */
export function removeNode(
  map: NodesMap,
  id: string,
): Result<{ removedPageIds: string[] }, NodeNotFoundError> {
  const node = map.get(id);
  if (!node) return Result.err(new NodeNotFoundError({ id }));

  const removedPageIds: string[] = [];
  const removeRecursive = (target: Node) => {
    if (target.type === "folder") {
      for (const child of listChildren(map, target.id)) removeRecursive(child);
    } else {
      removedPageIds.push(target.id);
    }
    map.delete(target.id);
  };

  const transact = (fn: () => void) =>
    map.doc ? map.doc.transact(fn) : fn();
  transact(() => removeRecursive(node));

  return Result.ok({ removedPageIds });
}
