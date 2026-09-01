import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

import { deletePageDb, pageDbName } from "@/lib/index-doc";

/**
 * One Y.Doc per page, persisted to its own IndexedDB database.
 * Open docs are cached for the session — they're small, and keeping them
 * alive means instant switches back to a recently opened page.
 */

type PageDocHandle = {
  doc: Y.Doc;
  whenSynced: Promise<void>;
};

const openDocs = new Map<string, { handle: PageDocHandle; persistence: IndexeddbPersistence }>();

export function getPageDoc(pageId: string): PageDocHandle {
  const existing = openDocs.get(pageId);
  if (existing) return existing.handle;

  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(pageDbName(pageId), doc);
  const handle: PageDocHandle = {
    doc,
    whenSynced: persistence.whenSynced.then(() => undefined),
  };
  openDocs.set(pageId, { handle, persistence });
  return handle;
}

/** Tear down a page's doc and drop its database. Used on page delete. */
export async function destroyPageDoc(pageId: string): Promise<void> {
  const entry = openDocs.get(pageId);
  if (entry) {
    openDocs.delete(pageId);
    entry.persistence.destroy();
    entry.handle.doc.destroy();
  }
  await deletePageDb(pageId);
}
