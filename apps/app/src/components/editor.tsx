import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { withCollaboration } from "@blocknote/core/yjs";
import type * as Y from "yjs";

import { setActiveEditor } from "@/lib/editor-ref";
import { usePageDoc } from "@/hooks/use-page-doc";
import { getDeviceName } from "@/lib/device";
import { getSyncAwareness } from "@/lib/sync/manager";
import { useTheme } from "@rune/ui/components/theme-provider";

const PAGE_FRAGMENT = "blocknote";

function BoundEditor({ doc }: { doc: Y.Doc }) {
  const { resolvedTheme } = useTheme();
  const awareness = getSyncAwareness();
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment(PAGE_FRAGMENT),
        // Awareness is shared across all pages by the sync manager; the
        // cursor plugin only renders positions that resolve inside this
        // page's doc, so peers editing elsewhere show no cursor here.
        provider: awareness ? { awareness } : undefined,
        user: { name: getDeviceName(), color: "#737373" },
        showCursorLabels: "activity",
      },
    }),
    [doc],
  );
  useEffect(() => {
    setActiveEditor(editor);
    return () => setActiveEditor(null);
  }, [editor]);

  return <BlockNoteView editor={editor} theme={resolvedTheme} />;
}

export function Editor({ pageId }: { pageId: string }) {
  const doc = usePageDoc(pageId);
  // Until IndexedDB has loaded, rendering would bind BlockNote to an empty doc.
  if (!doc) return null;
  return <BoundEditor key={pageId} doc={doc} />;
}
