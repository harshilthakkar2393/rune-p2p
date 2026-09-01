import { createFileRoute } from "@tanstack/react-router";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { useTheme } from "@rune/ui/components/theme-provider";
import { Separator } from "@rune/ui/components/separator";
import { SidebarTrigger } from "@rune/ui/components/sidebar";

export const Route = createFileRoute("/type")({ component: TypePlayground });

/**
 * Throwaway type-tuning page. The scale lives in ONE place —
 * packages/ui/src/styles/globals.css (--text-h1 … --text-small) — so
 * numbers changed there move both columns below at once. Delete this
 * route when the scale is settled.
 */

function Sample({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-6">
      <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function ScratchEditor() {
  const { resolvedTheme } = useTheme();
  // Deliberately no collaboration/persistence: throwaway in-memory doc.
  const editor = useCreateBlockNote({
    initialContent: [
      { type: "heading", props: { level: 1 }, content: "Heading one" },
      { type: "heading", props: { level: 2 }, content: "Heading two" },
      { type: "heading", props: { level: 3 }, content: "Heading three" },
      {
        type: "paragraph",
        content:
          "Body text for comparison. The quick brown fox jumps over the lazy dog, then writes it down before the thought escapes.",
      },
      {
        type: "paragraph",
        content:
          "A second paragraph to judge rhythm and spacing between blocks at the current line-height.",
      },
    ],
  });
  return <BlockNoteView editor={editor} theme={resolvedTheme} />;
}

function TypePlayground() {
  return (
    <>
      <header className="flex items-center px-2 pt-1">
        <SidebarTrigger />
      </header>
      <main className="mx-auto w-full max-w-3xl py-6 px-8">
        <h1 className="text-h1">Type scale</h1>
        <p className="mt-2 text-small text-muted-foreground">
          Tune in globals.css → both columns move. Throwaway page.
        </p>

        <section className="mt-10 flex flex-col gap-5">
          <Sample label="h1 / 28px">
            <span className="text-h1">Good evening</span>
          </Sample>
          <Sample label="h2 / 22px">
            <span className="text-h2">Section heading</span>
          </Sample>
          <Sample label="h3 / 18px">
            <span className="text-h3">Subsection heading</span>
          </Sample>
          <Sample label="body / 16px">
            <span className="text-body">
              Body text — the reading size for pages and anything longform.
            </span>
          </Sample>
          <Sample label="small / 13px">
            <span className="text-small">
              Small — sidebar rows, captions, descriptions.
            </span>
          </Sample>
          <Sample label="mono / 11px">
            <span className="font-mono text-[11px] text-muted-foreground">
              2026-09-01 · local only · ⌘K
            </span>
          </Sample>
        </section>

        <Separator className="my-10" />

        <section>
          <p className="mb-4 font-mono text-[11px] text-muted-foreground">
            blocknote editor (same tokens)
          </p>
          <ScratchEditor />
        </section>
      </main>
    </>
  );
}
