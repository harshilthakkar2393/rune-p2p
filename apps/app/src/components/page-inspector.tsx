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

import { Tip } from "@/components/tip";
import { getActiveEditor } from "@/lib/editor-ref";
import { getPageWordCount } from "@/lib/excerpt";
import { folderColorValue } from "@/lib/folder-colors";
import { humanTime } from "@/lib/human-time";
import { getNodesMap } from "@/lib/index-doc";
import { trashNode } from "@/lib/nodes";
import type { Folder, Page } from "@/lib/schema";
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
import { Badge } from "@rune/ui/components/badge";
import { Button } from "@rune/ui/components/button";
import { ScrollArea } from "@rune/ui/components/scroll-area";

function Row({ icon, label, value }: { icon: IconSvgElement; label: string; value: string }) {
  return (
    <div className="flex h-7 items-center gap-2.5">
      <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-4! text-muted-foreground/70" />
      <span className="text-small text-muted-foreground">{label}</span>
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

export function PageInspector({
  page,
  folder,
  phone = false,
}: {
  page: Page;
  folder: Folder | undefined;
  /** In the phone drawer: touch-sized actions, no tooltips. */
  phone?: boolean;
}) {
  const navigate = useNavigate();
  const [words, setWords] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
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
    <ScrollArea className="h-full min-h-0">
      <div className="flex h-full flex-col gap-5 p-4">
        <section className="flex flex-col gap-1">
          <span className="pb-1 text-tiny font-medium tracking-wide text-muted-foreground/70 uppercase">
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
          <span className="text-tiny font-medium tracking-wide text-muted-foreground/70 uppercase">
            Folder
          </span>
          {folder ? (
            <Badge variant="secondary" className="w-fit gap-1.5 font-normal">
              {folderTint && (
                <span className="size-1.75 rounded-full" style={{ background: folderTint }} />
              )}
              {folder.name}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <span className="text-tiny font-medium tracking-wide text-muted-foreground/70 uppercase">
            Storage
          </span>
          <span className="flex items-center gap-2 text-small">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
            On this device
          </span>
          <span className="font-mono text-tiny text-muted-foreground">local only</span>
        </section>

        <section className="mt-auto flex items-center justify-end gap-2">
          <MaybeTip label="Export Markdown" enabled={!phone}>
            <Button
              variant="secondary"
              size={phone ? "icon-lg" : "icon"}
              aria-label="Export Markdown"
              onClick={() => void exportMarkdown(page)}
            >
              <HugeiconsIcon icon={Download04Icon} strokeWidth={1.75} />
            </Button>
          </MaybeTip>
          <MaybeTip label="Move to trash" enabled={!phone}>
            <Button
              variant="destructive"
              size={phone ? "icon-lg" : "icon"}
              aria-label="Move to trash"
              onClick={() => setConfirming(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
            </Button>
          </MaybeTip>
        </section>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              “{page.title === "" ? "Untitled" : page.title}” goes to Trash, where it stays for 30
              days before it is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={sendToTrash}>
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

/** Tooltips are for pointers; on touch the trigger wrapper only gets in the way. */
function MaybeTip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactElement;
}) {
  return enabled ? <Tip label={label}>{children}</Tip> : children;
}
