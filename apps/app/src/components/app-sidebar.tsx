import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  ComputerPhoneSyncIcon,
  Delete02Icon,
  File02Icon,
  Folder01Icon,
  FolderTransferIcon,
  Home04Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder, createPage, moveNode, removeNode, renameNode } from "@/lib/nodes";
import { destroyPageDoc } from "@/lib/page-doc";
import { setPaletteOpen } from "@/lib/palette";
import type { Folder, Node, Page } from "@/lib/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rune/ui/components/alert-dialog";
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@rune/ui/components/sidebar";

function Icon({ icon, className }: { icon: IconSvgElement; className?: string }) {
  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={1.75}
      className={className ?? "size-4.5!"}
    />
  );
}

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

type PendingDelete = { node: Node; label: string } | null;

type RowMenuProps = {
  node: Node;
  nodes: Node[];
  onRename: () => void;
  onDelete: () => void;
  onNewPageInside?: () => void;
};

function isDescendantFolder(nodes: Node[], folderId: string, candidateId: string): boolean {
  let current: string | null = candidateId;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  while (current !== null) {
    if (current === folderId) return true;
    const node = byId.get(current);
    current = node?.type === "folder" ? node.parentId : null;
  }
  return false;
}

function RowMenu({ node, nodes, onRename, onDelete, onNewPageInside }: RowMenuProps) {
  const folders = nodes.filter((n): n is Folder => n.type === "folder");
  const currentParent = node.type === "folder" ? node.parentId : node.folderId;
  const moveTargets = folders.filter((folder) => {
    if (folder.id === currentParent) return false;
    if (node.type === "folder" && isDescendantFolder(nodes, node.id, folder.id))
      return false;
    return true;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuAction showOnHover aria-label="More actions">
            <Icon icon={MoreHorizontalIcon} className="size-4!" />
          </SidebarMenuAction>
        }
      />
      <DropdownMenuContent align="start" side="right">
        <DropdownMenuGroup>
          {onNewPageInside && (
            <DropdownMenuItem onClick={onNewPageInside}>
              <Icon icon={File02Icon} className="size-4!" />
              New page inside
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onRename}>
            <Icon icon={PencilEdit01Icon} className="size-4!" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icon icon={FolderTransferIcon} className="size-4!" />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {currentParent !== null && (
                <DropdownMenuItem
                  onClick={() => moveNode(getNodesMap(), node.id, null)}
                >
                  Library root
                </DropdownMenuItem>
              )}
              {moveTargets.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => moveNode(getNodesMap(), node.id, folder.id)}
                >
                  <Icon icon={Folder01Icon} className="size-4!" />
                  {folder.name}
                </DropdownMenuItem>
              ))}
              {moveTargets.length === 0 && currentParent === null && (
                <DropdownMenuItem disabled>No folders</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Icon icon={Delete02Icon} className="size-4!" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SidebarInput
      autoFocus
      value={value}
      className="h-7 text-[13px]"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit(value);
        if (event.key === "Escape") onCancel();
      }}
    />
  );
}

