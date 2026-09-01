import { useEffect, useState } from "react";
import type * as Y from "yjs";

import { getPageDoc } from "@/lib/page-doc";

/**
 * Opens (or reuses) the Y.Doc for a page and reports when its persisted
 * state has loaded from IndexedDB, so the editor never initializes against
 * a half-loaded document.
 */
export function usePageDoc(pageId: string): Y.Doc | null {
  const [doc, setDoc] = useState<Y.Doc | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    const handle = getPageDoc(pageId);
    void handle.whenSynced.then(() => {
      if (!cancelled) setDoc(handle.doc);
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  return doc;
}
