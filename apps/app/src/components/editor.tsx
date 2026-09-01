import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { withCollaboration } from "@blocknote/core/yjs";
import type * as Y from "yjs";

import { usePageDoc } from "@/hooks/use-page-doc";
import { useTheme } from "@/components/theme-provider";

const PAGE_FRAGMENT = "blocknote";

function BoundEditor({ doc }: { doc: Y.Doc }) {
  const { resolvedTheme } = useTheme();
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment(PAGE_FRAGMENT),
        // No provider: local-only for now. Awareness/cursors arrive with sync.
        user: { name: "me", color: "#737373" },
      },
    }),
    [doc],
  );
  return <BlockNoteView editor={editor} theme={resolvedTheme} />;
}

export function Editor({ pageId }: { pageId: string }) {
  const doc = usePageDoc(pageId);
  // Until IndexedDB has loaded, rendering would bind BlockNote to an empty doc.
  if (!doc) return null;
  return <BoundEditor key={pageId} doc={doc} />;
}
