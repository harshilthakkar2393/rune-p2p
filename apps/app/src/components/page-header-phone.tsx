import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, LayoutAlignRightIcon } from "@hugeicons/core-free-icons";

import { setInspectorSheet, useInspector } from "@/lib/inspector";
import type { Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { cn } from "cn";

/**
 * Phone header for an open page: back on the left, the page's title in a
 * centre capsule, page info on the right. Same capsule as the ⋯ menu on
 * Home and Pages (`h-10 rounded-full border bg-card`), no seams.
 */

const CAPSULE = "flex h-10 shrink-0 items-center rounded-full border bg-card px-1";

export function PageHeaderPhone({ page }: { page: Page }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const { sheet } = useInspector();

  const back = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    if (page.folderId === null) {
      void navigate({ to: "/" });
      return;
    }
    void navigate({ to: "/folders/$folderId", params: { folderId: page.folderId } });
  };

  const untitled = page.title === "";

  return (
    <header className="grid h-14 shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 px-4">
      <div className={CAPSULE}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={back}
          className="rounded-full"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.75} className="-ml-1 size-6" />
        </Button>
      </div>
      <div
        className={cn(
          CAPSULE,
          "min-w-0 max-w-full justify-self-center px-4 text-sm font-medium",
          untitled && "font-normal text-muted-foreground",
        )}
      >
        <span className="truncate">{untitled ? "Untitled" : page.title}</span>
      </div>
      <div className={CAPSULE}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Page info"
          aria-pressed={sheet}
          onClick={() => setInspectorSheet(true)}
          className={cn("rounded-full [&_svg]:size-5!", sheet && "bg-accent")}
        >
          <HugeiconsIcon icon={LayoutAlignRightIcon} strokeWidth={1.75} />
        </Button>
      </div>
    </header>
  );
}
