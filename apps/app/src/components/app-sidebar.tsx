import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  ComputerPhoneSyncIcon,
  File02Icon,
  FileEditIcon,
  Folder01Icon,
  Home01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder, createPage } from "@/lib/nodes";
import { setPaletteOpen } from "@/lib/palette";
import type { Folder, Node, Page } from "@/lib/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@rune/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rune/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@rune/ui/components/sidebar";

function childrenOf(nodes: Node[], parentId: string | null): Node[] {
  const folderIds = new Set(
    nodes.filter((node) => node.type === "folder").map((node) => node.id),
  );
  return nodes
    .filter((node) => {
      const parent = node.type === "folder" ? node.parentId : node.folderId;
      const resolved = parent !== null && folderIds.has(parent) ? parent : null;
      return resolved === parentId;
    })
    .toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function PageItem({ page }: { page: Page }) {
  const params = useParams({ strict: false });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={params.pageId === page.id}
        render={<Link to="/page/$pageId" params={{ pageId: page.id }} />}
      >
        <HugeiconsIcon icon={File02Icon} />
        <span className="truncate">
          {page.title === "" ? "Untitled" : page.title}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function FolderItem({ folder, nodes }: { folder: Folder; nodes: Node[] }) {
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton>
              <HugeiconsIcon icon={Folder01Icon} />
              <span className="truncate">{folder.name}</span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="ml-auto transition-transform in-data-[panel-open]:rotate-90"
              />
            </SidebarMenuButton>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            <TreeLevel nodes={nodes} parentId={folder.id} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function TreeLevel({
  nodes,
  parentId,
}: {
  nodes: Node[];
  parentId: string | null;
}) {
  return childrenOf(nodes, parentId).map((node) =>
    node.type === "folder" ? (
      <FolderItem key={node.id} folder={node} nodes={nodes} />
    ) : (
      <PageItem key={node.id} page={node} />
    ),
  );
}

function useComposePage() {
  const navigate = useNavigate();
  return () => {
    const result = createPage(getNodesMap(), null);
    if (result.isOk()) {
      void navigate({
        to: "/page/$pageId",
        params: { pageId: result.value.id },
      });
    }
  };
}

function LibraryAction() {
  const compose = useComposePage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarGroupAction aria-label="Add page or folder">
            <HugeiconsIcon icon={Add01Icon} />
          </SidebarGroupAction>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={compose}>
            <HugeiconsIcon icon={File02Icon} />
            New page
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => createFolder(getNodesMap(), null, "New folder")}
          >
            <HugeiconsIcon icon={Folder01Icon} />
            New folder
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const nodes = useNodes();
  const compose = useComposePage();

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <span className="px-2 py-1 text-lg font-medium">rune</span>
          <button
            type="button"
            aria-label="New page"
            className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-4"
            onClick={compose}
          >
            <HugeiconsIcon icon={FileEditIcon} />
          </button>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setPaletteOpen(true)}>
              <HugeiconsIcon icon={Search01Icon} />
              Search
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/" activeOptions={{ exact: true }} />}
            >
              <HugeiconsIcon icon={Home01Icon} />
              Home
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/devices" />}>
              <HugeiconsIcon icon={ComputerPhoneSyncIcon} />
              Devices
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <LibraryAction />
          <SidebarGroupContent>
            <SidebarMenu>
              <TreeLevel nodes={nodes} parentId={null} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          local only
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
