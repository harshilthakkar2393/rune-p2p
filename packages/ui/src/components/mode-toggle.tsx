import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@rune/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { useTheme } from "@rune/ui/components/theme-provider";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Change theme">
            <HugeiconsIcon
              icon={resolvedTheme === "dark" ? Moon02Icon : Sun03Icon}
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <HugeiconsIcon icon={Sun03Icon} />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <HugeiconsIcon icon={Moon02Icon} />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <HugeiconsIcon icon={ComputerIcon} />
            System
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
