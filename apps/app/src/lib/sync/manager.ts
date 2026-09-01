import type * as Y from "yjs";

import { getDeviceName } from "@/lib/device";
import { getIndexDoc, getNodesMap } from "@/lib/index-doc";
import type { NodesMap } from "@/lib/nodes";
import { destroyPageDoc, getPageDoc } from "@/lib/page-doc";
import type { Node } from "@/lib/schema";
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

export type ManagerDeps = {
  indexDoc: Y.Doc;
  nodesMap: NodesMap;
  openPage: (pageId: string) => Promise<Y.Doc>;
  destroyPage: (pageId: string) => Promise<void>;
  join: () => { sync: Transport; presence: Transport; leave(): void };
  local: PresenceState;
  concurrency?: number;
};

export class SyncManager {
  private readonly deps: ManagerDeps;
  private readonly concurrency: number;
  private started = false;

  private multiplexer: Multiplexer | null = null;
  private presence: Presence | null = null;
  private leaveRoom: (() => void) | null = null;
  private unobserveIndex: (() => void) | null = null;
  private unsubscribePresence: (() => void) | null = null;

  private readonly pageQueue: string[] = [];
  private readonly inFlight = new Set<string>();
  private readonly openedPages = new Set<string>();

  constructor(deps: ManagerDeps) {
    this.deps = deps;
    this.concurrency = deps.concurrency ?? DEFAULT_CONCURRENCY;
  }

  /** Joins the room, registers the index doc, and starts the page queue. */
  start(): void {
    if (this.started) return;
    this.started = true;

    const { sync, presence, leave } = this.deps.join();
    this.leaveRoom = leave;

    const multiplexer = new Multiplexer(sync);
    multiplexer.onUnknownDoc = (docId) => this.handleUnknownDoc(docId);
    multiplexer.register(INDEX_DOC_ID, this.deps.indexDoc);
    this.multiplexer = multiplexer;

    const presenceInstance = new Presence(this.deps.indexDoc, presence, this.deps.local);
    this.presence = presenceInstance;
    this.unsubscribePresence = presenceInstance.onChange(() => {
      setSyncStatus({ peers: presenceInstance.peers() });
    });
    setSyncStatus({ connected: true, peers: presenceInstance.peers() });

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

    this.presence?.destroy();
    this.presence = null;
    this.multiplexer?.destroy();
    this.multiplexer = null;
    this.leaveRoom?.();
    this.leaveRoom = null;

    this.pageQueue.length = 0;
    this.inFlight.clear();
    this.openedPages.clear();

    setSyncStatus({ connected: false, peers: [], pendingDocs: 0 });
  }

  /** Page ids currently opened and registered with the multiplexer. */
  openedPageIds(): string[] {
    return Array.from(this.openedPages);
  }

  /** Pages queued or mid-open, not yet registered. */
  pendingCount(): number {
    return this.pageQueue.length + this.inFlight.size;
  }

  private observeIndex(): () => void {
    const handler = (event: Y.YMapEvent<Node>) => {
      let changed = false;
      for (const [key, change] of event.changes.keys) {
        if (change.action === "delete") {
          const removed = change.oldValue as Node | undefined;
          if (removed?.type === "page") {
            this.handlePageRemoved(key);
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

  private handlePageRemoved(pageId: string): void {
    this.openedPages.delete(pageId);
    this.inFlight.delete(pageId);
    const queueIndex = this.pageQueue.indexOf(pageId);
    if (queueIndex !== -1) this.pageQueue.splice(queueIndex, 1);
    this.multiplexer?.unregister(PAGE_DOC_PREFIX + pageId);
    // Permanent delete always drops the local content db, whether or not
    // this device had opened the page yet.
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
      setSyncStatus({ paired: true, error: null });
    })
    .catch((error: unknown) => {
      startInFlight = false;
      console.warn("sync manager: could not start", error);
      setSyncStatus({ paired: true, error: "Sync could not start. See the console for details." });
    });
}

export function stopSync(): void {
  currentManager?.stop();
  currentManager = null;
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
