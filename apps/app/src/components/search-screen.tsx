import { useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { File02Icon } from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { RootMenu } from "@/components/root-menu";
import { useNodes } from "@/hooks/use-index";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useRecents } from "@/hooks/use-recents";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { pageTitle, searchNodes, type Match } from "@/lib/search";
import { useSearchQuery } from "@/lib/search-state";
import type { Folder, Page } from "@/lib/schema";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { cn } from "@rune/ui/lib/utils";

/**
 * Phone search (`/search`): the results half. The field itself is
 * `SearchDock` in the root layout, a fixed layer this screen never touches;
 * this screen only reads the shared query and pads its bottom so the last
 * row scrolls clear of the field and the keyboard. Empty query shows
 * recently viewed pages; typing shows Pages then Folders with the hit
 * underlined. Desktop keeps the ⌘K palette.
 */
export function SearchScreen() {
  const nodes = useNodes();
  const recents = useRecents();
  const navigate = useNavigate();
  const query = useSearchQuery();
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
