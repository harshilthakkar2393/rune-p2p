import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { composeTargetFolderId } from "@/lib/compose-target";
import { getDeviceName } from "@/lib/device";
import { createPage } from "@/lib/nodes";
import { humanTime } from "@/lib/human-time";
import { readRecents } from "@/lib/recents";
import type { Folder } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { PageCard } from "@/components/page-card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@rune/ui/components/empty";

export const Route = createFileRoute("/")({ component: Home });

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

  const recents = readRecents()
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

  const newPage = () => {
    const map = getNodesMap();
    const result = createPage(map, composeTargetFolderId(map), {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({
        to: "/page/$pageId",
        params: { pageId: result.value.id },
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl shrink-0 items-center px-8">
        <h1 className="text-h1">{greeting()}</h1>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto w-full max-w-3xl px-8 pt-4 pb-8">
          <section className="flex flex-col gap-6">
            {recents.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nothing recent</EmptyTitle>
                  <EmptyDescription>Pages you open show up here.</EmptyDescription>
                </EmptyHeader>
                <Button onClick={newPage}>New page</Button>
              </Empty>
            ) : (
              dayGroups.map((group) => (
                <div key={group.label} className="flex flex-col gap-3.5">
                  <div className="flex h-4 items-center gap-3">
                    <span className="shrink-0 font-mono text-tiny leading-4 text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="grow border-t border-dashed border-foreground/10" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map(({ page, openedAt }) => (
                      <PageCard
                        key={page.id}
                        page={page}
                        folder={page.folderId !== null ? folderById.get(page.folderId) : undefined}
                        trailing={
                          <span className="font-mono text-tiny leading-4 text-muted-foreground">
                            {humanTime(openedAt)}
                          </span>
                        }
                        onActivate={() =>
                          void navigate({ to: "/page/$pageId", params: { pageId: page.id } })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </ScrollArea>
    </div>
  );
}
