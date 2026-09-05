/**
 * iOS PWAs come back from the background (or from a keyboard session) with a
 * stale layout: the window scrolled under a keyboard that is gone, or a
 * visual viewport that has not been re-measured. Nothing fires a resize for
 * that, so fixed elements (the dock, the search field) sit in the wrong
 * place. This subscribes to every signal that means "the viewport may have
 * changed" and calls back immediately and again after iOS settles.
 */
export function onViewportChange(callback: () => void): () => void {
  const viewport = window.visualViewport;
  let timers: number[] = [];
  const fire = () => {
    for (const timer of timers) window.clearTimeout(timer);
    callback();
    timers = [60, 300].map((delay) => window.setTimeout(callback, delay));
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") fire();
  };
  viewport?.addEventListener("resize", fire);
  viewport?.addEventListener("scroll", fire);
  window.addEventListener("focus", fire);
  window.addEventListener("pageshow", fire);
  window.addEventListener("orientationchange", fire);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    for (const timer of timers) window.clearTimeout(timer);
    viewport?.removeEventListener("resize", fire);
    viewport?.removeEventListener("scroll", fire);
    window.removeEventListener("focus", fire);
    window.removeEventListener("pageshow", fire);
    window.removeEventListener("orientationchange", fire);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Pin the layout viewport at the top; iOS scrolls it under the keyboard. */
export function resetWindowScroll() {
  if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
}

/**
 * Standalone iOS PWAs shrink the viewport and never grow it back: after a
 * keyboard session or a trip to the background, window.innerHeight,
 * visualViewport.height and 100dvh all come back smaller and stay that way
 * until the app is force-quit or rotated. Bottom-anchored fixed elements
 * then float above the real bottom. Scroll resets do not touch this; the
 * viewport itself is mis-measured. What does work is forcing WebKit to
 * re-measure by hiding and re-showing a full-height element with a
 * synchronous reflow in between (a route change has the same effect).
 * See https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d
 */
const tallest = new Map<number, number>(); // innerWidth → tallest innerHeight seen

function recordHeight() {
  const width = window.innerWidth;
  tallest.set(width, Math.max(tallest.get(width) ?? 0, window.innerHeight));
}

export function viewportIsShrunk(): boolean {
  const expected = tallest.get(window.innerWidth) ?? 0;
  return expected - window.innerHeight > 4;
}

export function healViewport() {
  recordHeight();
  if (!viewportIsShrunk()) return;
  const root = document.getElementById("app");
  if (!root) return;
  // display:none drops descendant scroll offsets; keep them.
  const scrollers = Array.from(
    root.querySelectorAll<HTMLElement>('[data-slot="scroll-area-viewport"]'),
  ).map((el) => [el, el.scrollTop] as const);
  root.style.display = "none";
  void root.offsetHeight; // synchronous reflow
  root.style.display = "";
  for (const [el, top] of scrollers) el.scrollTop = top;
}

/** Everything a resume needs: scroll pinned, viewport re-measured. */
export function settleViewport() {
  resetWindowScroll();
  healViewport();
}

if (typeof window !== "undefined") recordHeight();
