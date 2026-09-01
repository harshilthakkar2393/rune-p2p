import { useSyncExternalStore } from "react";

import type { PresenceState } from "@/lib/sync/presence";

/**
 * Sync status store for the Devices page. The manager is the only writer
 * (via setSyncStatus); everything else reads through useSyncStatus.
 */

export type SyncStatus = {
  paired: boolean;
  connected: boolean;
  /** Online devices, excluding this one. */
  peers: PresenceState[];
  /** Page docs still queued for their first sync. */
  pendingDocs: number;
};

let state: SyncStatus = {
  paired: false,
  connected: false,
  peers: [],
  pendingDocs: 0,
};
const listeners = new Set<() => void>();

/** Used by the sync manager only — the UI never calls this directly. */
export function setSyncStatus(patch: Partial<SyncStatus>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): SyncStatus {
  return state;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
