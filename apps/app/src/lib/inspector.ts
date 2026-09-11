import { useSyncExternalStore } from "react";

/**
 * Inspector state: which page the panel describes (set by the page route)
 * and whether it's open (persisted per device). Lives in a store because
 * the panel renders as a SIBLING of the sidebar inset in the root layout,
 * outside the route's subtree.
 */

const OPEN_KEY = "rune-inspector-open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "closed";
  } catch {
    return true;
  }
}

let state: { pageId: string | null; open: boolean; sheet: boolean } = {
  pageId: null,
  open: readOpen(),
  sheet: false,
};
const listeners = new Set<() => void>();

function emit(next: typeof state) {
  state = next;
  for (const listener of listeners) listener();
}

export function setInspectorPage(pageId: string | null) {
  emit({ ...state, pageId, sheet: false });
}

/** Phone: the inspector as a bottom sheet. Transient, never persisted — a
 * sheet that reopened itself on every page would be a modal, not a panel. */
export function setInspectorSheet(sheet: boolean) {
  emit({ ...state, sheet });
}

export function toggleInspector() {
  const open = !state.open;
  try {
    localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
  } catch {
    // per-device convenience only
  }
  emit({ ...state, open });
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function useInspector() {
  return useSyncExternalStore(subscribe, () => state);
}
