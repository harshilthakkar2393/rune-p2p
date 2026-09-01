import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  Clock01Icon,
  Delete02Icon,
  Download04Icon,
  LaptopIcon,
  TextAlignJustifyCenterIcon,
} from "@hugeicons/core-free-icons";

import { getActiveEditor } from "@/lib/editor-ref";
import { getPageWordCount } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import { trashNode } from "@/lib/nodes";
import type { Folder, Page } from "@/lib/schema";
import { Badge } from "@rune/ui/components/badge";
import { Button } from "@rune/ui/components/button";

function Row({ icon, label, value }: { icon: IconSvgElement; label: string; value: string }) {
  return (
    <div className="flex h-7 items-center gap-2.5">
      <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-4! text-muted-foreground/70" />
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono text-xs text-foreground/90">{value}</span>
    </div>
  );
}

async function exportMarkdown(page: Page) {
  const editor = getActiveEditor();
  if (!editor) return;
  const markdown = await editor.blocksToMarkdownLossy(editor.document);
  const title = page.title === "" ? "untitled" : page.title;
  const blob = new Blob([`# ${title}\n\n${markdown}`], { type: "text/markdown" });
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
    <aside className="flex w-[264px] shrink-0 flex-col gap-5 border-l px-4 py-4">
      <section className="flex flex-col gap-1">
        <span className="pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          Properties
        </span>
        <Row
          icon={Calendar03Icon}
          label="Created"
          value={new Date(page.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        />
        <Row icon={Clock01Icon} label="Updated" value={humanTime(page.updatedAt)} />
        <Row icon={LaptopIcon} label="Device" value={page.createdOn ?? "—"} />
        <Row
          icon={TextAlignJustifyCenterIcon}
          label="Words"
          value={words === null ? "…" : String(words)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          Folder
        </span>
        {folder ? (
          <Badge variant="secondary" className="w-fit gap-1.5 font-normal">
            {folderTint && (
              <span className="size-[7px] rounded-full" style={{ background: folderTint }} />
            )}
            {folder.name}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Library root</span>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          Storage
        </span>
        <span className="flex items-center gap-2 text-[13px]">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          On this device
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">local only</span>
      </section>

      <section className="mt-auto -mx-2 flex flex-col gap-0.5 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start font-normal text-foreground/85"
          onClick={() => void exportMarkdown(page)}
        >
          <HugeiconsIcon icon={Download04Icon} strokeWidth={1.75} />
          Export Markdown
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start font-normal text-destructive hover:text-destructive"
          onClick={sendToTrash}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
          Move to trash
        </Button>
      </section>
    </aside>
  );
}
