import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  FilterMailIcon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { EmptyState } from "@/components/empty-state";
import { PageCard, type CardAction } from "@/components/page-card";
import { PhoneAction, RootMenu } from "@/components/root-menu";
import { SelectionBar, SelectionBarButton } from "@/components/selection-bar";
import { Tip } from "@/components/tip";
import { useNodes } from "@/hooks/use-index";
import { useSelection } from "@/hooks/use-selection";
import { composeTargetFolderId, rememberFolder } from "@/lib/compose-target";
import { DATE_PRESETS, presetLabel, withinPreset, type DatePresetId } from "@/lib/date-presets";
import { getDeviceName } from "@/lib/device";
import { FOLDER_COLOR_VALUES, folderColorValue } from "@/lib/folder-colors";
import { readGridPrefs, writeGridPrefs, type GridPrefs } from "@/lib/grid-prefs";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import { createPage, moveNode, renameNode, trashNode, updateFolderColor } from "@/lib/nodes";
import { FOLDER_COLORS, type Folder, type Page } from "@/lib/schema";
import { Badge } from "@rune/ui/components/badge";
import { Button } from "@rune/ui/components/button";
import { Card } from "@rune/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import { ScrollArea } from "@rune/ui/components/scroll-area";
import { SidebarInput } from "@rune/ui/components/sidebar";

/**
 * The Pages grid, in two states: every live page (`/pages`), or one folder's
 * pages (`/folders/$folderId`). A folder is a scope, not a filter — picking one
 * navigates, and the header becomes the folder's (name, colour, rename, ⋯).
 * Routes mount this keyed by folderId so filter/rename state resets per scope.
 */
