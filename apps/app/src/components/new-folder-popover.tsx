import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { FolderGlyph } from "@/components/folder-glyph";
import { Tip } from "@/components/tip";
import { FOLDER_COLOR_VALUES } from "@/lib/folder-colors";
import { getNodesMap } from "@/lib/index-doc";
import { createFolder } from "@/lib/nodes";
import { FOLDER_COLORS, type FolderColor } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rune/ui/components/popover";
import { SidebarInput } from "@rune/ui/components/sidebar";

/** Name + colour popover that creates a folder and opens it. `trigger` is the
 * element that opens it: the sidebar's group action, or the ghost tile on /folders. */
export function NewFolderPopover({ trigger }: { trigger: React.ReactElement }) {
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
        to: "/folders/$folderId",
        params: { folderId: result.value.id },
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label="New folder">
        <PopoverTrigger render={trigger} />
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
                <HugeiconsIcon icon={Tick02Icon} strokeWidth={1.75} className="size-4!" />
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