function PageItem({
  page,
  nodes,
  requestDelete,
}: {
  page: Page;
  nodes: Node[];
  requestDelete: (pending: PendingDelete) => void;
}) {
  const params = useParams({ strict: false });
  const [renaming, setRenaming] = useState(false);
  const title = page.title === "" ? "Untitled" : page.title;

  if (renaming) {
    return (
      <SidebarMenuItem>
        <RenameInput
          initial={page.title}
          onCommit={(value) => {
            renameNode(getNodesMap(), page.id, value);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={params.pageId === page.id}
        render={<Link to="/page/$pageId" params={{ pageId: page.id }} />}
      >
        <Icon icon={File02Icon} />
        <span className="truncate">{title}</span>
      </SidebarMenuButton>
      <RowMenu
        node={page}
        nodes={nodes}
        onRename={() => setRenaming(true)}
        onDelete={() => requestDelete({ node: page, label: title })}
      />
    </SidebarMenuItem>
  );
}

function FolderItem({
  folder,
  nodes,
  requestDelete,
}: {
  folder: Folder;
  nodes: Node[];
  requestDelete: (pending: PendingDelete) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const navigate = useNavigate();

  const newPageInside = () => {
    const result = createPage(getNodesMap(), folder.id);
    if (result.isOk()) {
      void navigate({
        to: "/page/$pageId",
        params: { pageId: result.value.id },
      });
    }
  };

  if (renaming) {
    return (
      <SidebarMenuItem>
        <RenameInput
          initial={folder.name}
          onCommit={(value) => {
            if (value.trim() !== "") renameNode(getNodesMap(), folder.id, value);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton>
              <Icon icon={Folder01Icon} />
              <span className="truncate">{folder.name}</span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="ml-auto transition-transform in-data-[panel-open]:rotate-90"
              />
            </SidebarMenuButton>
          }
        />
        <RowMenu
          node={folder}
          nodes={nodes}
          onRename={() => setRenaming(true)}
          onDelete={() => requestDelete({ node: folder, label: folder.name })}
          onNewPageInside={newPageInside}
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            <TreeLevel
              nodes={nodes}
              parentId={folder.id}
              requestDelete={requestDelete}
            />
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function TreeLevel({
  nodes,
  parentId,
  requestDelete,
}: {
  nodes: Node[];
  parentId: string | null;
  requestDelete: (pending: PendingDelete) => void;
}) {
  return childrenOf(nodes, parentId).map((node) =>
    node.type === "folder" ? (
      <FolderItem
        key={node.id}
        folder={node}
        nodes={nodes}
        requestDelete={requestDelete}
      />
    ) : (
      <PageItem
        key={node.id}
        page={node}
        nodes={nodes}
        requestDelete={requestDelete}
      />
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
            <Icon icon={Add01Icon} className="size-4!" />
          </SidebarGroupAction>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={compose}>
            <Icon icon={File02Icon} className="size-4!" />
            New page
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => createFolder(getNodesMap(), null, "New folder")}
          >
            <Icon icon={Folder01Icon} className="size-4!" />
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
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { node } = pendingDelete;
    const result = removeNode(getNodesMap(), node.id);
    if (result.isOk()) {
      for (const pageId of result.value.removedPageIds) {
        void destroyPageDoc(pageId);
      }
      const openPageGone =
        params.pageId !== undefined &&
        result.value.removedPageIds.includes(params.pageId);
      if (openPageGone) void navigate({ to: "/" });
    }
    setPendingDelete(null);
  };

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <span className="px-2 py-1 text-lg font-medium group-data-[collapsible=icon]:hidden">
              rune
            </span>
            <button
              type="button"
              aria-label="New page"
              className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={compose}
            >
              <Icon icon={PencilEdit02Icon} />
            </button>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Search"
                onClick={() => setPaletteOpen(true)}
              >
                <Icon icon={Search01Icon} />
                Search
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Home"
                render={<Link to="/" activeOptions={{ exact: true }} />}
              >
                <Icon icon={Home04Icon} />
                Home
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Devices"
                render={<Link to="/devices" />}
              >
                <Icon icon={ComputerPhoneSyncIcon} />
                Devices
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Library</SidebarGroupLabel>
            <LibraryAction />
            <SidebarGroupContent>
              <SidebarMenu>
                <TreeLevel
                  nodes={nodes}
                  parentId={null}
                  requestDelete={setPendingDelete}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1 font-mono text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center">
            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="group-data-[collapsible=icon]:hidden">
              local only
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.node.type === "folder" ? "folder" : "page"}{" "}
              “{pendingDelete?.label}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.node.type === "folder"
                ? "Everything inside — pages and subfolders — is deleted with it. This cannot be undone."
                : "The page and its content are deleted. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
