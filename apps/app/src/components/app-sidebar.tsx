import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  LaptopPhoneSyncIcon,
  File02Icon,
  Delete02Icon,
  Home04Icon,
  PencilEdit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { NewFolderPopover } from "@/components/new-folder-popover";
import { KbdHint } from "@/components/kbd-hint";
import { Tip } from "@/components/tip";
import { Wordmark } from "@/components/wordmark";
import { useComposePage } from "@/hooks/use-compose-page";
import { useNodes } from "@/hooks/use-index";
import { folderColorValue } from "@/lib/folder-colors";
import { modLabel } from "@/lib/platform";
import { setPaletteOpen } from "@/lib/palette";
import type { Folder } from "@/lib/schema";
import { useSyncStatus } from "@/lib/sync/status";
import { Button } from "@rune/ui/components/button";
import { cn } from "cn";
import { Kbd } from "@rune/ui/components/kbd";
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
              <Icon icon={File02Icon} />
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
          <SidebarGroupLabel
            render={<Link to="/folders" activeOptions={{ exact: true }} />}
            className="hover:text-sidebar-foreground data-[status=active]:text-sidebar-foreground"
          >
            Folders
          </SidebarGroupLabel>
          <NewFolderPopover
            trigger={
              <SidebarGroupAction aria-label="New folder">
                <Icon icon={Add01Icon} className="size-4!" />
              </SidebarGroupAction>
            }
          />
          <SidebarGroupContent>
            <SidebarMenu>
              {folders.map((folder) => (
                <SidebarMenuItem key={folder.id}>
                  <SidebarMenuButton
                    render={<Link to="/folders/$folderId" params={{ folderId: folder.id }} />}
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
