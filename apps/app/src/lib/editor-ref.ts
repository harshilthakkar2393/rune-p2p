import { useSyncExternalStore } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

/**
 * The currently mounted page editor, for features outside the editor tree
 * (export, the phone keyboard bar). A tiny store so those features re-render
 * when a page mounts or unmounts its editor.
 */
let active: BlockNoteEditor | null = null;
const listeners = new Set<() => void>();

export function setActiveEditor(editor: BlockNoteEditor | null) {
  active = editor;
  for (const listener of listeners) listener();
}

export function getActiveEditor(): BlockNoteEditor | null {
  return active;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function useActiveEditor(): BlockNoteEditor | null {
  return useSyncExternalStore(subscribe, getActiveEditor);
}
