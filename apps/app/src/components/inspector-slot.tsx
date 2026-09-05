import { PageInspector } from "@/components/page-inspector";
import { useNodes } from "@/hooks/use-index";
import { useInspector } from "@/lib/inspector";
import type { Folder, Page } from "@/lib/schema";

/**
 * Renders the page inspector as a TRUE SIBLING card of the sidebar inset:
 * its own floating panel on the sidebar-colored ground, matching the
 * inset's card treatment (rounded, shadow, 8px gutter).
 */
export function InspectorSlot() {
  const { pageId, open } = useInspector();
  const nodes = useNodes();

  if (!open || pageId === null) return null;

  const page = nodes.find((node): node is Page => node.id === pageId && node.type === "page");
  if (!page || page.deletedAt !== undefined) return null;

  const folder =
    page.folderId !== null
      ? nodes.find((node): node is Folder => node.id === page.folderId && node.type === "folder")
      : undefined;

  return (
    <aside className="hidden w-68 shrink-0 md:my-2 md:mr-2 md:flex md:h-[calc(var(--app-h)-16px)] md:flex-col md:rounded-xl md:bg-background md:shadow-sm">
      <PageInspector page={page} folder={folder} />
    </aside>
  );
}
