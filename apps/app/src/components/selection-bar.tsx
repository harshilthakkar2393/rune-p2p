import type { ComponentProps, ReactNode } from "react";

import { Button } from "@rune/ui/components/button";
import { cn } from "@rune/ui/lib/utils";

/** Floating pill toolbar for grid selections (Pages / Folder / Trash).
 * Renders nothing at count 0. Children are the page-specific actions;
 * Clear is always last. */
export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover py-1 pr-1 pl-4 shadow-lg">
      <span className="font-mono text-xs">{count} selected</span>
      <span className="mx-2 h-4.5 w-px bg-border" />
      {children}
      <SelectionBarButton className="text-muted-foreground" onClick={onClear}>
        Clear
      </SelectionBarButton>
    </div>
  );
}

/** Ghost pill button sized for the bar. */
export function SelectionBarButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("rounded-full font-normal", className)}
      {...props}
    />
  );
}
