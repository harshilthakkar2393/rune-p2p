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

/** Everything a resume needs: the layout viewport pinned at the top. The
 * shrunk-viewport bug itself is handled in CSS (--app-h = lvh in standalone). */
export function settleViewport() {
  resetWindowScroll();
}
