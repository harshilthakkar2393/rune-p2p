import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { createPage } from "@/lib/nodes";
import { readRecents } from "@/lib/recents";
import { Button } from "@rune/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rune/ui/components/card";
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
        <h1 className="text-2xl font-medium">{greeting()}</h1>

        <section className="mt-8">
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
                <Link
                  key={page.id}
                  to="/page/$pageId"
                  params={{ pageId: page.id }}
                >
                  <Card className="h-full transition-colors hover:bg-accent/50">
                    <CardHeader>
                      <CardTitle className="truncate">
                        {page.title === "" ? "Untitled" : page.title}
                      </CardTitle>
                      <CardDescription>
                        {new Date(openedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
