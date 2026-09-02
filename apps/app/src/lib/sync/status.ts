import { useSyncExternalStore } from "react";

import type { PresenceState } from "@/lib/sync/presence";

/**
 * Sync status store for the Devices page. The manager is the only writer
 * (via setSyncStatus); everything else reads through useSyncStatus.
 */

export type SyncStatus = {
  paired: boolean;
  /** true once at least one peer has joined this session. */
  connected: boolean;
  /** true while a restart is pending or in flight after a suspend/offline. */
  reconnecting: boolean;
  /** Online devices, excluding this one. */
  peers: PresenceState[];
  /** Page docs still queued for their first sync. */
  pendingDocs: number;
  /** Why sync could not start (e.g. no secure context); null when fine. */
  error: string | null;
};

let state: SyncStatus = {
  paired: false,
  connected: false,
  reconnecting: false,
  peers: [],
  pendingDocs: 0,
  error: null,
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

/** Non-hook read of the current status — for tests and non-React code. */
export function getSyncStatus(): SyncStatus {
  return state;
}
