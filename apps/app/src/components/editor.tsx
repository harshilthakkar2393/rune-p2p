import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { withCollaboration } from "@blocknote/core/yjs";
import type * as Y from "yjs";

import { setActiveEditor } from "@/lib/editor-ref";
import { usePageDoc } from "@/hooks/use-page-doc";
import { getDeviceName } from "@/lib/device";
import { deviceColor } from "@/lib/sync/device-color";
import { getSyncAwareness } from "@/lib/sync/manager";
import { getDeviceId } from "@/lib/sync/secret";
import { useTheme } from "@rune/ui/components/theme-provider";

const PAGE_FRAGMENT = "blocknote";

function BoundEditor({ doc, phone }: { doc: Y.Doc; phone: boolean }) {
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
        user: { name: getDeviceName(), color: deviceColor(getDeviceId()) },
        showCursorLabels: "activity",
      },
    }),
    [doc],
  );
  useEffect(() => {
    setActiveEditor(editor);
    return () => setActiveEditor(null);
  }, [editor]);

  // Phones get none of BlockNote's pointer UI: the side menu fires on the
  // mousemove iOS synthesises per tap, the floating toolbar fights the iOS
  // selection callout, hover toolbars are unreachable. The keyboard bar
  // (editor-bar-phone.tsx) is the phone's one control surface.
  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme}
      sideMenu={!phone}
      formattingToolbar={!phone}
      linkToolbar={!phone}
      tableHandles={!phone}
    />
  );
}

export function Editor({ pageId, phone = false }: { pageId: string; phone?: boolean }) {
  const doc = usePageDoc(pageId);
  // Until IndexedDB has loaded, rendering would bind BlockNote to an empty doc.
  if (!doc) return null;
  return <BoundEditor key={pageId} doc={doc} phone={phone} />;
}
