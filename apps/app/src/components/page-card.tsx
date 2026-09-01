import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

import { getPageExcerpt } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import type { Folder, Page } from "@/lib/schema";
import { Card } from "@rune/ui/components/card";
import { Checkbox } from "@rune/ui/components/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@rune/ui/components/context-menu";
import { cn } from "@rune/ui/lib/utils";

export type CardAction =
  | {
      label: string;
      icon: IconSvgElement;
      onSelect: () => void;
      destructive?: boolean;
    }
  | "separator";

function actionItems(actions: CardAction[]): ReactNode {
  return actions.map((action, index) =>
    action === "separator" ? (
      <ContextMenuSeparator key={`sep-${index}`} />
    ) : (
      <ContextMenuItem
        key={action.label}
        variant={action.destructive ? "destructive" : "default"}
        onClick={action.onSelect}
      >
        <HugeiconsIcon icon={action.icon} strokeWidth={1.75} />
        {action.label}
      </ContextMenuItem>
    ),
  );
}

/**
 * THE page card, app-wide: fixed 144px, uniform p-4, 1-line title,
 * 2 reserved excerpt lines, folder tag + pinned trailing meta.
 * Interactions (one step, Resurf-style): hovering reveals a check circle
 * top-right; it stays once selected or while a selection exists.
 * Right-click opens the quick-action menu (no ⋯ button by design). Card
 * click goes to onActivate with the raw event so pages can implement
 * ⌘-click toggle and shift-click ranges. Top-right placement keeps the
 * left edge flush — no per-state indent.
 */
export function PageCard({
  page,
  folder,
  trailing,
  selected = false,
  selecting = false,
  dim = false,
  actions,
  onSelectToggle,
  onActivate,
}: {
  page: Page;
  folder: Folder | undefined;
  trailing: ReactNode;
  selected?: boolean;
  selecting?: boolean;
  dim?: boolean;
  actions?: CardAction[];
  onSelectToggle?: () => void;
  onActivate?: (event: MouseEvent) => void;
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

  const card = (
    <Card
      className={cn(
        "group/card relative flex h-36 flex-col gap-1.5 overflow-hidden p-4 text-left shadow-none transition-colors",
        onActivate && "cursor-pointer hover:bg-accent/40",
        selected && "ring-foreground/50 dark:ring-foreground/50",
      )}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter") onActivate?.(event as unknown as MouseEvent);
      }}
    >
      {onSelectToggle && (
        <span className="absolute top-2 right-2 z-10 flex items-center">
          {onSelectToggle && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onSelectToggle()}
              onClick={(event) => event.stopPropagation()}
              aria-label={selected ? "Deselect" : "Select"}
              className={cn(
                "size-4.5 rounded-full opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100",
                (selected || selecting) && "opacity-100",
              )}
            />
          )}
        </span>
      )}

      <span className={cn("flex h-5 shrink-0 items-center gap-2", onSelectToggle && "pr-7")}>
        <span className={cn("min-w-0 truncate text-sm leading-5", dim && "text-muted-foreground")}>
          {title}
        </span>
      </span>
      <span
        className={cn(
          "line-clamp-2 h-9 shrink-0 overflow-hidden text-small break-words text-muted-foreground",
          dim && "text-muted-foreground/60",
        )}
      >
        {excerpt === null ? "" : excerpt === "" ? "Empty page" : excerpt}
      </span>
      <span className="mt-auto flex h-4 shrink-0 items-center gap-2">
        {folder && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-tiny leading-4 text-muted-foreground">
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

  if (!actions) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger render={card} />
      <ContextMenuContent className="w-auto min-w-44">
        <ContextMenuGroup>{actionItems(actions)}</ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
