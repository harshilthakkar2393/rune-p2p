import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete02Icon,
  Folder01Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";

import { PageCard } from "@/components/page-card";
import { useNodes } from "@/hooks/use-index";
import { rememberFolder } from "@/lib/compose-target";
import { getDeviceName } from "@/lib/device";
import { FOLDER_COLOR_VALUES, folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import { createPage, moveNode, renameNode, trashNode, updateFolderColor } from "@/lib/nodes";
import { readLibraryPrefs, writeLibraryPrefs, type LibraryPrefs } from "@/lib/library-prefs";
import { FOLDER_COLORS, type Folder, type Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { Card } from "@rune/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { SidebarInput } from "@rune/ui/components/sidebar";

export const Route = createFileRoute("/folder/$folderId")({
  component: FolderView,
});

function FolderView() {
  const { folderId } = Route.useParams();
  const nodes = useNodes();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => readLibraryPrefs());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    rememberFolder(folderId);
    setSelected(new Set());
    setRenaming(false);
  }, [folderId]);

  const folder = nodes.find(
    (node): node is Folder =>
      node.id === folderId && node.type === "folder" && node.deletedAt === undefined,
  );
  const otherFolders = nodes.filter(
    (node): node is Folder =>
      node.type === "folder" && node.deletedAt === undefined && node.id !== folderId,
  );

  const pages = useMemo(() => {
    const inFolder = nodes.filter(
      (node): node is Page =>
        node.type === "page" && node.deletedAt === undefined && node.folderId === folderId,
    );
    if (prefs.sort === "updated") return inFolder.toSorted((a, b) => b.updatedAt - a.updatedAt);
    return inFolder.toSorted((a, b) => b.createdAt - a.createdAt);
  }, [nodes, folderId, prefs.sort]);

  if (!folder) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        This folder no longer exists.
      </div>
    );
  }

  const tint = folderColorValue(folder.color);

  const updatePrefs = (patch: Partial<LibraryPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeLibraryPrefs(next);
  };

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const newPage = () => {
    const result = createPage(getNodesMap(), folder.id, {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({ to: "/page/$pageId", params: { pageId: result.value.id } });
    }
  };

  const trashFolder = () => {
    const result = trashNode(getNodesMap(), folder.id);
    if (result.isOk()) void navigate({ to: "/" });
  };

  const moveSelected = (targetId: string) => {
    for (const id of selected) moveNode(getNodesMap(), id, targetId);
    setSelected(new Set());
  };

  const trashSelected = () => {
    for (const id of selected) trashNode(getNodesMap(), id);
    setSelected(new Set());
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-8 pt-6 pb-2">
        {renaming ? (
          <SidebarInput
            autoFocus
            defaultValue={folder.name}
            className="h-10 max-w-sm text-xl"
            onBlur={(event) => {
              if (event.target.value.trim() !== "")
                renameNode(getNodesMap(), folder.id, event.target.value.trim());
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <h1 className="flex items-center gap-3 text-h1">
            <span
              className="size-3 rounded-full"
              style={{ background: tint ?? "var(--muted-foreground)" }}
            />
            {folder.name}
          </h1>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
        <div className="ml-auto flex items-center gap-1.5 self-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sort"
                  className="text-muted-foreground"
                >
                  <HugeiconsIcon icon={Sorting01Icon} strokeWidth={1.75} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup
                value={prefs.sort === "updated" ? "updated" : "newest"}
                onValueChange={(value) => updatePrefs({ sort: value as LibraryPrefs["sort"] })}
              >
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="updated">Recently updated</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Folder actions"
                  className="text-muted-foreground"
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={1.75} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuLabel>Color</DropdownMenuLabel>
                <div className="flex items-center gap-2 px-2 pb-1.5">
                  {FOLDER_COLORS.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      aria-label={`Color ${candidate}`}
                      onClick={() => updateFolderColor(getNodesMap(), folder.id, candidate)}
                      className="flex size-4 items-center justify-center rounded-full"
                      style={{
                        background: FOLDER_COLOR_VALUES[candidate],
                        outline:
                          folder.color === candidate ? "2px solid var(--foreground)" : undefined,
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={trashFolder}>
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              folder={undefined}
              selected={selected.has(page.id)}
              selecting={selected.size > 0}
              trailing={
                <span className="font-mono text-[11px] text-muted-foreground">
                  {humanTime(page.updatedAt)}
                </span>
              }
              onSelectToggle={() => toggleSelect(page.id)}
              onOpen={() => void navigate({ to: "/page/$pageId", params: { pageId: page.id } })}
            />
          ))}
          <Card
            role="button"
            tabIndex={0}
            onClick={newPage}
            onKeyDown={(event) => {
              if (event.key === "Enter") newPage();
            }}
            className="flex h-36 cursor-pointer flex-row items-center justify-center gap-2 border-dashed bg-transparent p-4 text-[13px] text-muted-foreground shadow-none transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4!" />
            New page
          </Card>
        </div>
      </main>

      {selected.size > 0 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[10px] border bg-popover py-1 pr-1 pl-3 shadow-lg">
          <span className="font-mono text-xs">{selected.size} selected</span>
          <span className="mx-2 h-[18px] w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="font-normal">
                  <HugeiconsIcon icon={Folder01Icon} strokeWidth={1.75} />
                  Move
                </Button>
              }
            />
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuGroup>
                {otherFolders.map((target) => (
                  <DropdownMenuItem key={target.id} onClick={() => moveSelected(target.id)}>
                    {target.name}
                  </DropdownMenuItem>
                ))}
                {otherFolders.length === 0 && (
                  <DropdownMenuItem disabled>No other folders</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" className="font-normal" onClick={trashSelected}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
            Trash
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="font-normal text-muted-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
