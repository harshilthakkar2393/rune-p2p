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
 * Force iOS to re-lay out the page. After a keyboard session or a background
 * resume, standalone Safari can keep the layout viewport at a stale height
 * until something like a rotation forces it to recompute; bottom-anchored
 * fixed elements then sit too high. Nudging the root's height across two
 * frames is the smallest change that makes it recompute.
 */
export function nudgeLayout() {
  const root = document.documentElement;
  root.style.height = "100.01%";
  requestAnimationFrame(() => {
    root.style.height = "";
  });
}

/** Everything a resume needs: scroll pinned, layout recomputed. */
export function settleViewport() {
  resetWindowScroll();
  nudgeLayout();
}
