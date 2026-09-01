import { useSyncExternalStore } from "react";

/** Open/close state for the ⌘K search palette, shared by sidebar button and shortcut. */

let open = false;
const listeners = new Set<() => void>();

export function setPaletteOpen(next: boolean) {
  open = next;
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function usePaletteOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
