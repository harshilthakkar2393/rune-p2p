import { useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { getPageExcerpt } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import type { Folder, Page } from "@/lib/schema";
import { Card } from "@rune/ui/components/card";
import { cn } from "@rune/ui/lib/utils";

/**
 * THE page card, app-wide (home, library, trash): fixed 144px, uniform
 * p-4, title 1 line, excerpt exactly 2 reserved lines, bottom row =
 * folder tag left + trailing meta right, pinned to the bottom edge.
 */
export function PageCard({
  page,
  folder,
  trailing,
  selected = false,
  selecting = false,
  dim = false,
  onSelectToggle,
  onOpen,
}: {
  page: Page;
  folder: Folder | undefined;
  trailing: ReactNode;
  selected?: boolean;
  selecting?: boolean;
  dim?: boolean;
  onSelectToggle?: () => void;
  onOpen?: () => void;
}) {
  const [excerpt, setExcerpt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPageExcerpt(page.id).then((text) => {
      if (!cancelled) setExcerpt(text);
    });
    return () => {
      cancelled = true;
    };
  }, [page.id, page.updatedAt]);

  const title = page.title === "" ? "Untitled" : page.title;
  const folderTint = folderColorValue(folder?.color);
  const activate = selecting ? onSelectToggle : onOpen;

  return (
    <Card
      className={cn(
        "relative flex h-36 flex-col gap-1.5 overflow-hidden p-4 text-left shadow-none transition-colors",
        activate && "cursor-pointer hover:bg-accent/40",
        selected && "border-foreground/50",
      )}
      role={activate ? "button" : undefined}
      tabIndex={activate ? 0 : undefined}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter") activate?.();
      }}
    >
      {(selecting || selected) && onSelectToggle && (
        <button
          type="button"
          aria-label={selected ? "Deselect" : "Select"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectToggle();
          }}
          className={cn(
            "absolute top-3 right-3 z-10 flex size-[18px] items-center justify-center rounded-[5px]",
            selected ? "bg-primary text-primary-foreground" : "border border-foreground/20",
          )}
        >
          {selected && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-3!" />}
        </button>
      )}

      <span
        className={cn(
          "h-5 shrink-0 truncate pr-6 text-sm leading-5",
          dim && "text-muted-foreground",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "line-clamp-2 h-[38px] shrink-0 overflow-hidden text-[13px] leading-[19px] break-words text-muted-foreground",
          dim && "text-muted-foreground/60",
        )}
      >
        {excerpt === null ? "" : excerpt === "" ? "Empty page" : excerpt}
      </span>
      <span className="mt-auto flex h-4 shrink-0 items-center gap-2">
        {folder && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
            {folderTint && (
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: folderTint }} />
            )}
            <span className="truncate">{folder.name}</span>
          </span>
        )}
        <span className="ml-auto shrink-0">{trailing}</span>
      </span>
    </Card>
  );
}
