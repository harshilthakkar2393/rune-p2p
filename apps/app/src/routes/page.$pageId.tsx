import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon, LayoutAlignRightIcon } from "@hugeicons/core-free-icons";

import { Editor } from "@/components/editor";
import { PageTitle } from "@/components/page-title";
import { useNodes } from "@/hooks/use-index";
import { folderColorValue } from "@/lib/folder-colors";
import { setInspectorPage, toggleInspector, useInspector } from "@/lib/inspector";
import { recordOpen } from "@/lib/recents";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";

export const Route = createFileRoute("/page/$pageId")({ component: PageView });

function PageView() {
  const { pageId } = Route.useParams();
  const nodes = useNodes();
  const { open: inspectorOpen } = useInspector();

  useEffect(() => {
    recordOpen(pageId);
    setInspectorPage(pageId);
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
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted-foreground">
              <HugeiconsIcon
                icon={Folder01Icon}
                strokeWidth={1.75}
                className="size-4!"
                style={folderTint ? { color: folderTint } : undefined}
              />
              <span className="max-w-40 truncate">{folder.name}</span>
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-muted-foreground"
            aria-label={inspectorOpen ? "Hide page info" : "Show page info"}
            onClick={() => toggleInspector()}
          >
            <HugeiconsIcon icon={LayoutAlignRightIcon} strokeWidth={1.75} />
          </Button>
        </header>
        <main className="w-full flex-1 overflow-y-auto pt-4 pb-10">
          <div className="flex flex-col gap-2">
            <div className="px-[54px]">
              <PageTitle pageId={pageId} />
            </div>
            <Editor pageId={pageId} />
          </div>
        </main>
      </div>
    </div>
  );
}
