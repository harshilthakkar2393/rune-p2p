import { Link, useRouterState } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Home04Icon,
  PencilEdit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { useComposePage } from "@/hooks/use-compose-page";
import { setPaletteOpen } from "@/lib/palette";
import { Button } from "@rune/ui/components/button";
import { cn } from "@rune/ui/lib/utils";

/** Phone nav: tabs pill left (Home · Library · Search), New page right. Hidden while a page is open. */

const TAB_CLASS =
  "flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors data-[status=active]:bg-accent data-[status=active]:text-foreground";

/** True on phones for routes that show the dock; the editor and pair flow do not. */
export function useDockVisible(pathname: string): boolean {
  return !pathname.startsWith("/page/") && !pathname.startsWith("/pair");
}

function Tab({
  to,
  icon,
  label,
  exact = false,
}: {
  to: "/" | "/library";
  icon: IconSvgElement;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link to={to} aria-label={label} activeOptions={{ exact }} className={TAB_CLASS}>
      <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-6" />
    </Link>
  );
}

export function MobileDock() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const compose = useComposePage();
  if (!useDockVisible(pathname)) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-between px-4 md:hidden",
        "pb-[calc(env(safe-area-inset-bottom)+--spacing(4))]",
      )}
    >
      <nav className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-lg">
        <Tab to="/" icon={Home04Icon} label="Home" exact />
        <Tab to="/library" icon={DashboardSquare01Icon} label="Library" />
        <button
          type="button"
          aria-label="Search"
          className={TAB_CLASS}
          onClick={() => setPaletteOpen(true)}
        >
          <HugeiconsIcon icon={Search01Icon} strokeWidth={1.75} className="size-6" />
        </button>
      </nav>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="New page"
        onClick={compose}
        className="pointer-events-auto size-14.5 rounded-full shadow-lg"
      >
        <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.75} className="size-6!" />
      </Button>
    </div>
  );
}
