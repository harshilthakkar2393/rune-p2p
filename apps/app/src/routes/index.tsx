import { createFileRoute } from "@tanstack/react-router";

import { Editor } from "@/components/editor";
import { PageTitle } from "@/components/page-title";
import { usePageSelection, selectPage } from "@/lib/page-selection";
import { getNodesMap } from "@/lib/index-doc";
import { createPage } from "@/lib/nodes";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/")({ component: Home });

function NoPageOpen() {
  const newPage = () => {
    const result = createPage(getNodesMap(), null);
    if (result.isOk()) selectPage(result.value.id);
  };
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nothing open</EmptyTitle>
        <EmptyDescription>
          Pick a page from the sidebar, or start dumping.
        </EmptyDescription>
      </EmptyHeader>
      <Button onClick={newPage}>New page</Button>
    </Empty>
  );
}

function Home() {
  const selectedId = usePageSelection();
  return (
    <>
      <header className="flex items-center px-2 pt-1">
        <SidebarTrigger />
      </header>
      <main className="mx-auto w-full py-6 px-8">
        {selectedId === null ? (
          <NoPageOpen />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="px-1">
              <PageTitle pageId={selectedId} />
            </div>
            <Editor pageId={selectedId} />
          </div>
        )}
      </main>
    </>
  );
}
