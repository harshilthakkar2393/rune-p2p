import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Clock01Icon,
  ComputerIcon,
  Delete02Icon,
  Download04Icon,
  PencilEdit01Icon,
  TextAlignLeftIcon,
} from "@hugeicons/core-free-icons";

import { getActiveEditor } from "@/lib/editor-ref";
import { getPageWordCount } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import { trashNode } from "@/lib/nodes";
import type { Folder, Page } from "@/lib/schema";
import { Button } from "@rune/ui/components/button";

function Row({ icon, label, value }: { icon: IconSvgElement; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={1.75}
        className="size-[15px]! text-muted-foreground"
      />
      <span className="w-[72px] text-[13px] text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono text-xs">{value}</span>
    </div>
  );
}

async function exportMarkdown(page: Page) {
  const editor = getActiveEditor();
  if (!editor) return;
  const markdown = await editor.blocksToMarkdownLossy(editor.document);
  const title = page.title === "" ? "untitled" : page.title;
  const blob = new Blob([`# ${title}\n\n${markdown}`], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^\w\-. ]+/g, "_")}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PageInspector({ page, folder }: { page: Page; folder: Folder | undefined }) {
  const navigate = useNavigate();
  const [words, setWords] = useState<number | null>(null);
  const folderTint = folderColorValue(folder?.color);

  useEffect(() => {
    let cancelled = false;
    void getPageWordCount(page.id).then((count) => {
      if (!cancelled) setWords(count);
    });
    return () => {
      cancelled = true;
    };
  }, [page.id, page.updatedAt]);

  const sendToTrash = () => {
    trashNode(getNodesMap(), page.id);
    void navigate({ to: "/" });
  };

  return (
    <aside className="my-2 mr-2 flex w-[280px] shrink-0 flex-col gap-4 rounded-xl border bg-card p-4 text-[13px]">
      <span className="text-[11px] text-muted-foreground">Properties</span>
      <div className="flex flex-col gap-3">
        <Row
          icon={Clock01Icon}
          label="Created"
          value={new Date(page.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        />
        <Row icon={PencilEdit01Icon} label="Updated" value={humanTime(page.updatedAt)} />
        <Row icon={ComputerIcon} label="Device" value={page.createdOn ?? "—"} />
        <Row icon={TextAlignLeftIcon} label="Words" value={words === null ? "…" : String(words)} />
      </div>

      <div className="flex flex-col gap-2.5 border-t pt-3.5">
        <span className="text-[11px] text-muted-foreground">Folder</span>
        {folder ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 text-xs">
            {folderTint && (
              <span className="size-[7px] rounded-full" style={{ background: folderTint }} />
            )}
            {folder.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Library root</span>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3.5">
        <span className="text-[11px] text-muted-foreground">Storage</span>
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          On this device
        </span>
        <span className="font-mono text-xs text-muted-foreground">local only</span>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="outline" size="sm" onClick={() => void exportMarkdown(page)}>
          <HugeiconsIcon icon={Download04Icon} strokeWidth={1.75} />
          Export Markdown
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={sendToTrash}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
          Move to trash
        </Button>
      </div>
    </aside>
  );
}
