import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { getPageExcerpt } from "@/lib/excerpt";
import { createPage } from "@/lib/nodes";
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
import { SidebarTrigger } from "@rune/ui/components/sidebar";

export const Route = createFileRoute("/")({ component: Home });

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function RecentCard({ page, openedAt }: { page: Page; openedAt: number }) {
  const [excerpt, setExcerpt] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getPageExcerpt(page.id).then((text) => {
      if (!cancelled) setExcerpt(text);
    });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  return (
    <Link to="/page/$pageId" params={{ pageId: page.id }}>
      <Card className="h-full gap-2 shadow-none transition-colors hover:bg-accent/40">
        <CardHeader className="gap-1.5">
          <CardTitle className="truncate text-sm">
            {page.title === "" ? "Untitled" : page.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-8 text-[13px]">
            {excerpt || "Empty page"}
          </CardDescription>
          <span className="pt-1 font-mono text-[11px] text-muted-foreground">
            {new Date(openedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
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
      <header className="flex items-center px-2 pt-1">
        <SidebarTrigger />
      </header>
      <main className="mx-auto w-full max-w-3xl py-6 px-8">
        <h1 className="font-serif text-4xl">{greeting()}</h1>

        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
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
