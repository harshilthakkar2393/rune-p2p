import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";

import { getDeviceName } from "@/lib/device";
import { getIndexDoc, getNodesMap } from "@/lib/index-doc";
import type { NodesMap } from "@/lib/nodes";
import { destroyPageDoc, getPageDoc } from "@/lib/page-doc";
import type { Node } from "@/lib/schema";
import {
  canAttempt,
  initialBackoff,
  recordAttempt,
  resetBackoff,
  type BackoffState,
} from "@/lib/sync/backoff";
import { installSyncLifecycle } from "@/lib/sync/lifecycle";
import { Multiplexer, type Transport } from "@/lib/sync/multiplex";
import { Presence, type PresenceState } from "@/lib/sync/presence";
import {
  clearStoredSecret,
  deriveKeys,
  getDeviceId,
  readStoredSecret,
  storeSecret,
} from "@/lib/sync/secret";
import { setSyncStatus } from "@/lib/sync/status";
import { joinPairedRoom } from "@/lib/sync/transport";

/**
 * Glues the doc multiplexer, presence, and the existing index/page
 * persistence together: joins the paired room, keeps every page's Y.Doc
 * registered on the multiplexer, and reacts to remote index changes —
 * opening pages a peer just created, and dropping local content dbs for
 * pages a peer permanently deleted.
 */

const PAGE_DOC_PREFIX = "page:";
const INDEX_DOC_ID = "index";
const DEFAULT_CONCURRENCY = 8;
/** How long "reconnecting…" stays on after a restart before giving up and
 *  falling back to "looking for your devices…" if no peer has shown up. */
const RECONNECT_WAIT_MS = 15_000;
/** Launch-time visibility/pageshow events must not restart a join that just started. */
const START_GRACE_MS = 10_000;

export type ManagerDeps = {
  indexDoc: Y.Doc;
  nodesMap: NodesMap;
  openPage: (pageId: string) => Promise<Y.Doc>;
  destroyPage: (pageId: string) => Promise<void>;
  join: () => { sync: Transport; presence: Transport; leave(): void | Promise<void> };
  local: PresenceState;
  concurrency?: number;
};

export class SyncManager {
  private readonly deps: ManagerDeps;
  private readonly concurrency: number;
  private started = false;

  private multiplexer: Multiplexer | null = null;
  private presence: Presence | null = null;
  private leaveRoom: (() => void | Promise<void>) | null = null;
  /** Resolves when the last room leave completed (Trystero hands back the OLD room if you rejoin before it does). */
  private lastLeave: Promise<void> = Promise.resolve();
  private startedAt = 0;
  private restarting = false;
  private detached = false;
  private unobserveIndex: (() => void) | null = null;
  private unsubscribePresence: (() => void) | null = null;
  private syncTransport: Transport | null = null;
  private unsubscribeSyncJoin: (() => void) | null = null;
  private unsubscribeSyncLeave: (() => void) | null = null;
  private backoff: BackoffState = initialBackoff();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly pageQueue: string[] = [];
  private readonly inFlight = new Set<string>();
  private readonly openedPages = new Set<string>();

  constructor(deps: ManagerDeps) {
    this.deps = deps;
    this.concurrency = deps.concurrency ?? DEFAULT_CONCURRENCY;
  }

  /** Joins the room, registers the index doc, and starts the page queue. */
  start(now = Date.now()): void {
    if (this.started || this.detached) return;
    this.started = true;
    this.startedAt = now;

    const { sync, presence, leave } = this.deps.join();
    this.leaveRoom = leave;
    this.syncTransport = sync;

    const multiplexer = new Multiplexer(sync);
    multiplexer.onUnknownDoc = (docId) => this.handleUnknownDoc(docId);
    multiplexer.register(INDEX_DOC_ID, this.deps.indexDoc);
    this.multiplexer = multiplexer;

    const presenceInstance = new Presence(this.deps.indexDoc, presence, this.deps.local);
    this.presence = presenceInstance;
    this.unsubscribePresence = presenceInstance.onChange(() => {
      setSyncStatus({ peers: presenceInstance.peers() });
    });

    this.unsubscribeSyncJoin = sync.onPeerJoin(() => this.handlePeerCountChange());
    this.unsubscribeSyncLeave = sync.onPeerLeave(() => this.handlePeerCountChange());
    // "connected" reflects the presence of a peer, not merely having joined
    // the room — Trystero never rejects on relay failure, so joining alone
    // tells us nothing about whether anyone is actually reachable.
    setSyncStatus({ peers: presenceInstance.peers(), connected: sync.peers().length > 0 });

    this.unobserveIndex = this.observeIndex();

    for (const node of this.deps.nodesMap.values()) {
      if (node.type === "page") this.enqueuePage(node.id);
    }
    this.pump();
  }

