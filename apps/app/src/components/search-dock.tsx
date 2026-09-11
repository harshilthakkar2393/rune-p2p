import { useEffect } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  blurSearchInput,
  registerSearchInput,
  setSearchQuery,
  useSearchQuery,
} from "@/lib/search-state";
import { Button } from "@rune/ui/components/button";
import { cn } from "cn";

/**
 * The phone search field. Lives in the root layout, always mounted, on its
 * own fixed layer above everything: page scroll never touches it, and the
 * input exists before the user taps Search so the dock can focus it inside
 * the gesture (the only way iOS opens the keyboard). Hidden off the visual
 * stack when not on /search; the dock pill morphs into it via shared
 * view-transition names when the route changes.
 */
export function SearchDock() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const searching = pathname.startsWith("/search");
  const query = useSearchQuery();
  const keyboard = useKeyboardInset();
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;
  const keyboardTop =
    viewport !== null ? Math.round(viewport.offsetTop + viewport.height) - 48 - 12 : 0;
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!searching) {
      blurSearchInput();
      setSearchQuery("");
    }
  }, [searching]);

  const close = () => {
    blurSearchInput();
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/" });
  };

  return (
    <div
      aria-hidden={!searching}
      className={cn(
        "fixed inset-x-4 z-50 flex items-center gap-2.5",
        !searching && "pointer-events-none opacity-0",
      )}
      style={
        keyboard > 0
          ? // On the keyboard: the visible bottom from the visual viewport.
            { top: keyboardTop }
          : // Otherwise the screen-true bottom via --app-h, like the dock.
            { top: "calc(var(--app-h) - 3rem - var(--dock-inset))" }
      }
    >
      <label
        className={cn(
          "flex h-12 flex-1 items-center gap-2.5 rounded-full border bg-card px-4 shadow-lg",
          searching && "[view-transition-name:dock]",
        )}
      >
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={1.75}
          className="size-5 shrink-0 text-muted-foreground"
        />
        <input
          ref={registerSearchInput}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          tabIndex={searching ? 0 : -1}
          placeholder="Search pages and folders"
          value={query}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {/* Clear addon, Apple's xmark.circle.fill: small gray disc, glyph cut out.
            Keeps focus so the keyboard stays. */}
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label="Clear search"
          tabIndex={-1}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setSearchQuery("")}
          className={cn(
            "-mr-1 shrink-0 rounded-full bg-muted-foreground/60 text-background transition-opacity hover:bg-muted-foreground/80",
            query === "" && "pointer-events-none opacity-0",
          )}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.5} className="size-2.5!" />
        </Button>
      </label>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Close search"
        tabIndex={searching ? 0 : -1}
        onClick={close}
        className={cn(
          "size-12 rounded-full shadow-lg",
          searching && "[view-transition-name:dock-action]",
        )}
      >
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.75} className="size-5!" />
      </Button>
    </div>
  );
}
