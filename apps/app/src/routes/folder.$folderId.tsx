import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { EmptyState } from "@/components/empty-state";
import { PageCard, type CardAction } from "@/components/page-card";
import { PhoneAction, RootMenu } from "@/components/root-menu";
import { SelectionBar, SelectionBarButton } from "@/components/selection-bar";
import { Tip } from "@/components/tip";
import { useNodes } from "@/hooks/use-index";
import { useSelection } from "@/hooks/use-selection";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { SidebarInput } from "@rune/ui/components/sidebar";

export const Route = createFileRoute("/folder/$folderId")({
  component: FolderView,
});

function FolderView() {
  const { folderId } = Route.useParams();
  const nodes = useNodes();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => readLibraryPrefs());
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    rememberFolder(folderId);
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

  useEffect(() => {
    document.title = `${folder?.name ?? "Folder"} — Rune`;
  }, [folder?.name]);

  const pages = useMemo(() => {
    const inFolder = nodes.filter(
      (node): node is Page =>
        node.type === "page" && node.deletedAt === undefined && node.folderId === folderId,
    );
    if (prefs.sort === "updated") return inFolder.toSorted((a, b) => b.updatedAt - a.updatedAt);
    return inFolder.toSorted((a, b) => b.createdAt - a.createdAt);
  }, [nodes, folderId, prefs.sort]);

  const selection = useSelection(pages.map((page) => page.id));
  const { selected, selecting } = selection;

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
    selection.clear();
  };

  const trashSelected = () => {
    for (const id of selected) trashNode(getNodesMap(), id);
    selection.clear();
  };

  const openPage = (pageId: string) => {
    void navigate({ to: "/page/$pageId", params: { pageId } });
  };

  const pageActions = (pageId: string): CardAction[] => [
    { label: "Open", icon: ArrowUpRight01Icon, onSelect: () => openPage(pageId) },
    "separator",
    {
      label: "Move to trash",
      icon: Delete02Icon,
      destructive: true,
      onSelect: () => void trashNode(getNodesMap(), pageId),
    },
  ];

  const sortItems = (
    <>
      <DropdownMenuRadioGroup
        value={prefs.sort}
        onValueChange={(value) => updatePrefs({ sort: value as LibraryPrefs["sort"] })}
      >
        <DropdownMenuLabel>Sort</DropdownMenuLabel>
        <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="updated">Recently updated</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
  const folderItems = (
    <>
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
                outline: folder.color === candidate ? "2px solid var(--foreground)" : undefined,
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={trashFolder}>
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
        Move to trash
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-4 md:px-8 pt-3 pb-2 max-md:h-14 max-md:items-center max-md:py-0">
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
        <span className="font-mono text-tiny text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
        <div className="ml-auto hidden items-center gap-1.5 self-center md:flex">
          <Tip label={selecting ? "Done selecting" : "Select"}>
            <Button
              variant={selecting ? "secondary" : "ghost"}
              size="icon"
              aria-label="Select"
              className={selecting ? undefined : "text-muted-foreground"}
              onClick={selection.toggleMode}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.75} />
            </Button>
          </Tip>
          <DropdownMenu>
            <Tip label="Sort">
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
            </Tip>
            <DropdownMenuContent align="end" className="w-48">
              {sortItems}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tip label="Folder actions">
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
            </Tip>
            <DropdownMenuContent align="end" className="w-52">
              {folderItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <RootMenu
          action={
            <PhoneAction
              label={selecting ? "Done selecting" : "Select"}
              active={selecting}
              onClick={selection.toggleMode}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.75} />
            </PhoneAction>
          }
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={Sorting01Icon} strokeWidth={1.75} />
              Sort
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{sortItems}</DropdownMenuSubContent>
          </DropdownMenuSub>
          {folderItems}
        </RootMenu>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 md:px-8 py-4">
          {pages.length === 0 ? (
            <EmptyState
              icon={
                <FolderGlyph
                  className="size-5"
                  color={folderColorValue(folder.color) ?? "var(--muted-foreground)"}
                />
              }
              title={`Nothing in ${folder.name} yet`}
              description="Pages you create here stay in this folder on every device."
              action={<Button onClick={newPage}>New page</Button>}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {pages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  folder={undefined}
                  selected={selected.has(page.id)}
                  selecting={selecting}
                  trailing={
                    <span className="font-mono text-tiny text-muted-foreground">
                      {humanTime(page.updatedAt)}
                    </span>
                  }
                  actions={pageActions(page.id)}
                  onSelectToggle={() => selection.toggle(page.id)}
                  onActivate={(event) =>
                    selection.handleCardClick(page.id, event, () => openPage(page.id))
                  }
                />
              ))}
              <Card
                role="button"
                tabIndex={0}
                onClick={newPage}
                onKeyDown={(event) => {
                  if (event.key === "Enter") newPage();
                }}
                className="flex h-36 cursor-pointer flex-row items-center justify-center gap-2 border border-dashed bg-transparent p-4 ring-0 text-small text-muted-foreground shadow-none transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4!" />
                New page
              </Card>
            </div>
          )}
        </main>
      </ScrollArea>

      <SelectionBar count={selected.size} onClear={selection.clear}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SelectionBarButton>
                <FolderGlyph className="size-4" />
                Move
              </SelectionBarButton>
            }
          />
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuGroup>
              {otherFolders.map((target) => (
                <DropdownMenuItem key={target.id} onClick={() => moveSelected(target.id)}>
                  <FolderGlyph
                    className="size-4"
                    color={folderColorValue(target.color) ?? "var(--muted-foreground)"}
                  />
                  {target.name}
                </DropdownMenuItem>
              ))}
              {otherFolders.length === 0 && (
                <DropdownMenuItem disabled>No other folders</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <SelectionBarButton variant="destructive" onClick={trashSelected}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
          Trash
        </SelectionBarButton>
      </SelectionBar>
    </div>
  );
}
