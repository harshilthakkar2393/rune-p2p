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
import { useNodes } from "@/hooks/use-index";
import { useSelection } from "@/hooks/use-selection";
import { composeTargetFolderId } from "@/lib/compose-target";
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
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";

export const Route = createFileRoute("/library")({ component: LibraryView });

const DATE_PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "week", label: "This week", days: 7 },
  { id: "month", label: "This month", days: 31 },
] as const;

type DatePresetId = (typeof DATE_PRESETS)[number]["id"];

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = items.slice();
  let state = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    state = (state * 9301 + 49297) % 233280;
    const j = Math.floor((state / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

function LibraryView() {
  const nodes = useNodes();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => readLibraryPrefs());
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DatePresetId | null>(null);
  const [randomSeed] = useState(() => Date.now() % 233280);

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
      const preset = DATE_PRESETS.find((candidate) => candidate.id === dateFilter);
      if (preset) {
        const cutoff = Date.now() - preset.days * 24 * 60 * 60 * 1000;
        live = live.filter((page) => page.updatedAt >= cutoff);
      }
    }
    if (prefs.sort === "newest") return live.toSorted((a, b) => b.createdAt - a.createdAt);
    if (prefs.sort === "updated") return live.toSorted((a, b) => b.updatedAt - a.updatedAt);
    return seededShuffle(live, randomSeed);
  }, [nodes, folderFilter, dateFilter, prefs.sort, randomSeed]);

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

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-8 pt-6 pb-2">
        <h1 className="text-h1">Library</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
        <div className="ml-auto flex items-center gap-1.5 self-center">
          <Button
            variant={selecting ? "secondary" : "ghost"}
            size="icon"
            aria-label="Select"
            className={selecting ? undefined : "text-muted-foreground"}
            onClick={selection.toggleMode}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.75} />
          </Button>
          <DropdownMenu>
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Date</DropdownMenuLabel>
                {DATE_PRESETS.map((preset) => (
                  <DropdownMenuCheckboxItem
                    key={preset.id}
                    checked={dateFilter === preset.id}
                    onCheckedChange={() =>
                      setDateFilter(dateFilter === preset.id ? null : preset.id)
                    }
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
                    onCheckedChange={() =>
                      setFolderFilter(folderFilter === folder.id ? null : folder.id)
                    }
                  >
                    {folder.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {folders.length === 0 && (
                  <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

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
                value={prefs.sort}
                onValueChange={(value) => updatePrefs({ sort: value as LibraryPrefs["sort"] })}
              >
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="updated">Recently updated</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="random">Random</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {(activeFolder !== undefined || dateFilter !== null) && (
        <div className="flex w-full shrink-0 items-center gap-2 px-8 pt-2">
          {dateFilter !== null && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1.5 font-normal"
              onClick={() => setDateFilter(null)}
            >
              {DATE_PRESETS.find((preset) => preset.id === dateFilter)?.label}
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
                  className="size-[7px] rounded-full"
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
        <main className="px-8 py-4">
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
                    <span className="font-mono text-[11px] text-muted-foreground">
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
                className="flex h-36 cursor-pointer flex-row items-center justify-center gap-2 border-dashed bg-transparent p-4 text-[13px] text-muted-foreground shadow-none transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4!" />
                New page
              </Card>
            </div>
          </div>
        </main>
      </ScrollArea>

      {selected.size > 0 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[10px] border bg-popover py-1 pr-1 pl-3 shadow-lg">
          <span className="font-mono text-xs">{selected.size} selected</span>
          <span className="mx-2 h-[18px] w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="font-normal">
                  <FolderGlyph className="size-4" />
                  Move
                </Button>
              }
            />
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuGroup>
                {folders.map((folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => moveSelected(folder.id)}>
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="font-normal text-destructive hover:text-destructive"
            onClick={trashSelected}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
            Trash
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="font-normal text-muted-foreground"
            onClick={selection.clear}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
