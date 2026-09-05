import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  LaptopPhoneSyncIcon,
  DashboardSquare01Icon,
  Delete02Icon,
  Home04Icon,
  PencilEdit02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { KbdHint } from "@/components/kbd-hint";
import { Tip } from "@/components/tip";
import { Wordmark } from "@/components/wordmark";
import { useComposePage } from "@/hooks/use-compose-page";
import { useNodes } from "@/hooks/use-index";
import { FOLDER_COLOR_VALUES, folderColorValue } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder } from "@/lib/nodes";
import { modLabel } from "@/lib/platform";
import { setPaletteOpen } from "@/lib/palette";
import { FOLDER_COLORS, type Folder, type FolderColor } from "@/lib/schema";
import { useSyncStatus } from "@/lib/sync/status";
import { Button } from "@rune/ui/components/button";
import { cn } from "@rune/ui/lib/utils";
import { Kbd } from "@rune/ui/components/kbd";
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
  useSidebar,
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
        to: "/pages/$folderId",
        params: { folderId: result.value.id },
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label="New folder">
        <PopoverTrigger
          render={
            <SidebarGroupAction aria-label="New folder">
              <Icon icon={Add01Icon} className="size-4!" />
            </SidebarGroupAction>
          }
        />
      </Tip>
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
            <Tip label="Create folder">
              <Button size="icon" aria-label="Create folder" onClick={confirm}>
                <Icon icon={Tick02Icon} className="size-4!" />
              </Button>
            </Tip>
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

/** The one primary action: a real button above the nav rows (rows stay
 * ghost). Collapsed rail = icon square + tooltip; expanded = label + hover kbd. */
function NewPageButton({ onClick }: { onClick: () => void }) {
  const { state } = useSidebar();
  const button = (
    <Button
      variant="outline"
      size="lg"
      aria-label="New page"
      onClick={onClick}
      className="group/kbd w-full justify-start gap-2 pl-[calc(--spacing(2.5)-1px)] font-normal group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
    >
      <Icon icon={PencilEdit02Icon} className="size-4!" />
      <span className="group-data-[collapsible=icon]:hidden">New page</span>
      <KbdHint letter="N" className="group-data-[collapsible=icon]:hidden" />
    </Button>
  );
  if (state !== "collapsed") return button;
  return (
    <Tip
      label={
        <>
          New page <Kbd>{modLabel}N</Kbd>
        </>
      }
    >
      {button}
    </Tip>
  );
}

/** Footer wording for the sync state; short because the rail truncates. */
function syncLabel(sync: ReturnType<typeof useSyncStatus>): string {
  if (!sync.paired) return "not paired";
  if (sync.reconnecting) return "reconnecting…";
  if (sync.connected) {
    const n = sync.peers.length;
    return `${n} device${n === 1 ? "" : "s"} online`;
  }
  return "looking for devices…";
}

export function AppSidebar() {
  const nodes = useNodes();
  const compose = useComposePage();
  const sync = useSyncStatus();
  const { peers } = sync;

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
          <Wordmark className="px-2 py-1 text-h2 group-data-[collapsible=icon]:hidden" />
          <Tip
            label={
              <>
                Toggle sidebar <Kbd>{modLabel}B</Kbd>
              </>
            }
          >
            <SidebarTrigger className="text-sidebar-foreground/70" />
          </Tip>
        </div>
        <NewPageButton onClick={compose} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={{
                children: (
                  <>
                    Search <Kbd>{modLabel}K</Kbd>
                  </>
                ),
              }}
              className="group/kbd"
              onClick={() => setPaletteOpen(true)}
            >
              <Icon icon={Search01Icon} />
              Search
              <KbdHint letter="K" />
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
              tooltip="Pages"
              render={<Link to="/pages" activeOptions={{ exact: true }} />}
            >
              <Icon icon={DashboardSquare01Icon} />
              Pages
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={peers.length > 0 ? `Devices · ${peers.length} online` : "Devices"}
              render={<Link to="/devices" />}
            >
              <Icon icon={LaptopPhoneSyncIcon} />
              Devices
              {peers.length > 0 && (
                <span className="ml-auto font-mono text-tiny text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {peers.length} online
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Trash"
              className="text-destructive/75 hover:bg-destructive/10 hover:text-destructive"
              render={<Link to="/trash" />}
            >
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
                    render={<Link to="/pages/$folderId" params={{ folderId: folder.id }} />}
                  >
                    <FolderGlyph
                      className="size-4.5!"
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
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              sync.connected ? "bg-[oklch(0.68_0.16_150)]" : "bg-muted-foreground/50",
            )}
          />
          <span className="group-data-[collapsible=icon]:hidden">{syncLabel(sync)}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
