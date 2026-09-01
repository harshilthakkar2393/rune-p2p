import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  File02Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder, createPage } from "@/lib/nodes";
import { selectPage, usePageSelection } from "@/lib/page-selection";
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
  const ids = new Set(
    nodes.filter((node) => node.type === "folder").map((node) => node.id),
  );
  return nodes
    .filter((node) => {
      const parent = node.type === "folder" ? node.parentId : node.folderId;
      const resolved = parent !== null && ids.has(parent) ? parent : null;
      return resolved === parentId;
    })
    .toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function pageTitle(page: Page): string {
  return page.title === "" ? "Untitled" : page.title;
}

function PageItem({ page }: { page: Page }) {
  const selectedId = usePageSelection();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={selectedId === page.id}
        onClick={() => selectPage(page.id)}
      >
        <HugeiconsIcon icon={File02Icon} />
        <span className="truncate">{pageTitle(page)}</span>
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

function NewNodeAction() {
  const newPage = () => {
    const result = createPage(getNodesMap(), null);
    if (result.isOk()) selectPage(result.value.id);
  };
  const newFolder = () => {
    createFolder(getNodesMap(), null, "New folder");
  };
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
          <DropdownMenuItem onClick={newPage}>
            <HugeiconsIcon icon={File02Icon} />
            New page
          </DropdownMenuItem>
          <DropdownMenuItem onClick={newFolder}>
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
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <span className="px-2 py-1 text-lg font-medium">rune</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <NewNodeAction />
          <SidebarGroupContent>
            <SidebarMenu>
              <TreeLevel nodes={nodes} parentId={null} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
