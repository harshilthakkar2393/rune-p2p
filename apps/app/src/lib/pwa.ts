import { useSyncExternalStore } from "react";

/**
 * PWA status store: install/offline/storage state for the Devices page and
 * the update-ready prompt. Copies the status.ts store pattern — module
 * state + a listener set + useSyncExternalStore.
 */

export type PwaStatus = {
  /** null = unknown / unsupported (no Storage API, or not yet asked). */
  persisted: boolean | null;
  /** Running as an installed app (standalone display mode). */
  standalone: boolean;
  /** A deferred beforeinstallprompt event is held and ready to prompt(). */
  canInstall: boolean;
  offlineReady: boolean;
  needRefresh: boolean;
};

let state: PwaStatus = {
  persisted: null,
  standalone: false,
  canInstall: false,
  offlineReady: false,
  needRefresh: false,
};
const listeners = new Set<() => void>();

export function setPwaStatus(patch: Partial<PwaStatus>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): PwaStatus {
  return state;
}

export function usePwaStatus(): PwaStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Non-hook read of the current status — for tests and non-React code. */
export function getPwaStatus(): PwaStatus {
  return state;
}

type StandaloneWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
};

/** True when the app is running installed (standalone), not a browser tab. */
export function isStandalone(win: StandaloneWindow = {}): boolean {
  const mediaMatch = win.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = win.navigator?.standalone === true;
  return mediaMatch || iosStandalone;
}

type PersistenceStorage = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

/**
 * Ask the browser to keep IndexedDB out of eviction. Never throws — a
 * rejected or missing API resolves to `null` ("unknown"), not an error.
 */
export async function requestPersistentStorage(
  storage?: PersistenceStorage | null,
): Promise<boolean | null> {
  if (!storage?.persist || !storage.persisted) {
    setPwaStatus({ persisted: null });
    return null;
  }
  try {
    const already = await storage.persisted();
    if (already) {
      setPwaStatus({ persisted: true });
      return true;
    }
    const granted = await storage.persist();
    setPwaStatus({ persisted: granted });
    return granted;
  } catch {
    setPwaStatus({ persisted: null });
    return null;
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Installs the beforeinstallprompt listener (Chromium only). Returns an
 * uninstall function for cleanup in a useEffect.
 */
export function captureInstallPrompt(win: Window = window): () => void {
  const handler = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setPwaStatus({ canInstall: true });
  };
  win.addEventListener("beforeinstallprompt", handler);
  return () => win.removeEventListener("beforeinstallprompt", handler);
}

/** Shows the deferred install prompt, if one was captured. Resolves accepted?. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  setPwaStatus({ canInstall: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}
