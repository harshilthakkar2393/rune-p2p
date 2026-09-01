import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageCard } from "@/components/page-card";
import { useNodes } from "@/hooks/use-index";
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
import { Button } from "@rune/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@rune/ui/components/empty";
import { cn } from "@rune/ui/lib/utils";

export const Route = createFileRoute("/trash")({ component: TrashView });

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
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<"selection" | "all" | null>(null);

  // useNodes gives us reactivity; listTrashed reads the same map for order.
  void nodes;
  const trashed = listTrashed(getNodesMap());
  const folderById = new Map(
    nodes
      .filter((node): node is Folder => node.type === "folder")
      .map((folder) => [folder.id, folder]),
  );

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restoreSelected = () => {
    for (const id of selected) restoreNode(getNodesMap(), id);
    setSelected(new Set());
  };

  const confirmDelete = () => {
    if (confirming === "selection") {
      deleteForever([...selected]);
      setSelected(new Set());
    } else if (confirming === "all") {
      deleteForever(trashed.map((node) => node.id));
      setSelected(new Set());
    }
    setConfirming(null);
  };

  const trashedPages = trashed.filter((node): node is Page => node.type === "page");
  const trashedFolders = trashed.filter((node): node is Folder => node.type === "folder");

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-8 pt-6 pb-2">
        <h1 className="text-h1">Trash</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          deleted forever after 30 days
        </span>
        <div className="ml-auto flex items-center gap-2 self-center">
          {selected.size > 0 && (
            <>
              <span className="font-mono text-xs text-muted-foreground">
                {selected.size} selected
              </span>
              <Button variant="secondary" size="sm" onClick={restoreSelected}>
                Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirming("selection")}>
                Delete forever
              </Button>
            </>
          )}
          {trashed.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setConfirming("all")}>
              Empty trash
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-4">
        {trashed.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Trash is empty</EmptyTitle>
              <EmptyDescription>
                Pages you trash wait here for 30 days before disappearing.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trashedFolders.map((folder) => {
              const tint = folderColorValue(folder.color);
              const isSelected = selected.has(folder.id);
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => toggleSelect(folder.id)}
                  className={cn(
                    "flex h-[62px] items-center gap-3 rounded-[10px] border bg-card px-3.5 text-left",
                    isSelected ? "border-foreground/50" : "hover:border-foreground/20",
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: tint ?? "var(--muted-foreground)" }}
                  />
                  <span className="truncate text-sm">{folder.name}</span>
                  <span className="ml-auto rounded-full border px-2 py-0.5 font-mono text-[11px] text-foreground/85">
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
                selecting
                dim
                trailing={
                  <span className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-foreground/85">
                    {daysLeft(page.deletedAt ?? 0)}d left
                  </span>
                }
                onSelectToggle={() => toggleSelect(page.id)}
              />
            ))}
          </div>
        )}
      </main>

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
