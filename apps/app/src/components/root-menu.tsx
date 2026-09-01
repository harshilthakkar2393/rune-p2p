import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerPhoneSyncIcon,
  Delete02Icon,
  MoreHorizontalIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";

import { useSyncStatus } from "@/lib/sync/status";
import { Button } from "@rune/ui/components/button";
import { ButtonGroup } from "@rune/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { useTheme } from "@rune/ui/components/theme-provider";

/**
 * Phone header actions, Linear-style: at most one page action plus ⋯ in a
 * single outline button group. Page-specific menu items go first via
 * `children`; the sidebar entries that are not dock tabs follow.
 */
export function RootMenu({ action, children }: { action?: ReactNode; children?: ReactNode }) {
  const { peers } = useSyncStatus();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <ButtonGroup className="md:hidden">
      {action}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon-xl" aria-label="More">
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto min-w-52">
          {children && (
            <>
              {children}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link to="/devices" />}>
              <HugeiconsIcon icon={ComputerPhoneSyncIcon} strokeWidth={1.75} />
              Devices
              {peers.length > 0 && (
                <span className="ml-auto font-mono text-tiny text-muted-foreground">
                  {peers.length} online
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme(dark ? "light" : "dark")}>
              <HugeiconsIcon icon={dark ? Sun03Icon : Moon02Icon} strokeWidth={1.75} />
              {dark ? "Light theme" : "Dark theme"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" render={<Link to="/trash" />}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
              Trash
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

/** The one page action allowed beside ⋯ on phones. */
export function PhoneAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon-xl"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={active ? "bg-accent" : "text-muted-foreground"}
    >
      {children}
    </Button>
  );
}
