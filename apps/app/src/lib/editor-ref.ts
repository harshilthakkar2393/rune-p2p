import type { BlockNoteEditor } from "@blocknote/core";

/** The currently mounted page editor, for features outside the editor tree (export). */
let active: BlockNoteEditor | null = null;

export function setActiveEditor(editor: BlockNoteEditor | null) {
  active = editor;
}

export function getActiveEditor(): BlockNoteEditor | null {
  return active;
}
