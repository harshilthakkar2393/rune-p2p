import type { Folder, Node, Page } from "@/lib/schema";

/** Title/name search over the index. v1 is a substring match on titles and
 * folder names (instant); content search over page docs is a later upgrade. */

export type Match = { start: number; end: number };
export type PageHit = { page: Page; match: Match };
export type FolderHit = { folder: Folder; match: Match };

export function pageTitle(page: Page): string {
  return page.title === "" ? "Untitled" : page.title;
}

export function matchText(text: string, query: string): Match | null {
  const needle = query.trim().toLowerCase();
  if (needle === "") return null;
  const start = text.toLowerCase().indexOf(needle);
  return start === -1 ? null : { start, end: start + needle.length };
}

export function searchNodes(
  nodes: readonly Node[],
  query: string,
): { pages: PageHit[]; folders: FolderHit[] } {
  if (query.trim() === "") return { pages: [], folders: [] };
  const pages: PageHit[] = [];
  const folders: FolderHit[] = [];
  for (const node of nodes) {
    if (node.deletedAt !== undefined) continue;
    if (node.type === "page") {
      const match = matchText(pageTitle(node), query);
      if (match) pages.push({ page: node, match });
    } else if (node.type === "folder") {
      const match = matchText(node.name, query);
      if (match) folders.push({ folder: node, match });
    }
  }
  pages.sort((a, b) => b.page.updatedAt - a.page.updatedAt);
  return { pages, folders };
}
