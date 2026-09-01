import { ensureDefaultFolder, type NodesMap } from "@/lib/nodes";

/** Where a new page lands when composed outside a folder page: the folder
 * last visited/used on THIS device, else the first (default) folder. */

const KEY = "rune-last-folder";

export function rememberFolder(folderId: string) {
  try {
    localStorage.setItem(KEY, folderId);
  } catch {
    // convenience only
  }
}

export function composeTargetFolderId(map: NodesMap): string {
  try {
    const remembered = localStorage.getItem(KEY);
    if (remembered) {
      const node = map.get(remembered);
      if (node?.type === "folder" && node.deletedAt === undefined) return remembered;
    }
  } catch {
    // fall through to default
  }
  return ensureDefaultFolder(map).id;
}
