import { useState } from "react";
import {
  ArrowTurnBackwardIcon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  FilterMailIcon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";

import { PageCard, type CardAction } from "@/components/page-card";
import { SelectionBar, SelectionBarButton } from "@/components/selection-bar";
import { Tip } from "@/components/tip";
import { useNodes } from "@/hooks/use-index";
import { useSelection } from "@/hooks/use-selection";
import { DATE_PRESETS, presetLabel, withinPreset, type DatePresetId } from "@/lib/date-presets";
import { folderColorValue } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { listTrashed, removeNode, restoreNode } from "@/lib/nodes";
import { destroyPageDoc } from "@/lib/page-doc";
import { TRASH_RETENTION_MS, type Folder, type Page } from "@/lib/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rune/ui/components/alert-dialog";
import { Badge } from "@rune/ui/components/badge";
import { Button } from "@rune/ui/components/button";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@rune/ui/components/empty";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { cn } from "@rune/ui/lib/utils";

export const Route = createFileRoute("/trash")({ component: TrashView });

type TrashSort = "deleted" | "expiring";

function daysLeft(deletedAt: number): number {
  const expires = deletedAt + TRASH_RETENTION_MS;
  return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));
}

function deleteForever(ids: string[]) {
  const map = getNodesMap();
  for (const id of ids) {
    const result = removeNode(map, id);
    if (result.isOk()) {
      for (const pageId of result.value.removedPageIds) {
        void destroyPageDoc(pageId);
      }
    }
  }
}

function TrashView() {
  const nodes = useNodes();
  const [confirming, setConfirming] = useState<"selection" | "all" | null>(null);
  const [sort, setSort] = useState<TrashSort>("deleted");
  const [dateFilter, setDateFilter] = useState<DatePresetId | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  // useNodes gives us reactivity; listTrashed reads the same map for order.
  void nodes;
  const trashed = listTrashed(getNodesMap());
  const folderById = new Map(
    nodes
      .filter((node): node is Folder => node.type === "folder")
      .map((folder) => [folder.id, folder]),
  );

  const byDeleted = (a: { deletedAt?: number }, b: { deletedAt?: number }) =>
    sort === "deleted"
      ? (b.deletedAt ?? 0) - (a.deletedAt ?? 0)
      : (a.deletedAt ?? 0) - (b.deletedAt ?? 0);
  const inWindow = (node: { deletedAt?: number }) =>
    dateFilter === null || withinPreset(node.deletedAt ?? 0, dateFilter);

  const allPages = trashed.filter((node): node is Page => node.type === "page");
  const folderIdsWithPages = new Set(allPages.map((page) => page.folderId));
  const filterFolders = [...folderById.values()].filter((folder) =>
    folderIdsWithPages.has(folder.id),
  );

  const trashedPages = allPages
    .filter(inWindow)
    .filter((page) => folderFilter === null || page.folderId === folderFilter)
    .toSorted(byDeleted);
  // A folder filter means "pages from X"; folder tiles step aside for it.
  const trashedFolders =
    folderFilter === null
      ? trashed
          .filter((node): node is Folder => node.type === "folder")
          .filter(inWindow)
          .toSorted(byDeleted)
      : [];

  const selection = useSelection([
    ...trashedFolders.map((folder) => folder.id),
    ...trashedPages.map((page) => page.id),
  ]);
  const { selected, selecting, setSelected } = selection;
  const activeFolder = folderFilter !== null ? folderById.get(folderFilter) : undefined;
  const filtered = dateFilter !== null || activeFolder !== undefined;

  const trashActions = (pageId: string): CardAction[] => [
    {
      label: "Restore",
      icon: ArrowTurnBackwardIcon,
      onSelect: () => void restoreNode(getNodesMap(), pageId),
    },
    "separator",
    {
      label: "Delete forever",
      icon: Delete02Icon,
      destructive: true,
      onSelect: () => {
        setSelected(new Set([pageId]));
        setConfirming("selection");
      },
    },
  ];

  const restoreSelected = () => {
    for (const id of selected) restoreNode(getNodesMap(), id);
    selection.clear();
  };

  const confirmDelete = () => {
    if (confirming === "selection") {
      deleteForever([...selected]);
      selection.clear();
    } else if (confirming === "all") {
      deleteForever(trashed.map((node) => node.id));
      selection.clear();
    }
    setConfirming(null);
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-8 pt-3 pb-2">
        <h1 className="text-h1">Trash</h1>
        <span className="font-mono text-tiny text-muted-foreground">
          deleted forever after 30 days
        </span>
        <div className="ml-auto flex items-center gap-1.5 self-center">
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
              <DropdownMenuGroup>
                <DropdownMenuLabel>Deleted</DropdownMenuLabel>
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
                <DropdownMenuLabel>From folder</DropdownMenuLabel>
                {filterFolders.map((folder) => (
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
                {filterFolders.length === 0 && (
                  <DropdownMenuItem disabled>No trashed pages</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
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
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(value as TrashSort)}
              >
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuRadioItem value="deleted">Recently deleted</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="expiring">Expiring soon</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {trashed.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setConfirming("all")}>
              Empty trash
            </Button>
          )}
        </div>
      </header>

      {filtered && (
        <div className="flex w-full shrink-0 items-center gap-2 px-8 pt-2">
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
        <main className="px-8 py-4">
          {trashed.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Trash is empty</EmptyTitle>
                <EmptyDescription>
                  Pages you trash wait here for 30 days before disappearing.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : trashedFolders.length + trashedPages.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing matches</EmptyTitle>
                <EmptyDescription>
                  Clear the filters to see everything in the trash.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {trashedFolders.map((folder) => {
                const tint = folderColorValue(folder.color);
                const isSelected = selected.has(folder.id);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => selection.toggle(folder.id)}
                    className={cn(
                      "flex h-15.5 items-center gap-3 rounded-xl border bg-card px-3.5 text-left",
                      isSelected ? "border-foreground/50" : "hover:border-foreground/20",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: tint ?? "var(--muted-foreground)" }}
                    />
                    <span className="truncate text-sm">{folder.name}</span>
                    <span className="ml-auto rounded-full border px-2 py-0.5 font-mono text-tiny text-foreground/85">
                      {daysLeft(folder.deletedAt ?? 0)}d left
                    </span>
                  </button>
                );
              })}
              {trashedPages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  folder={page.folderId !== null ? folderById.get(page.folderId) : undefined}
                  selected={selected.has(page.id)}
                  selecting={selecting}
                  dim
                  actions={trashActions(page.id)}
                  trailing={
                    <span className="rounded-full border px-2 py-0.5 font-mono text-tiny text-foreground/85">
                      {daysLeft(page.deletedAt ?? 0)}d left
                    </span>
                  }
                  onSelectToggle={() => selection.toggle(page.id)}
                />
              ))}
            </div>
          )}
        </main>
      </ScrollArea>

      <SelectionBar count={selected.size} onClear={selection.clear}>
        <SelectionBarButton onClick={restoreSelected}>
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={1.75} />
          Restore
        </SelectionBarButton>
        <SelectionBarButton
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirming("selection")}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
          Delete forever
        </SelectionBarButton>
      </SelectionBar>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "all"
                ? "Empty the trash?"
                : `Delete ${selected.size} ${selected.size === 1 ? "item" : "items"} forever?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the {confirming === "all" ? "trashed" : "selected"} pages and
              their content. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
