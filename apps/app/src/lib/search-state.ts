import { useSyncExternalStore } from "react";

/** Phone search state shared by the floating field (root layout) and the
 * /search screen: the query, and the input element so the dock's Search tab
 * can focus it inside the tap gesture (iOS only raises the keyboard then). */

let query = "";
let input: HTMLInputElement | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setSearchQuery(next: string) {
  if (next === query) return;
  query = next;
  emit();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function useSearchQuery(): string {
  return useSyncExternalStore(subscribe, () => query);
}

export function registerSearchInput(element: HTMLInputElement | null) {
  input = element;
}

/** Call synchronously from a user gesture, before navigating to /search. */
export function focusSearchInput() {
  input?.focus({ preventScroll: true });
}

export function blurSearchInput() {
  input?.blur();
}
