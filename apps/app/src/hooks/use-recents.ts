import { useSyncExternalStore } from "react";

import { getRecentsMap, listRecents, type RecentEntry } from "@/lib/recents";

/** Recently opened pages from the synced index doc, newest first. */

let snapshot: RecentEntry[] = [];

function refresh() {
  snapshot = listRecents(getRecentsMap());
}

function subscribe(onStoreChange: () => void): () => void {
  const map = getRecentsMap();
  const handler = () => {
    refresh();
    onStoreChange();
  };
  refresh();
  map.observe(handler);
  return () => map.unobserve(handler);
}

export function useRecents(): RecentEntry[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}
