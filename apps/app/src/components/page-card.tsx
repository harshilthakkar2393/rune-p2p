import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { MoreHorizontalIcon, Tick02Icon } from "@hugeicons/core-free-icons";

import { getPageExcerpt } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { Card } from "@rune/ui/components/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@rune/ui/components/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { cn } from "@rune/ui/lib/utils";

export type CardAction =
  | {
      label: string;
      icon: IconSvgElement;
      onSelect: () => void;
      destructive?: boolean;
    }
  | "separator";

function actionItems(actions: CardAction[], kind: "context" | "dropdown"): ReactNode {
  const Item = kind === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator = kind === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
  return actions.map((action, index) =>
    action === "separator" ? (
      <Separator key={`sep-${index}`} />
    ) : (
      <Item
        key={action.label}
        variant={action.destructive ? "destructive" : "default"}
        onClick={action.onSelect}
      >
        <HugeiconsIcon icon={action.icon} strokeWidth={1.75} />
        {action.label}
      </Item>
    ),
  );
}

/**
 * THE page card, app-wide: fixed 144px, uniform p-4, 1-line title,
 * 2 reserved excerpt lines, folder tag + pinned trailing meta.
 * Interactions: hover check circle (top-left) enters selection; hover ⋯
 * (top-right) and right-click open the same quick-action menu; the card
 * click goes to onActivate with the raw event so pages can implement
 * ⌘-click toggle and shift-click ranges.
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
        selected && "border-foreground/50",
      )}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter") onActivate?.(event as unknown as MouseEvent);
      }}
    >
      {onSelectToggle && (
        <button
          type="button"
          aria-label={selected ? "Deselect" : "Select"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectToggle();
          }}
          className={cn(
            "absolute top-3 left-3 z-10 flex size-4.5 items-center justify-center rounded-sm transition-opacity",
            selected
              ? "bg-primary text-primary-foreground opacity-100"
              : "border border-foreground/25 opacity-0 group-hover/card:opacity-100",
            selecting && "opacity-100",
          )}
        >
          {selected && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-3!" />}
        </button>
      )}

      {actions && !selecting && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Page actions"
                onClick={(event) => event.stopPropagation()}
                className="absolute top-2 right-2 z-10 size-6 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 data-popup-open:bg-secondary data-popup-open:opacity-100"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} className="size-4!" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuGroup>{actionItems(actions, "dropdown")}</DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <span
        className={cn(
          "h-5 shrink-0 truncate pr-6 text-sm leading-5",
          dim && "text-muted-foreground",
          onSelectToggle && selecting && "pl-6",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "line-clamp-2 h-9 shrink-0 overflow-hidden text-small break-words text-muted-foreground",
          dim && "text-muted-foreground/60",
          onSelectToggle && selecting && "pl-6",
        )}
      >
        {excerpt === null ? "" : excerpt === "" ? "Empty page" : excerpt}
      </span>
      <span
        className={cn(
          "mt-auto flex h-4 shrink-0 items-center gap-2",
          onSelectToggle && selecting && "pl-6",
        )}
      >
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
      <ContextMenuContent>
        <ContextMenuGroup>{actionItems(actions, "context")}</ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
