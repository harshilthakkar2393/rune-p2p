import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { setPwaStatus } from "@/lib/pwa";
import { Button } from "@rune/ui/components/button";

/**
 * Floating pill shown when a new service worker is waiting. Reloading is
 * user-driven (registerType: "prompt") — Yjs persists every keystroke, but
 * a reload mid-edit still loses caret/scroll, so we never auto-update.
 */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onOfflineReady() {
      setPwaStatus({ offlineReady: true });
    },
    onNeedRefresh() {
      setPwaStatus({ needRefresh: true });
    },
    // Installed iOS apps rarely check for a new worker on their own. Ask on
    // every foreground and once an hour so updates actually surface.
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      setInterval(check, UPDATE_CHECK_MS);
    },
  });
  const [refreshNeeded] = needRefresh;

  if (!refreshNeeded || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover py-1 pr-1 pl-4 shadow-lg md:bottom-6">
      <span className="text-sm">Update ready</span>
      <Button size="sm" className="rounded-full" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full font-normal"
        onClick={() => setDismissed(true)}
      >
        Later
      </Button>
    </div>
  );
}
