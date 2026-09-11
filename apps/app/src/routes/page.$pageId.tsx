import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutAlignRightIcon } from "@hugeicons/core-free-icons";

import { Editor } from "@/components/editor";
import { EditorBarPhone } from "@/components/editor-bar-phone";
import { Tip } from "@/components/tip";
import { FolderGlyph } from "@/components/folder-glyph";
import { PageHeaderPhone } from "@/components/page-header-phone";
import { PageTitle } from "@/components/page-title";
import { useNodes } from "@/hooks/use-index";
import { folderColorValue } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { setInspectorPage, toggleInspector, useInspector } from "@/lib/inspector";
import { rememberFolder } from "@/lib/compose-target";
import { getRecentsMap, recordOpen } from "@/lib/recents";
import { setPresencePage } from "@/lib/sync/manager";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { useIsMobile } from "@rune/ui/hooks/use-mobile";
import { useTouchPrimary } from "@rune/ui/hooks/use-has-primary-touch";

export const Route = createFileRoute("/page/$pageId")({ component: PageView });

function PageView() {
  const { pageId } = Route.useParams();
  const nodes = useNodes();
  const { open: inspectorOpen } = useInspector();
  const isMobile = useIsMobile();
  // The editor's mode follows the pointer, not the width: an iPad by finger
  // gets the keyboard bar, an iPad with a trackpad gets the hover side menu.
  const touch = useTouchPrimary();

  useEffect(() => {
    recordOpen(getRecentsMap(), pageId);
    setInspectorPage(pageId);
    setPresencePage(pageId);
    const node = getNodesMap().get(pageId);
    if (node?.type === "page" && node.folderId !== null) rememberFolder(node.folderId);
    return () => {
      setInspectorPage(null);
      setPresencePage(null);
    };
  }, [pageId]);

  const page = nodes.find((node): node is Page => node.id === pageId && node.type === "page");
  const folder =
    page && page.folderId !== null
      ? nodes.find((node): node is Folder => node.id === page.folderId && node.type === "folder")
      : undefined;
  const folderTint = folderColorValue(folder?.color);

  useEffect(() => {
    document.title = `${page?.title === "" || !page ? "Untitled" : page.title} — Rune`;
  }, [page?.title, page]);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {isMobile && page ? (
          <PageHeaderPhone page={page} />
        ) : (
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
        )}
        <ScrollArea className="min-h-0 w-full flex-1">
          <main className="w-full pt-4 pb-10">
            <div className="flex flex-col gap-2">
              <div className="px-4 md:px-13.5">
                <PageTitle pageId={pageId} />
              </div>
              <Editor pageId={pageId} phone={touch} />
            </div>
          </main>
        </ScrollArea>
        {touch && <EditorBarPhone />}
      </div>
    </div>
  );
}
