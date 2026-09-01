import { useSyncExternalStore } from "react";

import { getNodesMap, initIndexPersistence } from "@/lib/index-doc";
import { adoptOrphanPages, ensureDefaultFolder, purgeExpired } from "@/lib/nodes";
import { destroyPageDoc } from "@/lib/page-doc";
import type { Node } from "@/lib/schema";

/**
 * React binding for the index Y.Map. One observe subscription feeds
 * useSyncExternalStore; the snapshot is a cached array so getSnapshot
 * stays referentially stable between changes.
 */

let snapshot: Node[] = [];
let started = false;

function refreshSnapshot() {
  snapshot = Array.from(getNodesMap().values());
}

function start() {
  if (started) return;
  started = true;
  // Kick off IndexedDB load; observe below fires when persisted state arrives.
  // Once loaded, permanently drop trash past its 30-day retention.
  void initIndexPersistence().then(() => {
    const map = getNodesMap();
    const { removedPageIds } = purgeExpired(map);
    for (const pageId of removedPageIds) void destroyPageDoc(pageId);
    // No-root-pages model: always at least one folder; orphans adopt it.
    ensureDefaultFolder(map);
    adoptOrphanPages(map);
  });
  refreshSnapshot();
}

function subscribe(onStoreChange: () => void): () => void {
  start();
  const map = getNodesMap();
  const handler = () => {
    refreshSnapshot();
    onStoreChange();
  };
  map.observe(handler);
  return () => map.unobserve(handler);
}

function getSnapshot(): Node[] {
  return snapshot;
}

/** All nodes, updated on every index change. Group/sort at render time. */
export function useNodes(): Node[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
