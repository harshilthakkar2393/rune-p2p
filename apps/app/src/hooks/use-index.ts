import { useSyncExternalStore } from "react";

import { getNodesMap, initIndexPersistence } from "@/lib/index-doc";
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
  void initIndexPersistence();
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
