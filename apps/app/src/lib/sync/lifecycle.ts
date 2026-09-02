/**
 * Browser wiring that rejoins the sync room when the tab comes back to a
 * state where peers might be reachable again, but only if none currently
 * are. iOS Safari suspends WebRTC when backgrounded or the screen locks;
 * nothing else in the stack notices when the tab returns.
 */

type LifecycleManager = {
  restartIfAlone(now?: number): boolean;
};

/**
 * Installs `visibilitychange` / `online` / `pageshow` (bfcache restore)
 * listeners that call `manager.restartIfAlone()`. Returns a function that
 * removes all three listeners.
 */
export function installSyncLifecycle(manager: LifecycleManager): () => void {
  if (typeof document === "undefined") return () => undefined;

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") manager.restartIfAlone();
  };
  const onOnline = () => manager.restartIfAlone();
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) manager.restartIfAlone();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);
  window.addEventListener("pageshow", onPageShow);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("pageshow", onPageShow);
  };
}
