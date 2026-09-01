import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete02Icon,
  FilterHorizontalIcon,
  Folder01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { PageCard } from "@/components/page-card";
import { useNodes } from "@/hooks/use-index";
import { getDeviceName } from "@/lib/device";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import {
  createPage,
  moveNode,
  trashNode,
} from "@/lib/nodes";
import {
  readLibraryPrefs,
  writeLibraryPrefs,
  type LibraryPrefs,
} from "@/lib/library-prefs";
import type { Folder, Page } from "@/lib/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rune/ui/components/popover";
import { Switch } from "@rune/ui/components/switch";
import { cn } from "@rune/ui/lib/utils";

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

function MenuRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px]",
        active ? "bg-secondary" : "text-muted-foreground hover:bg-secondary/60",
      )}
    >
      {label}
      {active && (
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="ml-auto size-3.5!" />
      )}
    </button>
  );
}

function LibraryView() {
  const nodes = useNodes();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => readLibraryPrefs());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
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
    if (prefs.sort === "newest")
      return live.toSorted((a, b) => b.createdAt - a.createdAt);
    if (prefs.sort === "updated")
      return live.toSorted((a, b) => b.updatedAt - a.updatedAt);
    return seededShuffle(live, randomSeed);
  }, [nodes, folderFilter, dateFilter, prefs.sort, randomSeed]);

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const trashSelected = () => {
    for (const id of selected) trashNode(getNodesMap(), id);
    clearSelection();
  };

  const moveSelected = (folderId: string | null) => {
    for (const id of selected) moveNode(getNodesMap(), id, folderId);
    clearSelection();
  };

  const newPage = () => {
    const result = createPage(getNodesMap(), folderFilter, {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({ to: "/page/$pageId", params: { pageId: result.value.id } });
    }
  };

  const openPage = (pageId: string) => {
    void navigate({ to: "/page/$pageId", params: { pageId } });
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b px-6">
        <span className="text-[15px]">Library</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex h-[30px] items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-secondary/60"
                >
                  <HugeiconsIcon
                    icon={FilterHorizontalIcon}
                    strokeWidth={1.75}
                    className="size-4!"
                  />
                  Filter
                </button>
              }
            />
            <PopoverContent align="end" className="w-56 p-2">
              <div className="flex flex-col gap-2">
                <span className="px-2 pt-1 text-[11px] text-muted-foreground">
                  Date
                </span>
                {DATE_PRESETS.map((preset) => (
                  <MenuRow
                    key={preset.id}
                    label={preset.label}
                    active={dateFilter === preset.id}
                    onClick={() =>
                      setDateFilter(dateFilter === preset.id ? null : preset.id)
                    }
                  />
                ))}
                <span className="border-t px-2 pt-2 text-[11px] text-muted-foreground">
                  Folder
                </span>
                {folders.map((folder) => (
                  <MenuRow
                    key={folder.id}
                    label={folder.name}
                    active={folderFilter === folder.id}
                    onClick={() =>
                      setFolderFilter(folderFilter === folder.id ? null : folder.id)
                    }
                  />
                ))}
                {folders.length === 0 && (
                  <span className="px-2 pb-1 text-[12px] text-muted-foreground/60">
                    No folders yet
                  </span>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex h-[30px] items-center gap-1.5 rounded-md bg-secondary px-2.5 text-[13px]"
                >
                  Display
                  <span className="rounded border bg-background px-1 font-mono text-[11px] text-muted-foreground">
                    ⇧⌘D
                  </span>
                </button>
              }
            />
            <PopoverContent align="end" className="w-60 p-2.5">
              <div className="flex flex-col gap-2.5 text-[13px]">
                <span className="text-[11px] text-muted-foreground">Sort</span>
                <div className="flex flex-col gap-0.5">
                  <MenuRow
                    label="Newest first"
                    active={prefs.sort === "newest"}
                    onClick={() => updatePrefs({ sort: "newest" })}
                  />
                  <MenuRow
                    label="Recently updated"
                    active={prefs.sort === "updated"}
                    onClick={() => updatePrefs({ sort: "updated" })}
                  />
                  <MenuRow
                    label="Random"
                    active={prefs.sort === "random"}
                    onClick={() => updatePrefs({ sort: "random" })}
                  />
                </div>
                <span className="border-t pt-2.5 text-[11px] text-muted-foreground">
                  Layout
                </span>
                <div className="flex flex-col gap-0.5">
                  <MenuRow
                    label="Gallery"
                    active={prefs.layout === "gallery"}
                    onClick={() => updatePrefs({ layout: "gallery" })}
                  />
                  <MenuRow
                    label="List"
                    active={prefs.layout === "list"}
                    onClick={() => updatePrefs({ layout: "list" })}
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span>Show previews</span>
                  <Switch
                    checked={prefs.showPreviews}
                    onCheckedChange={(checked) =>
                      updatePrefs({ showPreviews: checked === true })
                    }
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {(folderFilter !== null || dateFilter !== null) && (
        <div className="flex shrink-0 items-center gap-2 px-6 pt-3">
          {dateFilter !== null && (
            <button
              type="button"
              onClick={() => setDateFilter(null)}
              className="flex items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 text-xs"
            >
              {DATE_PRESETS.find((preset) => preset.id === dateFilter)?.label}
              <span className="text-muted-foreground">×</span>
            </button>
          )}
          {folderFilter !== null && (
            <button
              type="button"
              onClick={() => setFolderFilter(null)}
              className="flex items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 text-xs"
            >
              {(() => {
                const folder = folderById.get(folderFilter);
                const tint = folderColorValue(folder?.color);
                return (
                  <>
                    {tint && (
                      <span
                        className="size-[7px] rounded-full"
                        style={{ background: tint }}
                      />
                    )}
                    {folder?.name}
                  </>
                );
              })()}
              <span className="text-muted-foreground">×</span>
            </button>
          )}
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-6 py-5">
        {prefs.layout === "gallery" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                folder={
                  page.folderId !== null ? folderById.get(page.folderId) : undefined
                }
                selected={selected.has(page.id)}
                selecting={selected.size > 0}
                showPreview={prefs.showPreviews}
                trailing={
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {humanTime(page.updatedAt)}
                  </span>
                }
                onSelectToggle={() => toggleSelect(page.id)}
                onOpen={() => openPage(page.id)}
              />
            ))}
            <button
              type="button"
              onClick={newPage}
              className="flex min-h-[166px] items-center justify-center gap-2 rounded-[10px] border border-dashed text-[13px] text-muted-foreground hover:border-foreground/25 hover:text-foreground"
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4!" />
              New page
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {pages.map((page) => {
              const folder =
                page.folderId !== null ? folderById.get(page.folderId) : undefined;
              const tint = folderColorValue(folder?.color);
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() =>
                    selected.size > 0 ? toggleSelect(page.id) : openPage(page.id)
                  }
                  className={cn(
                    "flex h-12 items-center gap-3 border-b px-3 text-left last:border-0",
                    selected.has(page.id) ? "bg-secondary/60" : "hover:bg-secondary/40",
                  )}
                >
                  <span className="w-1/3 truncate text-sm">
                    {page.title === "" ? "Untitled" : page.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {tint && (
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: tint }}
                      />
                    )}
                    {folder?.name ?? "—"}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {humanTime(page.updatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {selected.size > 0 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[10px] border bg-popover px-3.5 py-2 shadow-lg">
          <button
            type="button"
            onClick={clearSelection}
            className="text-muted-foreground"
            aria-label="Clear selection"
          >
            ×
          </button>
          <span className="font-mono text-xs">{selected.size} selected</span>
          <span className="h-[18px] w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[13px] text-foreground/85"
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    strokeWidth={1.75}
                    className="size-4!"
                  />
                  Move
                </button>
              }
            />
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => moveSelected(null)}>
                  Library root
                </DropdownMenuItem>
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => moveSelected(folder.id)}
                  >
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={trashSelected}
            className="flex items-center gap-1.5 text-[13px] text-foreground/85"
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} className="size-4!" />
            Trash
          </button>
        </div>
      )}
    </div>
  );
}
