import { cn } from "cn";

/**
 * ᚱune — the real Elder Futhark raidō (U+16B1) as the R, set in Noto Sans
 * Runic as the font draws it, followed by "une" in Geist 400 at -4%.
 * Size with a text-* class on the wrapper; the rune scales at 95% of it.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center font-normal tracking-wordmark", className)}>
      <span
        data-slot="wordmark-rune"
        className="font-runic text-[0.95em] leading-none"
        aria-hidden="true"
      >
        ᚱ
      </span>
      <span className="sr-only">R</span>
      une
    </span>
  );
}
