import { isMac, modLabel } from "@/lib/platform";
import { cn } from "@rune/ui/lib/utils";

/** Shortcut label. One size for glyph and letter: Geist lacks ⌘, so the font
 * stack falls to system-ui for it (see globals.css), which draws it to cap
 * height. Non-mac platforms get plain "Ctrl K". */
export function KbdHint({ letter, className }: { letter: string; className?: string }) {
  return (
    <span
      className={cn(
        "ml-auto font-mono text-tiny leading-4 text-muted-foreground opacity-0 transition-opacity group-hover/kbd:opacity-100",
        className,
      )}
    >
      {isMac ? `${modLabel}${letter}` : `${modLabel} ${letter}`}
    </span>
  );
}
