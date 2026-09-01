import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerPhoneSyncIcon,
  Delete02Icon,
  MoreHorizontalIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";

import { Tip } from "@/components/tip";
import { useSyncStatus } from "@/lib/sync/status";
import { Button } from "@rune/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { useTheme } from "@rune/ui/components/theme-provider";

/** Phone-only ⋯ on root screens: the sidebar entries that are not dock tabs. */
export function RootMenu() {
  const { peers } = useSyncStatus();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <Tip label="More">
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="More"
              className="text-muted-foreground md:hidden"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} />
            </Button>
          }
        />
      </Tip>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
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
  );
}
