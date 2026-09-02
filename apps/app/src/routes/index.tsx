import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit02Icon } from "@hugeicons/core-free-icons";

import { RootMenu } from "@/components/root-menu";
import { useComposePage } from "@/hooks/use-compose-page";
import { useNodes } from "@/hooks/use-index";
import { useRecents } from "@/hooks/use-recents";
import { humanTime } from "@/lib/human-time";
import type { Folder } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { ScrollArea, ScrollBar } from "@rune/ui/components/scroll-area";
import { EmptyState } from "@/components/empty-state";
import { PageCard } from "@/components/page-card";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Rune" }] }),
  component: Home,
});

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(timestamp: number): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const date = new Date(timestamp);
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  if (dayKey(timestamp) === dayKey(now.getTime())) return `Today · ${weekday}`;
  if (dayKey(timestamp) === dayKey(yesterday.getTime())) return `Yesterday · ${weekday}`;
  const md = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${md} · ${weekday}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const nodes = useNodes();
  const navigate = useNavigate();
  const folderById = new Map(
    nodes
      .filter((node): node is Folder => node.type === "folder" && node.deletedAt === undefined)
      .map((folder) => [folder.id, folder]),
  );

  const recentEntries = useRecents();
  const recents = recentEntries
    .map((entry) => {
      const node = nodes.find(
        (candidate) => candidate.id === entry.pageId && candidate.type === "page",
      );
      return node?.type === "page" && node.deletedAt === undefined
        ? { page: node, openedAt: entry.openedAt }
        : null;
    })
    .filter((entry) => entry !== null);

  const dayGroups: { label: string; items: typeof recents }[] = [];
  for (const entry of recents) {
    const label = dayLabel(entry.openedAt);
    const group = dayGroups.at(-1);
    if (group && group.label === label) group.items.push(entry);
    else dayGroups.push({ label, items: [entry] });
  }

  const newPage = useComposePage();

  return (
    <div className="flex h-full flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl shrink-0 items-center px-4 md:px-8">
        <h1 className="text-h1">{greeting()}</h1>
        <span className="ml-auto">
          <RootMenu />
        </span>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto w-full max-w-3xl px-4 md:px-8 pt-4 pb-8">
          <section className="flex flex-col gap-6">
            {recents.length === 0 ? (
              <EmptyState
                icon={<HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.75} />}
                title="Nothing recent"
                description="Pages you open show up here."
                action={<Button onClick={newPage}>New page</Button>}
              />
            ) : (
              dayGroups.map((group) => (
                <div key={group.label} className="flex flex-col gap-3.5">
                  <div className="flex h-4 items-center gap-3">
                    <span className="shrink-0 font-mono text-tiny leading-4 text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="grow border-t border-dashed border-foreground/10" />
                  </div>
                  {/* Bleed to the gutter edges so the row scrolls edge to edge. */}
                  <ScrollArea className="-mx-4 -my-2 md:-mx-8">
                    <div className="flex w-max gap-3 px-4 py-2 md:px-8">
                      {group.items.map(({ page, openedAt }) => (
                        <div key={page.id} className="w-64 shrink-0">
                          <PageCard
                            page={page}
                            folder={
                              page.folderId !== null ? folderById.get(page.folderId) : undefined
                            }
                            trailing={
                              <span className="font-mono text-tiny leading-4 text-muted-foreground">
                                {humanTime(openedAt)}
                              </span>
                            }
                            onActivate={() =>
                              void navigate({ to: "/page/$pageId", params: { pageId: page.id } })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              ))
            )}
          </section>
        </main>
      </ScrollArea>
    </div>
  );
}
