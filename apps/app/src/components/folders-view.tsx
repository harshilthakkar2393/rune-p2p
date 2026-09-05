import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, File02Icon } from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { NewFolderPopover } from "@/components/new-folder-popover";
import { RootMenu } from "@/components/root-menu";
import { Tip } from "@/components/tip";
import { useNodes } from "@/hooks/use-index";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { Card } from "@rune/ui/components/card";
import { ScrollArea } from "@rune/ui/components/scroll-area";

/**
 * The sidebar's folder list as a screen (`/folders`). The phone has no
 * sidebar, so this is how it reaches folders; the dock's Folders tab lands
 * here. First tile is "All pages" (Apple Notes' "All iCloud"), then one tile
 * per folder, then a ghost tile that creates one. Same tile grid as Pages.
 */
export function FoldersView() {
  const nodes = useNodes();
  const navigate = useNavigate();

  const folders = nodes.filter(
    (node): node is Folder => node.type === "folder" && node.deletedAt === undefined,
  );
  const pages = nodes.filter(
    (node): node is Page => node.type === "page" && node.deletedAt === undefined,
  );

  const stats = useMemo(() => {
    const byFolder = new Map<string, { count: number; latest: number }>();
    for (const page of pages) {
      if (page.folderId === null) continue;
      const entry = byFolder.get(page.folderId) ?? { count: 0, latest: 0 };
      byFolder.set(page.folderId, {
        count: entry.count + 1,
        latest: Math.max(entry.latest, page.updatedAt),
      });
    }
    return byFolder;
  }, [pages]);

  const newFolderTile = (
    <NewFolderPopover
      trigger={
        <Card
          role="button"
          tabIndex={0}
          className="flex h-28 cursor-pointer flex-row items-center justify-center gap-2 border border-dashed bg-transparent p-4 ring-0 text-small text-muted-foreground shadow-none transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4!" />
          New folder
        </Card>
      }
    />
  );

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-4 md:px-8 pt-3 pb-2 max-md:h-14 max-md:items-center max-md:py-0">
        <h1 className="text-h1">Folders</h1>
        <span className="font-mono text-tiny text-muted-foreground">
          {folders.length} {folders.length === 1 ? "folder" : "folders"}
        </span>
        <div className="ml-auto hidden items-center gap-1.5 self-center md:flex">
          <NewFolderPopover
            trigger={
              <Tip label="New folder">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="New folder"
                  className="text-muted-foreground"
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} />
                </Button>
              </Tip>
            }
          />
        </div>
        <RootMenu />
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 md:px-8 py-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-3">
            <FolderTile
              icon={<HugeiconsIcon icon={File02Icon} strokeWidth={1.75} className="size-4.5!" />}
              name="All pages"
              meta={`${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
              onActivate={() => void navigate({ to: "/pages" })}
            />
            {folders.map((folder) => {
              const stat = stats.get(folder.id);
              const count = stat?.count ?? 0;
              return (
                <FolderTile
                  key={folder.id}
                  icon={
                    <FolderGlyph
                      className="size-4.5"
                      color={folderColorValue(folder.color) ?? "var(--muted-foreground)"}
                    />
                  }
                  name={folder.name}
                  meta={`${count} ${count === 1 ? "page" : "pages"}`}
                  trailing={stat ? humanTime(stat.latest) : undefined}
                  onActivate={() =>
                    void navigate({ to: "/folders/$folderId", params: { folderId: folder.id } })
                  }
                />
              );
            })}
            {newFolderTile}
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}

function FolderTile({
  icon,
  name,
  meta,
  trailing,
  onActivate,
}: {
  icon: React.ReactNode;
  name: string;
  meta: string;
  trailing?: string;
  onActivate: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter") onActivate();
      }}
      className="flex h-28 cursor-pointer flex-col justify-between p-4 text-left shadow-none transition-colors hover:bg-accent/40"
    >
      <span className="flex h-5 items-center text-foreground">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="truncate text-sm leading-5">{name}</span>
        <span className="flex items-center gap-2 font-mono text-tiny leading-4 text-muted-foreground">
          <span>{meta}</span>
          {trailing && <span className="ml-auto">{trailing}</span>}
        </span>
      </span>
    </Card>
  );
}
