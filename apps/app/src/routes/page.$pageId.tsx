import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Editor } from "@/components/editor";
import { PageTitle } from "@/components/page-title";
import { recordOpen } from "@/lib/recents";
import { SidebarTrigger } from "@rune/ui/components/sidebar";

export const Route = createFileRoute("/page/$pageId")({ component: PageView });

function PageView() {
  const { pageId } = Route.useParams();

  useEffect(() => {
    recordOpen(pageId);
  }, [pageId]);

  return (
    <>
      <header className="flex items-center px-2 pt-1">
        <SidebarTrigger />
      </header>
      <main className="mx-auto w-full py-6 px-8">
        <div className="flex flex-col gap-4">
          <div className="px-1">
            <PageTitle pageId={pageId} />
          </div>
          <Editor pageId={pageId} />
        </div>
      </main>
    </>
  );
}
