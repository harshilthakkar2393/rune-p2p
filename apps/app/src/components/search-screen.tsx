import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, File02Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { RootMenu } from "@/components/root-menu";
import { useNodes } from "@/hooks/use-index";
import { useRecents } from "@/hooks/use-recents";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { pageTitle, searchNodes, type Match } from "@/lib/search";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { cn } from "@rune/ui/lib/utils";

/**
 * Phone search (`/search`): a full screen with the field at the bottom, on
 * the keyboard, where the thumb is (Linear, Apple News, iOS 26). Empty query
 * shows recently viewed pages; typing shows Pages then Folders with the hit
 * underlined. The dock hides on this route and the field carries the dock's
 * view-transition name, so the pill morphs into the field on the way in and
 * back on the way out. Desktop keeps the ⌘K palette.
 */
export function SearchScreen() {
  const nodes = useNodes();
  const recents = useRecents();
  const navigate = useNavigate();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const keyboard = useKeyboardInset();

  const folderById = useMemo(
    () =>
      new Map(
        nodes
          .filter((node): node is Folder => node.type === "folder" && node.deletedAt === undefined)
          .map((folder) => [folder.id, folder]),
      ),
    [nodes],
  );

  const recentPages = useMemo(
    () =>
      recents
        .map((entry) => {
          const node = nodes.find((candidate) => candidate.id === entry.pageId);
          return node?.type === "page" && node.deletedAt === undefined
            ? { page: node, openedAt: entry.openedAt }
            : null;
        })
        .filter((entry) => entry !== null)
        .slice(0, 12),
    [recents, nodes],
  );

  const results = useMemo(() => searchNodes(nodes, query), [nodes, query]);
  const searching = query.trim() !== "";

  const close = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/" });
  };
  const openPage = (pageId: string) => void navigate({ to: "/page/$pageId", params: { pageId } });
  const openFolder = (folderId: string) =>
    void navigate({ to: "/folders/$folderId", params: { folderId } });

  const folderDot = (page: Page) => {
    const tint = folderColorValue(folderById.get(page.folderId ?? "")?.color);
    return tint ? (
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: tint }} />
    ) : null;
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3.5 px-4">
        <h1 className="text-h1">Search</h1>
        <RootMenu />
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 pt-1" style={{ paddingBottom: 88 + keyboard }}>
          {!searching ? (
            recentPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Pages you open show up here.
              </p>
            ) : (
              <>
                <Label>Recently viewed</Label>
                {recentPages.map(({ page, openedAt }) => (
                  <Row
                    key={page.id}
                    icon={
                      <HugeiconsIcon icon={File02Icon} strokeWidth={1.75} className="size-4.5" />
                    }
                    onSelect={() => openPage(page.id)}
                    trailing={
                      <>
                        {folderDot(page)}
                        <span className="font-mono text-tiny text-muted-foreground">
                          {humanTime(openedAt)}
                        </span>
                      </>
                    }
                  >
                    {pageTitle(page)}
                  </Row>
                ))}
              </>
            )
          ) : results.pages.length + results.folders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No pages match “{query.trim()}”
            </p>
          ) : (
            <>
              <Label>Pages · {results.pages.length}</Label>
              {results.pages.map(({ page, match }) => (
                <Row
                  key={page.id}
                  icon={<HugeiconsIcon icon={File02Icon} strokeWidth={1.75} className="size-4.5" />}
                  onSelect={() => openPage(page.id)}
                  trailing={
                    <>
                      {folderDot(page)}
                      <span className="font-mono text-tiny text-muted-foreground">
                        {folderById.get(page.folderId ?? "")?.name}
                      </span>
                    </>
                  }
                >
                  <Highlight text={pageTitle(page)} match={match} />
                </Row>
              ))}
              {results.folders.length > 0 && (
                <>
                  <Label>Folders · {results.folders.length}</Label>
                  {results.folders.map(({ folder, match }) => (
                    <Row
                      key={folder.id}
                      icon={
                        <FolderGlyph
                          className="size-4.5"
                          color={folderColorValue(folder.color) ?? "var(--muted-foreground)"}
                        />
                      }
                      onSelect={() => openFolder(folder.id)}
                    >
                      <Highlight text={folder.name} match={match} />
                    </Row>
                  ))}
                </>
              )}
            </>
          )}
        </main>
      </ScrollArea>

      {/* The field sits on the keyboard: bottom offset tracks the visual viewport. */}
      <div
        className="fixed inset-x-4 z-40 flex items-center gap-2.5"
        style={{
          bottom: keyboard > 0 ? keyboard + 12 : "max(env(safe-area-inset-bottom), 1rem)",
        }}
      >
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-full border bg-card px-4 shadow-lg [view-transition-name:dock]">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={1.75}
            className="size-5 shrink-0 text-muted-foreground"
          />
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search pages and folders"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "Enter" && results.pages[0]) openPage(results.pages[0].page.id);
            }}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Close search"
          onClick={close}
          className="size-12 rounded-full shadow-lg [view-transition-name:dock-action]"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.75} className="size-5!" />
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="pt-3 pb-1.5 font-mono text-tiny uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function Row({
  icon,
  children,
  trailing,
  onSelect,
}: {
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-md px-1 text-left text-[15px]",
        "text-foreground transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none",
      )}
    >
      <span className="flex shrink-0 items-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
    </button>
  );
}

function Highlight({ text, match }: { text: string; match: Match }) {
  return (
    <>
      {text.slice(0, match.start)}
      <span className="underline decoration-muted-foreground underline-offset-4">
        {text.slice(match.start, match.end)}
      </span>
      {text.slice(match.end)}
    </>
  );
}

/** Height of the on-screen keyboard in CSS px (0 when hidden). iOS does not
 * resize the layout viewport for the keyboard; the visual viewport shrinks. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