  /** Leaves the room and tears down the multiplexer, presence, and page queue. */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    this.unobserveIndex?.();
    this.unobserveIndex = null;
    this.unsubscribePresence?.();
    this.unsubscribePresence = null;
    this.unsubscribeSyncJoin?.();
    this.unsubscribeSyncJoin = null;
    this.unsubscribeSyncLeave?.();
    this.unsubscribeSyncLeave = null;

    this.presence?.destroy();
    this.presence = null;
    this.multiplexer?.destroy();
    this.multiplexer = null;
    this.lastLeave = Promise.resolve(this.leaveRoom?.()).catch(() => undefined);
    this.leaveRoom = null;
    this.syncTransport = null;

    // Only the pending timeout is cleared here — `reconnecting` itself is
    // left alone, since restart() calls stop() as part of the rejoin and
    // the flag must stay on for the duration of that rejoin.
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.pageQueue.length = 0;
    this.inFlight.clear();
    this.openedPages.clear();

    setSyncStatus({ connected: false, peers: [], pendingDocs: 0 });
  }

  /**
   * Attempts to rejoin, honouring reconnect backoff. Returns false if an
   * attempt was made too recently. Page docs re-open instantly because
   * `getPageDoc` caches them — this only redoes the room join and index
   * registration. `reconnecting` stays true until a peer joins
   * (handlePeerCountChange) or RECONNECT_WAIT_MS passes, whichever first —
   * stop()+start() run synchronously so clearing it here would never let
   * the UI render the in-between state.
   */
  async restart(now = Date.now()): Promise<boolean> {
    if (this.restarting || this.detached || !canAttempt(this.backoff, now)) return false;
    this.restarting = true;
    this.backoff = recordAttempt(this.backoff, now);
    setSyncStatus({ reconnecting: true });
    this.stop();
    // Wait for the old room to actually leave: Trystero returns the still-
    // occupied room object for a re-join of the same id, and that room is
    // being torn down — sync would come back dead.
    await this.lastLeave;
    this.restarting = false;
    if (this.detached) return false;
    this.start(now);
    // stop() just cleared any previous timer, so this is always a fresh one.
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      setSyncStatus({ reconnecting: false });
    }, RECONNECT_WAIT_MS);
    return true;
  }

  /** Restarts only if this device currently has no peers — used by lifecycle wiring. */
  restartIfAlone(now = Date.now()): Promise<boolean> {
    if (!this.started && !this.restarting) return Promise.resolve(false);
    // A join that just started has no peers yet; give it time before judging it dead.
    if (now - this.startedAt < START_GRACE_MS) return Promise.resolve(false);
    if (this.peerCount() === 0) return this.restart(now);
    return Promise.resolve(false);
  }

  /** Permanent stop: also cancels any restart that is mid-await. */
  detach(): void {
    this.detached = true;
    this.stop();
  }

  /** Page ids currently opened and registered with the multiplexer. */
  openedPageIds(): string[] {
    return Array.from(this.openedPages);
  }

  /** Pages queued or mid-open, not yet registered. */
  pendingCount(): number {
    return this.pageQueue.length + this.inFlight.size;
  }

  /** Publishes which page (if any) this device is currently editing. */
  setPage(pageId: string | null): void {
    this.presence?.setLocal({ pageId });
  }

  /** The shared Awareness instance, for binding editor cursors. */
  awareness(): Awareness | null {
    return this.presence?.awareness ?? null;
  }

  /** Peers currently visible on the sync transport (not presence — that lags). */
  private peerCount(): number {
    return this.syncTransport?.peers().length ?? 0;
  }

  private handlePeerCountChange(): void {
    const connected = this.peerCount() > 0;
    if (connected) {
      this.backoff = resetBackoff();
      if (this.reconnectTimer !== null) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      setSyncStatus({ connected, reconnecting: false });
    } else {
      setSyncStatus({ connected });
    }
  }

  private observeIndex(): () => void {
    const handler = (event: Y.YMapEvent<Node>) => {
      let changed = false;
      for (const [key, change] of event.changes.keys) {
        if (change.action === "delete") {
          const removed = change.oldValue as Node | undefined;
          if (removed?.type === "page") {
            // Local permanent deletes are already destroyed by the caller
            // (trash.tsx / use-index.ts) — only unregister here. Remote
            // deletes must also destroy the local content db.
            this.unregisterPage(key);
            if (!event.transaction.local) this.handlePageRemoved(key);
            changed = true;
          }
        } else if (change.action === "add") {
          const node = this.deps.nodesMap.get(key);
          if (node?.type === "page") {
            this.enqueuePage(key, true);
            changed = true;
          }
        }
        // "update" changes (rename, move, trash/restore, ...) never open or
        // close a page's content doc — only add/delete on the index map do.
      }
      if (changed) this.pump();
    };
    this.deps.nodesMap.observe(handler);
    return () => this.deps.nodesMap.unobserve(handler);
  }

  private enqueuePage(pageId: string, priority = false): void {
    if (this.openedPages.has(pageId) || this.inFlight.has(pageId)) return;
    const existingIndex = this.pageQueue.indexOf(pageId);
    if (existingIndex !== -1) {
      if (priority && existingIndex !== 0) {
        this.pageQueue.splice(existingIndex, 1);
        this.pageQueue.unshift(pageId);
      }
      return;
    }
    if (priority) this.pageQueue.unshift(pageId);
    else this.pageQueue.push(pageId);
  }

  private pump(): void {
    while (this.inFlight.size < this.concurrency && this.pageQueue.length > 0) {
      const pageId = this.pageQueue.shift();
      if (pageId === undefined) break;
      this.beginOpen(pageId);
    }
    setSyncStatus({ pendingDocs: this.pendingCount() });
  }

  private beginOpen(pageId: string): void {
    if (this.openedPages.has(pageId) || this.inFlight.has(pageId)) return;
    this.inFlight.add(pageId);
    void this.deps
      .openPage(pageId)
      .then((doc) => {
        this.inFlight.delete(pageId);
        if (!this.started) return;
        this.openedPages.add(pageId);
        this.multiplexer?.register(PAGE_DOC_PREFIX + pageId, doc);
        this.pump();
      })
      .catch((error: unknown) => {
        this.inFlight.delete(pageId);
        console.warn("sync manager: failed to open page", pageId, error);
        this.pump();
      });
  }

  private unregisterPage(pageId: string): void {
    this.openedPages.delete(pageId);
    this.inFlight.delete(pageId);
    const queueIndex = this.pageQueue.indexOf(pageId);
    if (queueIndex !== -1) this.pageQueue.splice(queueIndex, 1);
    this.multiplexer?.unregister(PAGE_DOC_PREFIX + pageId);
  }

  /** Remote permanent delete: drop the local content db too (local deletes
   *  already had this done by the caller before the index change lands). */
  private handlePageRemoved(pageId: string): void {
    void this.deps.destroyPage(pageId);
  }

  private handleUnknownDoc(docId: string): void {
    if (!docId.startsWith(PAGE_DOC_PREFIX)) return;
    const pageId = docId.slice(PAGE_DOC_PREFIX.length);
    if (this.openedPages.has(pageId) || this.inFlight.has(pageId)) return;
    const queueIndex = this.pageQueue.indexOf(pageId);
    if (queueIndex !== -1) this.pageQueue.splice(queueIndex, 1);
    // Jump the queue: open immediately, ignoring the concurrency limit, so
    // the page a peer is actively showing syncs first.
    this.beginOpen(pageId);
  }
}

