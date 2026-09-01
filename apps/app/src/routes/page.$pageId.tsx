import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutAlignRightIcon } from "@hugeicons/core-free-icons";

import { Editor } from "@/components/editor";
import { Tip } from "@/components/tip";
import { FolderGlyph } from "@/components/folder-glyph";
import { PageTitle } from "@/components/page-title";
import { useNodes } from "@/hooks/use-index";
import { folderColorValue } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { setInspectorPage, toggleInspector, useInspector } from "@/lib/inspector";
import { rememberFolder } from "@/lib/compose-target";
import { recordOpen } from "@/lib/recents";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { ScrollArea } from "@rune/ui/components/scroll-area";

export const Route = createFileRoute("/page/$pageId")({ component: PageView });

function PageView() {
  const { pageId } = Route.useParams();
  const nodes = useNodes();
  const { open: inspectorOpen } = useInspector();

  useEffect(() => {
    recordOpen(pageId);
    setInspectorPage(pageId);
    const node = getNodesMap().get(pageId);
    if (node?.type === "page" && node.folderId !== null) rememberFolder(node.folderId);
    return () => setInspectorPage(null);
  }, [pageId]);

  const page = nodes.find((node): node is Page => node.id === pageId && node.type === "page");
  const folder =
    page && page.folderId !== null
      ? nodes.find((node): node is Folder => node.id === page.folderId && node.type === "folder")
      : undefined;
  const folderTint = folderColorValue(folder?.color);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 px-3">
          {folder && (
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-small text-muted-foreground">
              <FolderGlyph className="size-4" color={folderTint ?? "var(--muted-foreground)"} />
              <span className="max-w-40 truncate">{folder.name}</span>
            </span>
          )}
          <Tip label={inspectorOpen ? "Hide page info" : "Show page info"}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-muted-foreground"
              aria-label={inspectorOpen ? "Hide page info" : "Show page info"}
              onClick={() => toggleInspector()}
            >
              <HugeiconsIcon icon={LayoutAlignRightIcon} strokeWidth={1.75} />
            </Button>
          </Tip>
        </header>
        <ScrollArea className="min-h-0 w-full flex-1">
          <main className="w-full pt-4 pb-10">
            <div className="flex flex-col gap-2">
              <div className="px-13.5">
                <PageTitle pageId={pageId} />
              </div>
              <Editor pageId={pageId} />
            </div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
