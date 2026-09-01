import { useSyncExternalStore } from "react";

/**
 * Which page is open in the editor. Tiny module store for now;
 * becomes a route param when /page/$pageId routing lands.
 */

let selectedPageId: string | null = null;
const listeners = new Set<() => void>();

export function selectPage(id: string | null) {
  selectedPageId = id;
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function usePageSelection(): string | null {
  return useSyncExternalStore(subscribe, () => selectedPageId);
}
