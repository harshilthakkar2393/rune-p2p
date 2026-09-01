import { isMac, modLabel } from "@/lib/platform";

/** Shortcut label: ⌘ glyph sits a size up so it doesn't read smaller than
 * the letter; non-mac platforms get plain "Ctrl K". */
export function KbdHint({ letter }: { letter: string }) {
  return (
    <span className="ml-auto font-mono text-[11px] leading-4 text-muted-foreground opacity-0 transition-opacity group-hover/kbd:opacity-100">
      {isMac ? (
        <>
          <span className="text-[13px] leading-4">⌘</span>
          {letter}
        </>
      ) : (
        `${modLabel} ${letter}`
      )}
    </span>
  );
}
