import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  FilterMailIcon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { PageCard, type CardAction } from "@/components/page-card";
import { PhoneAction, RootMenu } from "@/components/root-menu";
import { SelectionBar, SelectionBarButton } from "@/components/selection-bar";
import { Tip } from "@/components/tip";
import { useNodes } from "@/hooks/use-index";
import { useSelection } from "@/hooks/use-selection";
import { composeTargetFolderId } from "@/lib/compose-target";
import { DATE_PRESETS, presetLabel, withinPreset, type DatePresetId } from "@/lib/date-presets";
import { getDeviceName } from "@/lib/device";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import { createPage, moveNode, trashNode } from "@/lib/nodes";
import { readLibraryPrefs, writeLibraryPrefs, type LibraryPrefs } from "@/lib/library-prefs";
import type { Folder, Page } from "@/lib/schema";
import { Badge } from "@rune/ui/components/badge";
import { Card } from "@rune/ui/components/card";
import { Button } from "@rune/ui/components/button";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Library — Rune" }] }),
  component: LibraryView,
});

function LibraryView() {
  const nodes = useNodes();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => readLibraryPrefs());
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DatePresetId | null>(null);

  const updatePrefs = (patch: Partial<LibraryPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeLibraryPrefs(next);
  };

  const folders = nodes.filter(
    (node): node is Folder => node.type === "folder" && node.deletedAt === undefined,
  );
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));

  const pages = useMemo(() => {
    let live = nodes.filter(
      (node): node is Page => node.type === "page" && node.deletedAt === undefined,
    );
    if (folderFilter !== null) {
      live = live.filter((page) => page.folderId === folderFilter);
    }
    if (dateFilter !== null) {
      live = live.filter((page) => withinPreset(page.updatedAt, dateFilter));
    }
    if (prefs.sort === "updated") return live.toSorted((a, b) => b.updatedAt - a.updatedAt);
    return live.toSorted((a, b) => b.createdAt - a.createdAt);
  }, [nodes, folderFilter, dateFilter, prefs.sort]);

  const selection = useSelection(pages.map((page) => page.id));
  const { selected, selecting } = selection;

  const trashSelected = () => {
    for (const id of selected) trashNode(getNodesMap(), id);
    selection.clear();
  };

  const moveSelected = (folderId: string) => {
    for (const id of selected) moveNode(getNodesMap(), id, folderId);
    selection.clear();
  };

  const newPage = () => {
    const map = getNodesMap();
    const result = createPage(map, folderFilter ?? composeTargetFolderId(map), {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({ to: "/page/$pageId", params: { pageId: result.value.id } });
    }
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

  const activeFolder = folderFilter !== null ? folderById.get(folderFilter) : undefined;

  const filterItems = (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Date</DropdownMenuLabel>
        {DATE_PRESETS.map((preset) => (
          <DropdownMenuCheckboxItem
            key={preset.id}
            checked={dateFilter === preset.id}
            onCheckedChange={() => setDateFilter(dateFilter === preset.id ? null : preset.id)}
          >
            {preset.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Folder</DropdownMenuLabel>
        {folders.map((folder) => (
          <DropdownMenuCheckboxItem
            key={folder.id}
            checked={folderFilter === folder.id}
            onCheckedChange={() => setFolderFilter(folderFilter === folder.id ? null : folder.id)}
          >
            {folder.name}
          </DropdownMenuCheckboxItem>
        ))}
        {folders.length === 0 && <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>}
      </DropdownMenuGroup>
    </>
  );
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

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-4 md:px-8 pt-3 pb-2 max-md:h-14 max-md:items-center max-md:py-0">
        <h1 className="text-h1">Library</h1>
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
            <Tip label="Filter">
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Filter"
                    className="text-muted-foreground"
                  >
                    <HugeiconsIcon icon={FilterMailIcon} strokeWidth={1.75} />
                  </Button>
                }
              />
            </Tip>
            <DropdownMenuContent align="end" className="w-52">
              {filterItems}
            </DropdownMenuContent>
          </DropdownMenu>

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
              <HugeiconsIcon icon={FilterMailIcon} strokeWidth={1.75} />
              Filter
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{filterItems}</DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={Sorting01Icon} strokeWidth={1.75} />
              Sort
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{sortItems}</DropdownMenuSubContent>
          </DropdownMenuSub>
        </RootMenu>
      </header>

      {(activeFolder !== undefined || dateFilter !== null) && (
        <div className="flex w-full shrink-0 items-center gap-2 px-4 md:px-8 pt-2">
          {dateFilter !== null && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1.5 font-normal"
              onClick={() => setDateFilter(null)}
            >
              {presetLabel(dateFilter)}
              <span className="text-muted-foreground">×</span>
            </Badge>
          )}
          {activeFolder !== undefined && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1.5 font-normal"
              onClick={() => setFolderFilter(null)}
            >
              {folderColorValue(activeFolder.color) && (
                <span
                  className="size-1.75 rounded-full"
                  style={{ background: folderColorValue(activeFolder.color) }}
                />
              )}
              {activeFolder.name}
              <span className="text-muted-foreground">×</span>
            </Badge>
          )}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 md:px-8 py-4">
          <div className="w-full">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {pages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  folder={page.folderId !== null ? folderById.get(page.folderId) : undefined}
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
          </div>
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
              {folders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => moveSelected(folder.id)}>
                  <FolderGlyph
                    className="size-4"
                    color={folderColorValue(folder.color) ?? "var(--muted-foreground)"}
                  />
                  {folder.name}
                </DropdownMenuItem>
              ))}
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
