import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  ComputerPhoneSyncIcon,
  DashboardSquare01Icon,
  Delete02Icon,
  File02Icon,
  Folder01Icon,
  FolderTransferIcon,
  Home04Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { useNodes } from "@/hooks/use-index";
import { getDeviceName } from "@/lib/device";
import { FOLDER_COLOR_VALUES, folderColorValue } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder, createPage, moveNode, renameNode, trashNode } from "@/lib/nodes";
import { setPaletteOpen } from "@/lib/palette";
import { FOLDER_COLORS, type Folder, type FolderColor, type Node, type Page } from "@/lib/schema";
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
import { Popover, PopoverContent, PopoverTrigger } from "@rune/ui/components/popover";
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
  SidebarTrigger,
} from "@rune/ui/components/sidebar";

function Icon({
  icon,
  className,
  color,
}: {
  icon: IconSvgElement;
  className?: string;
  color?: string;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={1.75}
      className={className ?? "size-4.5!"}
      style={color ? { color } : undefined}
    />
  );
}

function childrenOf(nodes: Node[], parentId: string | null): Node[] {
  const folderIds = new Set(nodes.filter((node) => node.type === "folder").map((node) => node.id));
  return nodes
    .filter((node) => {
      if (node.deletedAt !== undefined) return false;
      const parent = node.type === "folder" ? node.parentId : node.folderId;
      const resolved = parent !== null && folderIds.has(parent) ? parent : null;
      return resolved === parentId;
    })
    .toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));
}

type RowMenuProps = {
  node: Node;
  nodes: Node[];
  onRename: () => void;
  onTrash: () => void;
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

function RowMenu({ node, nodes, onRename, onTrash, onNewPageInside }: RowMenuProps) {
  const folders = nodes.filter(
    (n): n is Folder => n.type === "folder" && n.deletedAt === undefined,
  );
  const currentParent = node.type === "folder" ? node.parentId : node.folderId;
  const moveTargets = folders.filter((folder) => {
    if (folder.id === currentParent) return false;
    if (node.type === "folder" && isDescendantFolder(nodes, node.id, folder.id)) return false;
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
                <DropdownMenuItem onClick={() => moveNode(getNodesMap(), node.id, null)}>
                  Library root
                </DropdownMenuItem>
              )}
              {moveTargets.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => moveNode(getNodesMap(), node.id, folder.id)}
                >
                  <Icon
                    icon={Folder01Icon}
                    className="size-4!"
                    color={folderColorValue(folder.color)}
                  />
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
        <DropdownMenuItem onClick={onTrash}>
          <Icon icon={Delete02Icon} className="size-4!" />
          Move to trash
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

function useTrashNode() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  return (id: string) => {
    trashNode(getNodesMap(), id);
    const openPage = params.pageId ? getNodesMap().get(params.pageId) : undefined;
    if (openPage && openPage.deletedAt !== undefined) {
      void navigate({ to: "/" });
    }
  };
}

function PageItem({ page, nodes }: { page: Page; nodes: Node[] }) {
  const params = useParams({ strict: false });
  const [renaming, setRenaming] = useState(false);
  const sendToTrash = useTrashNode();
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
        onTrash={() => sendToTrash(page.id)}
      />
    </SidebarMenuItem>
  );
}

function FolderItem({ folder, nodes }: { folder: Folder; nodes: Node[] }) {
  const [renaming, setRenaming] = useState(false);
  const navigate = useNavigate();
  const sendToTrash = useTrashNode();

  const newPageInside = () => {
    const result = createPage(getNodesMap(), folder.id, {
      createdOn: getDeviceName(),
    });
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
              <Icon icon={Folder01Icon} color={folderColorValue(folder.color)} />
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
          onTrash={() => sendToTrash(folder.id)}
          onNewPageInside={newPageInside}
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

function TreeLevel({ nodes, parentId }: { nodes: Node[]; parentId: string | null }) {
  return childrenOf(nodes, parentId).map((node) =>
    node.type === "folder" ? (
      <FolderItem key={node.id} folder={node} nodes={nodes} />
    ) : (
      <PageItem key={node.id} page={node} nodes={nodes} />
    ),
  );
}

function useComposePage() {
  const navigate = useNavigate();
  return () => {
    const result = createPage(getNodesMap(), null, {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({
        to: "/page/$pageId",
        params: { pageId: result.value.id },
      });
    }
  };
}

function NewFolderPopover() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor>("blue");

  const confirm = () => {
    if (name.trim() === "") return;
    createFolder(getNodesMap(), null, name.trim(), color);
    setName("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <SidebarGroupAction aria-label="New folder">
            <Icon icon={Add01Icon} className="size-4!" />
          </SidebarGroupAction>
        }
      />
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Icon icon={Folder01Icon} className="size-4!" color={FOLDER_COLOR_VALUES[color]} />
            </span>
            <SidebarInput
              autoFocus
              placeholder="Folder name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirm();
                if (event.key === "Escape") setOpen(false);
              }}
            />
            <button
              type="button"
              aria-label="Create folder"
              onClick={confirm}
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
              <Icon icon={Tick02Icon} className="size-4!" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-1">
            {FOLDER_COLORS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-label={`Color ${candidate}`}
                onClick={() => setColor(candidate)}
                className="flex size-5 items-center justify-center rounded-full"
                style={{
                  outline: candidate === color ? "2px solid var(--foreground)" : undefined,
                  outlineOffset: 2,
                }}
              >
                <span
                  className="size-4 rounded-full"
                  style={{ background: FOLDER_COLOR_VALUES[candidate] }}
                />
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppSidebar() {
  const nodes = useNodes();
  const compose = useComposePage();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <span className="px-2 py-1 text-lg font-medium group-data-[collapsible=icon]:hidden">
            rune
          </span>
          <SidebarTrigger className="text-sidebar-foreground/70" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New page" onClick={compose}>
              <Icon icon={PencilEdit02Icon} />
              New page
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search" onClick={() => setPaletteOpen(true)}>
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
            <SidebarMenuButton tooltip="Library" render={<Link to="/library" />}>
              <Icon icon={DashboardSquare01Icon} />
              Library
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Devices" render={<Link to="/devices" />}>
              <Icon icon={ComputerPhoneSyncIcon} />
              Devices
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Trash" render={<Link to="/trash" />}>
              <Icon icon={Delete02Icon} />
              Trash
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <NewFolderPopover />
          <SidebarGroupContent>
            <SidebarMenu>
              <TreeLevel nodes={nodes} parentId={null} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1 font-mono text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center">
          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
          <span className="group-data-[collapsible=icon]:hidden">local only</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