let currentManager: SyncManager | null = null;
let startInFlight = false;
let uninstallLifecycle: (() => void) | null = null;

function buildLocalState(): PresenceState {
  return { deviceId: getDeviceId(), name: getDeviceName(), pageId: null };
}

/** Reads the stored secret and starts syncing if paired. Idempotent. */
export function startSyncIfPaired(): void {
  if (currentManager || startInFlight) return;
  const secret = readStoredSecret();
  if (!secret) return;

  startInFlight = true;
  if (typeof crypto === "undefined" || !crypto.subtle) {
    startInFlight = false;
    setSyncStatus({
      paired: true,
      error: "Sync needs a secure connection. Open the app over https (or localhost).",
    });
    return;
  }
  void deriveKeys(secret)
    .then((keys) => {
      startInFlight = false;
      // stopSync()/unpair() may have run while the keys were deriving.
      if (currentManager || readStoredSecret() === null) return;

      const manager = new SyncManager({
        indexDoc: getIndexDoc(),
        nodesMap: getNodesMap(),
        openPage: (pageId) => {
          const { doc, whenSynced } = getPageDoc(pageId);
          return whenSynced.then(() => doc);
        },
        destroyPage: destroyPageDoc,
        join: () => joinPairedRoom(keys),
        local: buildLocalState(),
      });
      currentManager = manager;
      manager.start();
      uninstallLifecycle = installSyncLifecycle(manager);
      setSyncStatus({ paired: true, error: null });
    })
    .catch((error: unknown) => {
      startInFlight = false;
      console.warn("sync manager: could not start", error);
      setSyncStatus({ paired: true, error: "Sync could not start. See the console for details." });
    });
}

export function stopSync(): void {
  uninstallLifecycle?.();
  uninstallLifecycle = null;
  currentManager?.detach();
  currentManager = null;
  setSyncStatus({ reconnecting: false });
}

/** Publishes the page this device is currently editing, for peers' presence. */
export function setPresencePage(pageId: string | null): void {
  currentManager?.setPage(pageId);
}

/** The shared Awareness instance for the active sync session, if any. */
export function getSyncAwareness(): Awareness | null {
  return currentManager?.awareness() ?? null;
}

export async function pairWithSecret(secret: Uint8Array): Promise<void> {
  storeSecret(secret);
  stopSync();
  startSyncIfPaired();
}

/** Stops syncing and forgets the pairing secret. Notes stay on this device. */
export function unpair(): void {
  stopSync();
  clearStoredSecret();
  setSyncStatus({ paired: false, connected: false, peers: [], pendingDocs: 0, error: null });
}
