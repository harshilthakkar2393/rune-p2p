import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { File02Icon, Folder01Icon } from "@hugeicons/core-free-icons";

import { useNodes } from "@/hooks/use-index";
import { setPaletteOpen, usePaletteOpen } from "@/lib/palette";
import type { Folder, Page } from "@/lib/schema";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@rune/ui/components/command";

/**
 * ⌘K palette. v1 searches titles/folder names from the index (instant).
 * Content search (scanning page Y.Docs) is a planned upgrade.
 */
export function SearchPalette() {
  const open = usePaletteOpen();
  const nodes = useNodes();
  const navigate = useNavigate();

  const openPage = (pageId: string) => {
    setPaletteOpen(false);
    void navigate({ to: "/page/$pageId", params: { pageId } });
  };

  const pages = nodes.filter((node): node is Page => node.type === "page");
  const folders = nodes.filter((node): node is Folder => node.type === "folder");

  return (
    <CommandDialog open={open} onOpenChange={setPaletteOpen}>
      <Command>
        <CommandInput placeholder="Search pages and folders…" />
        <CommandList>
          <CommandEmpty>No pages match. Try another word.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.id}
                value={`${page.title || "Untitled"} ${page.id}`}
                onSelect={() => openPage(page.id)}
              >
                <HugeiconsIcon icon={File02Icon} />
                {page.title === "" ? "Untitled" : page.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Folders">
            {folders.map((folder) => (
              <CommandItem key={folder.id} value={`${folder.name} ${folder.id}`} disabled>
                <HugeiconsIcon icon={Folder01Icon} />
                {folder.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
