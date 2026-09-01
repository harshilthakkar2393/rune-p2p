import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

import type { Node } from "@/lib/schema";

const INDEX_DB_NAME = "rune:index";
const PAGE_DB_PREFIX = "rune:page:";

let doc: Y.Doc | null = null;
let persistence: IndexeddbPersistence | null = null;

export function getIndexDoc(): Y.Doc {
  doc ??= new Y.Doc();
  return doc;
}

export function getNodesMap(): Y.Map<Node> {
  return getIndexDoc().getMap<Node>("nodes");
}

/** Load persisted index from IndexedDB and keep persisting from then on. */
export function initIndexPersistence(): Promise<void> {
  persistence ??= new IndexeddbPersistence(INDEX_DB_NAME, getIndexDoc());
  return persistence.whenSynced.then(() => undefined);
}

export function pageDbName(pageId: string): string {
  return `${PAGE_DB_PREFIX}${pageId}`;
}

/** Drop a page's content database. Fire-and-forget safe: deleting a missing DB is a no-op. */
export function deletePageDb(pageId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(pageDbName(pageId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
