import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon, SidebarRight01Icon } from "@hugeicons/core-free-icons";

import { Editor } from "@/components/editor";
import { PageInspector } from "@/components/page-inspector";
import { PageTitle } from "@/components/page-title";
import { useNodes } from "@/hooks/use-index";
import { folderColorValue } from "@/lib/folder-colors";
import { recordOpen } from "@/lib/recents";
import type { Folder, Page } from "@/lib/schema";

export const Route = createFileRoute("/page/$pageId")({ component: PageView });

const INSPECTOR_KEY = "rune-inspector-open";

function readInspectorOpen(): boolean {
  try {
    return localStorage.getItem(INSPECTOR_KEY) !== "closed";
  } catch {
    return true;
  }
}

function PageView() {
  const { pageId } = Route.useParams();
  const nodes = useNodes();
  const [inspectorOpen, setInspectorOpen] = useState(() => readInspectorOpen());

  useEffect(() => {
    recordOpen(pageId);
  }, [pageId]);

  const page = nodes.find((node): node is Page => node.id === pageId && node.type === "page");
  const folder =
    page && page.folderId !== null
      ? nodes.find((node): node is Folder => node.id === page.folderId && node.type === "folder")
      : undefined;
  const folderTint = folderColorValue(folder?.color);

  const toggleInspector = () => {
    const next = !inspectorOpen;
    setInspectorOpen(next);
    try {
      localStorage.setItem(INSPECTOR_KEY, next ? "open" : "closed");
    } catch {
      // per-device convenience only
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[44px] shrink-0 items-center gap-2 border-b px-4 text-[13px] text-muted-foreground">
          {folder && (
            <>
              <HugeiconsIcon
                icon={Folder01Icon}
                strokeWidth={1.75}
                className="size-4!"
                style={folderTint ? { color: folderTint } : undefined}
              />
              <span className="max-w-40 truncate">{folder.name}</span>
              <span className="text-muted-foreground/50">›</span>
            </>
          )}
          <span className="truncate text-foreground">
            {page ? (page.title === "" ? "Untitled" : page.title) : ""}
          </span>
          <button
            type="button"
            aria-label={inspectorOpen ? "Hide page info" : "Show page info"}
            onClick={toggleInspector}
            className="ml-auto flex size-[30px] items-center justify-center rounded-md hover:bg-secondary/60"
          >
            <HugeiconsIcon icon={SidebarRight01Icon} strokeWidth={1.75} className="size-4!" />
          </button>
        </header>
        <main className="w-full flex-1 overflow-y-auto py-6 px-8">
          <div className="flex flex-col gap-4">
            <div className="px-1">
              <PageTitle pageId={pageId} />
            </div>
            <Editor pageId={pageId} />
          </div>
        </main>
      </div>
      {inspectorOpen && page && <PageInspector page={page} folder={folder} />}
    </div>
  );
}
