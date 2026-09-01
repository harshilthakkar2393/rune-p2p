import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { getPageExcerpt } from "@/lib/excerpt";
import { createPage } from "@/lib/nodes";
import { humanTime } from "@/lib/human-time";
import { readRecents } from "@/lib/recents";
import type { Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@rune/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@rune/ui/components/empty";

export const Route = createFileRoute("/")({ component: Home });

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function RecentCard({ page, openedAt }: { page: Page; openedAt: number }) {
  const [excerpt, setExcerpt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPageExcerpt(page.id).then((text) => {
      if (!cancelled) setExcerpt(text);
    });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  // Fixed 144px card, fixed slots (title 1 line, excerpt 2 lines
  // reserved), timestamp PINNED to the bottom edge via mt-auto —
  // it never rides up with shorter content.
  return (
    <Link to="/page/$pageId" params={{ pageId: page.id }}>
      <Card className="flex h-36 flex-col gap-0 overflow-hidden py-4 shadow-none transition-colors hover:bg-accent/40">
        <CardHeader className="flex h-full flex-col gap-1.5">
          <CardTitle className="h-5 shrink-0 truncate text-sm leading-5">
            {page.title === "" ? "Untitled" : page.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 h-[38px] shrink-0 text-[13px] leading-[19px]">
            {excerpt === null ? "" : excerpt === "" ? "Empty page" : excerpt}
          </CardDescription>
          <span className="mt-auto h-4 shrink-0 font-mono text-[11px] leading-4 text-muted-foreground">
            {humanTime(openedAt)}
          </span>
        </CardHeader>
      </Card>
    </Link>
  );
}

function Home() {
  const nodes = useNodes();
  const navigate = useNavigate();

  const recents = readRecents()
    .map((entry) => {
      const node = nodes.find(
        (candidate) =>
          candidate.id === entry.pageId && candidate.type === "page",
      );
      return node?.type === "page"
        ? { page: node, openedAt: entry.openedAt }
        : null;
    })
    .filter((entry) => entry !== null);

  const newPage = () => {
    const result = createPage(getNodesMap(), null);
    if (result.isOk()) {
      void navigate({
        to: "/page/$pageId",
        params: { pageId: result.value.id },
      });
    }
  };

  return (
    <>
      <main className="mx-auto w-full max-w-3xl py-6 px-8">
        <div className="flex h-12 items-center">
          <h1 className="text-h1">{greeting()}</h1>
        </div>

        <section className="mt-8">
          <h2 className="flex h-6 items-center text-sm font-medium text-muted-foreground">
            Recent
          </h2>
          {recents.length === 0 ? (
            <div className="mt-4">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nothing recent</EmptyTitle>
                  <EmptyDescription>
                    Pages you open show up here.
                  </EmptyDescription>
                </EmptyHeader>
                <Button onClick={newPage}>New page</Button>
              </Empty>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recents.map(({ page, openedAt }) => (
                <RecentCard key={page.id} page={page} openedAt={openedAt} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
