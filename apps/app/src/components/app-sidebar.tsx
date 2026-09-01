import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  ComputerPhoneSyncIcon,
  DashboardSquare01Icon,
  Delete02Icon,
  Home04Icon,
  PencilEdit02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { useNodes } from "@/hooks/use-index";
import { composeTargetFolderId } from "@/lib/compose-target";
import { getDeviceName } from "@/lib/device";
import { FOLDER_COLOR_VALUES, folderColorValue } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder, createPage } from "@/lib/nodes";
import { setPaletteOpen } from "@/lib/palette";
import { FOLDER_COLORS, type Folder, type FolderColor } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
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
  SidebarMenuButton,
  SidebarMenuItem,
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

function useComposePage() {
  const navigate = useNavigate();
  return () => {
    const map = getNodesMap();
    const result = createPage(map, composeTargetFolderId(map), {
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
  const navigate = useNavigate();

  const confirm = () => {
    if (name.trim() === "") return;
    const result = createFolder(getNodesMap(), null, name.trim(), color);
    setName("");
    setOpen(false);
    if (result.isOk()) {
      void navigate({
        to: "/folder/$folderId",
        params: { folderId: result.value.id },
      });
    }
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
              <FolderGlyph className="size-4" color={FOLDER_COLOR_VALUES[color]} />
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
            <Button size="icon" aria-label="Create folder" onClick={confirm}>
              <Icon icon={Tick02Icon} className="size-4!" />
            </Button>
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

  const folders = nodes
    .filter(
      (node): node is Folder =>
        node.type === "folder" && node.deletedAt === undefined && node.parentId === null,
    )
    .toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));

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
              {folders.map((folder) => (
                <SidebarMenuItem key={folder.id}>
                  <SidebarMenuButton
                    render={<Link to="/folder/$folderId" params={{ folderId: folder.id }} />}
                  >
                    <FolderGlyph
                      className="size-4.5"
                      color={folderColorValue(folder.color) ?? "var(--muted-foreground)"}
                    />
                    <span className="truncate">{folder.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