export function PagesView({ folderId }: { folderId?: string }) {
  const nodes = useNodes();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<GridPrefs>(() => readGridPrefs());
  const [dateFilter, setDateFilter] = useState<DatePresetId | null>(null);
  const [renaming, setRenaming] = useState(false);

  const folders = nodes.filter(
    (node): node is Folder => node.type === "folder" && node.deletedAt === undefined,
  );
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const folder = folderId !== undefined ? folderById.get(folderId) : undefined;
  const scoped = folderId !== undefined;
  const moveTargets = folders.filter((candidate) => candidate.id !== folderId);

  useEffect(() => {
    if (folderId !== undefined) rememberFolder(folderId);
  }, [folderId]);

  useEffect(() => {
    document.title = `${scoped ? (folder?.name ?? "Folder") : "Pages"} — Rune`;
  }, [scoped, folder?.name]);

  const pages = useMemo(() => {
    let live = nodes.filter(
      (node): node is Page => node.type === "page" && node.deletedAt === undefined,
    );
    if (folderId !== undefined) live = live.filter((page) => page.folderId === folderId);
    if (dateFilter !== null) live = live.filter((page) => withinPreset(page.updatedAt, dateFilter));
    if (prefs.sort === "updated") return live.toSorted((a, b) => b.updatedAt - a.updatedAt);
    return live.toSorted((a, b) => b.createdAt - a.createdAt);
  }, [nodes, folderId, dateFilter, prefs.sort]);

  const selection = useSelection(pages.map((page) => page.id));
  const { selected, selecting } = selection;

  if (scoped && folder === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        This folder no longer exists.
      </div>
    );
  }

  const updatePrefs = (patch: Partial<GridPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeGridPrefs(next);
  };

  const goToScope = (target: string | undefined) => {
    if (target === undefined) void navigate({ to: "/pages" });
    else void navigate({ to: "/folders/$folderId", params: { folderId: target } });
  };

  const newPage = () => {
    const map = getNodesMap();
    const result = createPage(map, folder?.id ?? composeTargetFolderId(map), {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({ to: "/page/$pageId", params: { pageId: result.value.id } });
    }
  };

  const openPage = (pageId: string) => {
    void navigate({ to: "/page/$pageId", params: { pageId } });
  };

  const trashFolder = () => {
    if (folder === undefined) return;
    const result = trashNode(getNodesMap(), folder.id);
    if (result.isOk()) void navigate({ to: "/pages" });
  };

  const moveSelected = (targetId: string) => {
    for (const id of selected) moveNode(getNodesMap(), id, targetId);
    selection.clear();
  };

  const trashSelected = () => {
    for (const id of selected) trashNode(getNodesMap(), id);
    selection.clear();
  };

  const pageActions = (pageId: string): CardAction[] => [
    { label: "Open", icon: ArrowUpRight01Icon, onSelect: () => openPage(pageId) },
    "separator",
    {
      label: "Move to trash",
      icon: Delete02Icon,
      destructive: true,
      onSelect: () => void trashNode(getNodesMap(), pageId),
    },
  ];

  const filterItems = (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Date</DropdownMenuLabel>
        {DATE_PRESETS.map((preset) => (
          <DropdownMenuCheckboxItem
            key={preset.id}
            checked={dateFilter === preset.id}
            onCheckedChange={() => setDateFilter(dateFilter === preset.id ? null : preset.id)}
          >
            {preset.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Folder</DropdownMenuLabel>
        {folders.map((candidate) => (
          <DropdownMenuCheckboxItem
            key={candidate.id}
            checked={folderId === candidate.id}
            onCheckedChange={() => goToScope(folderId === candidate.id ? undefined : candidate.id)}
          >
            {candidate.name}
          </DropdownMenuCheckboxItem>
        ))}
        {folders.length === 0 && <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>}
      </DropdownMenuGroup>
    </>
  );

  const sortItems = (
    <DropdownMenuRadioGroup
      value={prefs.sort}
      onValueChange={(value) => updatePrefs({ sort: value as GridPrefs["sort"] })}
    >
      <DropdownMenuLabel>Sort</DropdownMenuLabel>
      <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="updated">Recently updated</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );

  const folderItems = folder !== undefined && (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => setRenaming(true)}>
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={1.75} />
          Rename
        </DropdownMenuItem>
        <DropdownMenuLabel>Color</DropdownMenuLabel>
        <div className="flex items-center gap-2 px-2 pb-1.5">
          {FOLDER_COLORS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-label={`Color ${candidate}`}
              onClick={() => updateFolderColor(getNodesMap(), folder.id, candidate)}
              className="flex size-4 items-center justify-center rounded-full"
              style={{
                background: FOLDER_COLOR_VALUES[candidate],
                outline: folder.color === candidate ? "2px solid var(--foreground)" : undefined,
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={trashFolder}>
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
        Move to trash
      </DropdownMenuItem>
    </>
  );

  const iconButton = (label: string, icon: typeof FilterMailIcon) => (
    <Button variant="ghost" size="icon" aria-label={label} className="text-muted-foreground">
      <HugeiconsIcon icon={icon} strokeWidth={1.75} />
    </Button>
  );

  const emptyState =
    dateFilter !== null ? (
      <EmptyState
        title="Nothing matches"
        description="No pages fit this filter."
        action={
          <Button variant="secondary" onClick={() => setDateFilter(null)}>
            Clear filter
          </Button>
        }
      />
    ) : folder !== undefined ? (
      <EmptyState
        glyph="folder"
        title={`Nothing in ${folder.name} yet`}
        description="Pages you create here stay in this folder on every device."
        action={<Button onClick={newPage}>New page</Button>}
      />
    ) : (
      <EmptyState
        glyph="pages"
        title="No pages yet"
        description="Everything you write shows up here, across all folders."
        action={<Button onClick={newPage}>New page</Button>}
      />
    );

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-3.5 px-4 md:px-8 pt-3 pb-2 max-md:h-14 max-md:items-center max-md:py-0">
        {folder !== undefined && renaming ? (
          <SidebarInput
            autoFocus
            defaultValue={folder.name}
            className="h-10 max-w-sm text-xl"
            onBlur={(event) => {
              if (event.target.value.trim() !== "")
                renameNode(getNodesMap(), folder.id, event.target.value.trim());
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
          />
        ) : folder !== undefined ? (
          <h1 className="flex items-center gap-3 text-h1">
            <span
              className="size-3 rounded-full"
              style={{ background: folderColorValue(folder.color) ?? "var(--muted-foreground)" }}
            />
            {folder.name}
          </h1>
        ) : (
          <h1 className="text-h1">Pages</h1>
        )}
        <span className="font-mono text-tiny text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
        <div className="ml-auto hidden items-center gap-1.5 self-center md:flex">
          <Tip label={selecting ? "Done selecting" : "Select"}>
            <Button
              variant={selecting ? "secondary" : "ghost"}
              size="icon"
              aria-label="Select"
              className={selecting ? undefined : "text-muted-foreground"}
              onClick={selection.toggleMode}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.75} />
            </Button>
          </Tip>
          <DropdownMenu>
            <Tip label="Filter">
              <DropdownMenuTrigger render={iconButton("Filter", FilterMailIcon)} />
            </Tip>
            <DropdownMenuContent align="end" className="w-52">
              {filterItems}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <Tip label="Sort">
              <DropdownMenuTrigger render={iconButton("Sort", Sorting01Icon)} />
            </Tip>
            <DropdownMenuContent align="end" className="w-48">
              {sortItems}
            </DropdownMenuContent>
          </DropdownMenu>
          {folderItems && (
            <DropdownMenu>
              <Tip label="Folder actions">
                <DropdownMenuTrigger render={iconButton("Folder actions", MoreHorizontalIcon)} />
              </Tip>
              <DropdownMenuContent align="end" className="w-52">
                {folderItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <RootMenu
          action={
            <PhoneAction
              label={selecting ? "Done selecting" : "Select"}
              active={selecting}
              onClick={selection.toggleMode}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.75} />
            </PhoneAction>
          }
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={FilterMailIcon} strokeWidth={1.75} />
              Filter
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{filterItems}</DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={Sorting01Icon} strokeWidth={1.75} />
              Sort
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{sortItems}</DropdownMenuSubContent>
          </DropdownMenuSub>
          {folderItems}
        </RootMenu>
      </header>

      {dateFilter !== null && (
        <div className="flex w-full shrink-0 items-center gap-2 px-4 md:px-8 pt-2">
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1.5 font-normal"
            onClick={() => setDateFilter(null)}
          >
            {presetLabel(dateFilter)}
            <span className="text-muted-foreground">×</span>
          </Badge>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <main className="px-4 md:px-8 py-4">
          {pages.length === 0 ? (
            emptyState
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-3">
              {pages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  folder={
                    scoped || page.folderId === null ? undefined : folderById.get(page.folderId)
                  }
                  selected={selected.has(page.id)}
                  selecting={selecting}
                  trailing={
                    <span className="font-mono text-tiny text-muted-foreground">
                      {humanTime(page.updatedAt)}
                    </span>
                  }
                  actions={pageActions(page.id)}
                  onSelectToggle={() => selection.toggle(page.id)}
                  onActivate={(event) =>
                    selection.handleCardClick(page.id, event, () => openPage(page.id))
                  }
                />
              ))}
              <Card
                role="button"
                tabIndex={0}
                onClick={newPage}
                onKeyDown={(event) => {
                  if (event.key === "Enter") newPage();
                }}
                className="flex h-36 cursor-pointer flex-row items-center justify-center gap-2 border border-dashed bg-transparent p-4 ring-0 text-small text-muted-foreground shadow-none transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4!" />
                New page
              </Card>
            </div>
          )}
        </main>
      </ScrollArea>

      <SelectionBar count={selected.size} onClear={selection.clear}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SelectionBarButton>
                <FolderGlyph className="size-4" />
                Move
              </SelectionBarButton>
            }
          />
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuGroup>
              {moveTargets.map((target) => (
                <DropdownMenuItem key={target.id} onClick={() => moveSelected(target.id)}>
                  <FolderGlyph
                    className="size-4"
                    color={folderColorValue(target.color) ?? "var(--muted-foreground)"}
                  />
                  {target.name}
                </DropdownMenuItem>
              ))}
              {moveTargets.length === 0 && (
                <DropdownMenuItem disabled>No other folders</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <SelectionBarButton variant="destructive" onClick={trashSelected}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
          Trash
        </SelectionBarButton>
      </SelectionBar>
    </div>
  );
}
