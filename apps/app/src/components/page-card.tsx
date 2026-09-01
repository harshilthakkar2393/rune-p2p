import { useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { getPageExcerpt } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import type { Folder, Page } from "@/lib/schema";
import { cn } from "@rune/ui/lib/utils";

/**
 * Gallery card: mini page preview on a recessed surface, hairline-split
 * from a footer (title · folder chip · trailing meta). Fixed heights,
 * no layout shift — excerpt resolves into reserved space.
 */
export function PageCard({
  page,
  folder,
  selected,
  selecting,
  dimPreview,
  showPreview = true,
  trailing,
  onSelectToggle,
  onOpen,
}: {
  page: Page;
  folder: Folder | undefined;
  selected: boolean;
  selecting: boolean;
  dimPreview?: boolean;
  showPreview?: boolean;
  trailing: ReactNode;
  onSelectToggle: () => void;
  onOpen?: () => void;
}) {
  const [excerpt, setExcerpt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPageExcerpt(page.id, 220).then((text) => {
      if (!cancelled) setExcerpt(text);
    });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  const title = page.title === "" ? "Untitled" : page.title;
  const folderTint = folderColorValue(folder?.color);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[10px] border bg-card text-left transition-colors",
        selected ? "border-foreground/50" : "hover:border-foreground/20",
      )}
      onClick={selecting ? onSelectToggle : onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") (selecting ? onSelectToggle : onOpen)?.();
      }}
    >
      {(selecting || selected) && (
        <button
          type="button"
          aria-label={selected ? "Deselect" : "Select"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectToggle();
          }}
          className={cn(
            "absolute top-2.5 right-2.5 z-10 flex size-[18px] items-center justify-center rounded-[5px]",
            selected ? "bg-primary text-primary-foreground" : "border border-foreground/20",
          )}
        >
          {selected && (
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-3!" />
          )}
        </button>
      )}

      {showPreview && (
        <div
          className={cn(
            "flex h-[104px] shrink-0 flex-col gap-1 overflow-hidden border-b bg-background px-5 py-3.5",
            dimPreview && "opacity-60",
          )}
        >
          {excerpt === null ? null : excerpt === "" ? (
            <span className="m-auto text-xs text-muted-foreground/60">
              Empty page
            </span>
          ) : (
            <span className="line-clamp-5 text-xs leading-[17px] text-muted-foreground">
              {excerpt}
            </span>
          )}
        </div>
      )}

      <div className="flex h-[62px] flex-col justify-center gap-1.5 px-3.5">
        <span className="h-[18px] truncate text-sm leading-[18px]">{title}</span>
        <span className="flex h-4 items-center gap-2">
          {folder && (
            <span className="inline-flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
              {folderTint && (
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: folderTint }}
                />
              )}
              {folder.name}
            </span>
          )}
          <span className="ml-auto">{trailing}</span>
        </span>
      </div>
    </div>
  );
}
