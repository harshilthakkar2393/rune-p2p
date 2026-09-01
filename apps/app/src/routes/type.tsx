import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { useTheme } from "@rune/ui/components/theme-provider";
import { Separator } from "@rune/ui/components/separator";

export const Route = createFileRoute("/type")({ component: TypePlayground });

/**
 * Throwaway type-tuning page. The editor's rendering is the REFERENCE;
 * the measured table below reads real computed styles from the DOM so the
 * app-wide tokens (globals.css --text-*) can be set to match it exactly.
 * Delete this route when the scale is settled.
 */

type Measured = {
  label: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
};

function measure(label: string, el: Element | null, pseudo?: string): Measured | null {
  if (!el) return null;
  const style = getComputedStyle(el, pseudo);
  return {
    label,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
  };
}

function useMeasurements(): Measured[] {
  const [rows, setRows] = useState<Measured[]>([]);

  useEffect(() => {
    const run = () => {
      const editor = document.querySelector(".bn-editor");
      if (!editor) return false;
      const heading = (level: string) =>
        editor.querySelector(`[data-content-type="heading"][data-level="${level}"] h${level}`) ??
        (level === "1" ? editor.querySelector('[data-content-type="heading"] h1') : null);
      const paragraph = editor.querySelector('[data-content-type="paragraph"] p');
      const emptyInline = editor.querySelector(
        '[data-content-type="paragraph"]:last-of-type .bn-inline-content',
      );
      const collected = [
        measure("editor h1", heading("1")),
        measure("editor h2", heading("2")),
        measure("editor h3", heading("3")),
        measure("editor body", paragraph),
        measure("editor placeholder", emptyInline, "::before"),
        measure("app h1 token", document.querySelector("[data-measure='h1']")),
        measure("app body token", document.querySelector("[data-measure='body']")),
      ].filter((row): row is Measured => row !== null);
      setRows(collected);
      return collected.length > 0;
    };
    if (run()) return;
    const timer = setInterval(() => {
      if (run()) clearInterval(timer);
    }, 300);
    return () => clearInterval(timer);
  }, []);

  return rows;
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
      { type: "paragraph" },
    ],
  });
  return <BlockNoteView editor={editor} theme={resolvedTheme} />;
}

function TypePlayground() {
  const rows = useMeasurements();

  return (
    <>
      <main className="mx-auto w-full max-w-3xl py-6 px-8">
        <h1 className="text-h1" data-measure="h1">
          Type scale
        </h1>
        <p className="mt-2 text-small text-muted-foreground">
          Editor below is the reference. Measured table shows real computed styles — set globals.css
          tokens from it. Throwaway page.
        </p>

        <section className="mt-8">
          <p className="mb-3 font-mono text-[11px] text-muted-foreground">
            measured (live from DOM)
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full font-mono text-[12px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-normal">element</th>
                  <th className="p-2 font-normal">size</th>
                  <th className="p-2 font-normal">line</th>
                  <th className="p-2 font-normal">weight</th>
                  <th className="p-2 font-normal">style</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="p-2">{row.label}</td>
                    <td className="p-2">{row.fontSize}</td>
                    <td className="p-2">{row.lineHeight}</td>
                    <td className="p-2">{row.fontWeight}</td>
                    <td className="p-2">{row.fontStyle}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="p-2 text-muted-foreground" colSpan={5}>
                      measuring…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-4">
          <span className="text-h2">app h2 token sample</span>
          <span className="text-h3">app h3 token sample</span>
          <span className="text-body" data-measure="body">
            app body token sample — reading text for pages and longform.
          </span>
          <span className="text-small">app small token — sidebar rows, captions.</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            2026-09-01 · local only · ⌘K
          </span>
        </section>

        <Separator className="my-10" />

        <section>
          <p className="mb-4 font-mono text-[11px] text-muted-foreground">
            blocknote editor (reference)
          </p>
          <ScratchEditor />
        </section>
      </main>
    </>
  );
}
