import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Folder01Icon,
  Home04Icon,
  PencilEdit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { useComposePage } from "@/hooks/use-compose-page";
import { focusSearchInput } from "@/lib/search-state";
import { onViewportChange, settleViewport } from "@/lib/viewport";
import { Button } from "@rune/ui/components/button";

/** Phone nav: tabs pill left (Home · Folders · Search), New page right. Hidden while a page is open and on /search, where the pill morphs into the search field (shared view-transition names).
 * Folders is the phone's way to every list: its screen carries "All pages" first, so the
 * tab also lights up on /pages (Apple Files' Browse, Todoist's Browse). */

const TAB_CLASS =
  "flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors data-[status=active]:bg-accent data-[status=active]:text-foreground";

/** True on phones for routes that show the dock; the editor and pair flow do not. */
export function useDockVisible(pathname: string): boolean {
  return (
    !pathname.startsWith("/page/") &&
    !pathname.startsWith("/pair") &&
    !pathname.startsWith("/search")
  );
}

function Tab({
  to,
  icon,
  label,
  active,
  onClick,
}: {
  to: "/" | "/folders" | "/search";
  icon: IconSvgElement;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-status={active ? "active" : undefined}
      className={TAB_CLASS}
    >
      <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-6" />
    </Link>
  );
}

export function MobileDock() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const compose = useComposePage();
  const visible = useDockVisible(pathname);

  // iOS scrolls the page under the keyboard and can hand the window back
  // from the background with that offset still applied, which mispositions
  // position:fixed. Reset whenever the dock (re)appears and on every signal
  // that the viewport may have changed (keyboard, resume, rotation).
  useEffect(() => {
    if (!visible) return;
    settleViewport();
    return onViewportChange(settleViewport);
  }, [visible, pathname]);

  if (!visible) return null;

  return (
    <div
      // Anchored from the top via --app-h (lvh in standalone): bottom:0 would
      // follow the layout viewport, which iOS gets 59px short after a resume.
      className="pointer-events-none fixed inset-x-0 z-40 flex h-14.5 items-center justify-between px-4 md:hidden"
      style={{ top: "calc(var(--app-h) - 3.625rem - var(--dock-inset))" }}
    >
      <nav className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-lg [view-transition-name:dock]">
        <Tab to="/" icon={Home04Icon} label="Home" active={pathname === "/"} />
        <Tab
          to="/folders"
          icon={Folder01Icon}
          label="Folders"
          active={pathname.startsWith("/folders") || pathname.startsWith("/pages")}
        />
        {/* Focus the always-mounted field inside the tap so iOS opens the keyboard. */}
        <Tab
          to="/search"
          icon={Search01Icon}
          label="Search"
          active={false}
          onClick={focusSearchInput}
        />
      </nav>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="New page"
        onClick={compose}
        className="pointer-events-auto size-14.5 rounded-full shadow-lg [view-transition-name:dock-action]"
      >
        <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.75} className="size-6!" />
      </Button>
    </div>
  );
}
