import { describe, expect, test } from "bun:test";
import * as Y from "yjs";

import { createFolder, createPage, removeNode, trashNode } from "@/lib/nodes";
import type { Node } from "@/lib/schema";
import { SyncManager, type ManagerDeps } from "@/lib/sync/manager";
import type { PeerId, Transport } from "@/lib/sync/multiplex";
import { getSyncStatus } from "@/lib/sync/status";

/**
 * In-memory Transport, copied per repo convention (test helpers stay inside
 * their test files, not a shared module) — same shape as multiplex.test.ts
 * and presence.test.ts.
 */
class FakeTransport implements Transport {
  readonly id: string;
  readonly peerIds = new Set<PeerId>();
  private readonly registry: Map<PeerId, FakeTransport>;
  private readonly messageHandlers = new Set<(bytes: Uint8Array, from: PeerId) => void>();
  private readonly joinHandlers = new Set<(peer: PeerId) => void>();
  private readonly leaveHandlers = new Set<(peer: PeerId) => void>();

  constructor(id: string, registry: Map<PeerId, FakeTransport>) {
    this.id = id;
    this.registry = registry;
    registry.set(id, this);
  }

  send(bytes: Uint8Array, target?: PeerId): void {
    const targets = target ? [target] : Array.from(this.peerIds);
    for (const peerId of targets) this.registry.get(peerId)?.deliver(bytes, this.id);
  }

  private deliver(bytes: Uint8Array, from: PeerId) {
    for (const handler of this.messageHandlers) handler(bytes, from);
  }

  onMessage(handler: (bytes: Uint8Array, from: PeerId) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPeerJoin(handler: (peer: PeerId) => void): () => void {
    this.joinHandlers.add(handler);
    return () => this.joinHandlers.delete(handler);
  }

  onPeerLeave(handler: (peer: PeerId) => void): () => void {
    this.leaveHandlers.add(handler);
    return () => this.leaveHandlers.delete(handler);
  }

  peers(): PeerId[] {
    return Array.from(this.peerIds);
  }

  connect(other: FakeTransport) {
    this.peerIds.add(other.id);
    other.peerIds.add(this.id);
    for (const handler of this.joinHandlers) handler(other.id);
    for (const handler of other.joinHandlers) handler(this.id);
  }

  leave(other: FakeTransport) {
    this.peerIds.delete(other.id);
    other.peerIds.delete(this.id);
    for (const handler of this.leaveHandlers) handler(other.id);
    for (const handler of other.leaveHandlers) handler(this.id);
  }
}

function unwrap<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) throw new Error(`expected ok, got: ${String(result.error)}`);
  return result.value as T;
}

function freshMap(): Y.Map<Node> {
  return new Y.Doc().getMap<Node>("nodes");
}

/** Builds a SyncManager wired to a fake join() over the given sync/presence networks. */
function buildManager(
  id: string,
  map: Y.Map<Node>,
  syncNet: Map<PeerId, FakeTransport>,
  presenceNet: Map<PeerId, FakeTransport>,
  overrides: Partial<ManagerDeps> = {},
): { manager: SyncManager; sync: FakeTransport; presence: FakeTransport } {
  const sync = new FakeTransport(id, syncNet);
  const presence = new FakeTransport(id, presenceNet);
  const deps: ManagerDeps = {
    indexDoc: map.doc as Y.Doc,
    nodesMap: map,
    openPage: overrides.openPage ?? (async () => new Y.Doc()),
    destroyPage: overrides.destroyPage ?? (async () => undefined),
    join: () => ({ sync, presence, leave: () => undefined }),
    local: overrides.local ?? { deviceId: id, name: id, pageId: null },
    concurrency: overrides.concurrency,
  };
  return { manager: new SyncManager(deps), sync, presence };
}

async function tick(times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe("SyncManager", () => {
  test("start() registers the index doc; two managers converge their nodes maps", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const mapB = freshMap();

    const {
      manager: managerA,
      sync: syncA,
      presence: presenceA,
    } = buildManager("a", mapA, syncNet, presenceNet);
    const {
      manager: managerB,
      sync: syncB,
      presence: presenceB,
    } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    managerB.start();
    syncA.connect(syncB);
    presenceA.connect(presenceB);

    expect(mapB.get(home.id)).toEqual(home);

    managerA.stop();
    managerB.stop();
  });

  test("page queue: 20 pages (live + trashed) all get opened, respecting concurrency", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const map = freshMap();
    const home = unwrap(createFolder(map, null, "Home"));
    const pageIds: string[] = [];
    for (let i = 0; i < 20; i++) pageIds.push(unwrap(createPage(map, home.id)).id);
    for (let i = 0; i < 10; i++) trashNode(map, pageIds[i] as string);

    const openCalls: string[] = [];
    let currentInFlight = 0;
    let maxInFlight = 0;
    const resolvers = new Map<string, () => void>();
    const openPage = (pageId: string): Promise<Y.Doc> => {
      openCalls.push(pageId);
      currentInFlight += 1;
      maxInFlight = Math.max(maxInFlight, currentInFlight);
      return new Promise<Y.Doc>((resolve) => {
        resolvers.set(pageId, () => {
          currentInFlight -= 1;
          resolve(new Y.Doc());
        });
      });
    };

    const { manager } = buildManager("a", map, syncNet, presenceNet, {
      openPage,
      concurrency: 3,
    });

    manager.start();

    expect(openCalls.length).toBe(3);
    expect(maxInFlight).toBeLessThanOrEqual(3);

    let iterations = 0;
    while (openCalls.length < 20 && iterations < 100) {
      const pending = Array.from(resolvers.entries());
      for (const [, resolve] of pending) resolve();
      resolvers.clear();
      await tick(2);
      iterations += 1;
    }

    // drain any final in-flight opens
    for (const [, resolve] of Array.from(resolvers.entries())) resolve();
    resolvers.clear();
    await tick(2);

    expect(openCalls.length).toBe(20);
    expect(new Set(openCalls).size).toBe(20);
    expect(maxInFlight).toBeLessThanOrEqual(3);

    manager.stop();
  });

  test("a page added to the index by a remote peer is opened and registered locally", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const mapB = freshMap();

    const openedOnA: string[] = [];
    const {
      manager: managerA,
      sync: syncA,
      presence: presenceA,
    } = buildManager("a", mapA, syncNet, presenceNet, {
      openPage: async (pageId) => {
        openedOnA.push(pageId);
        return new Y.Doc();
      },
    });
    const {
      manager: managerB,
      sync: syncB,
      presence: presenceB,
    } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    managerB.start();
    syncA.connect(syncB);
    presenceA.connect(presenceB);

    const homeOnB = mapB.get(home.id);
    if (!homeOnB) throw new Error("expected home folder to have synced to B");
    const page = unwrap(createPage(mapB, homeOnB.id));

    await tick(3);

    expect(openedOnA).toContain(page.id);
    expect(managerA.openedPageIds()).toContain(page.id);

    managerA.stop();
    managerB.stop();
  });

  test("remote removeNode destroys the page exactly once; trashNode does not destroy", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const page = unwrap(createPage(mapA, home.id));
    const mapB = freshMap();

    const destroyedOnA: string[] = [];
    const {
      manager: managerA,
      sync: syncA,
      presence: presenceA,
    } = buildManager("a", mapA, syncNet, presenceNet, {
      destroyPage: async (pageId) => {
        destroyedOnA.push(pageId);
      },
    });
    const {
      manager: managerB,
      sync: syncB,
      presence: presenceB,
    } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    managerB.start();
    syncA.connect(syncB);
    presenceA.connect(presenceB);
    await tick(3);

    expect(managerA.openedPageIds()).toContain(page.id);

    // Trashing must not destroy the local content DB.
    trashNode(mapB, page.id);
    await tick(3);
    expect(destroyedOnA).toEqual([]);
    expect(managerA.openedPageIds()).toContain(page.id);

    // Permanent removal must destroy exactly once and unregister the doc.
    unwrap(removeNode(mapB, page.id));
    await tick(3);
    expect(destroyedOnA).toEqual([page.id]);
    expect(managerA.openedPageIds()).not.toContain(page.id);

    managerA.stop();
    managerB.stop();
  });

  test("stop() detaches from the transport; a later remote edit leaves the index unchanged", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const mapB = freshMap();

    const {
      manager: managerA,
      sync: syncA,
      presence: presenceA,
    } = buildManager("a", mapA, syncNet, presenceNet);
    const {
      manager: managerB,
      sync: syncB,
      presence: presenceB,
    } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    managerB.start();
    syncA.connect(syncB);
    presenceA.connect(presenceB);
    await tick(2);

    const snapshotBefore = Array.from(mapA.keys()).toSorted();
    managerA.stop();

    const homeOnB = mapB.get(home.id);
    if (!homeOnB) throw new Error("expected home folder to have synced to B");
    createPage(mapB, homeOnB.id);
    await tick(3);

    expect(Array.from(mapA.keys()).toSorted()).toEqual(snapshotBefore);

    managerB.stop();
  });

  test("onUnknownDoc jumps the queue: an in-index page not yet opened opens immediately", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const page1 = unwrap(createPage(mapA, home.id));
    const page2 = unwrap(createPage(mapA, home.id));
    const mapB = freshMap();

    const stuck = new Map<string, () => void>();
    const openPageA = (pageId: string): Promise<Y.Doc> => {
      if (pageId === page1.id) {
        return new Promise<Y.Doc>((resolve) => stuck.set(pageId, () => resolve(new Y.Doc())));
      }
      return Promise.resolve(new Y.Doc());
    };

    const {
      manager: managerA,
      sync: syncA,
      presence: presenceA,
    } = buildManager("a", mapA, syncNet, presenceNet, { openPage: openPageA, concurrency: 1 });
    const {
      manager: managerB,
      sync: syncB,
      presence: presenceB,
    } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    // A's only concurrency slot is occupied by page1, which never resolves.
    expect(managerA.openedPageIds()).toEqual([]);

    managerB.start();
    syncA.connect(syncB);
    presenceA.connect(presenceB);

    await tick(4);

    expect(managerA.openedPageIds()).toContain(page2.id);
    expect(managerA.openedPageIds()).not.toContain(page1.id);

    stuck.get(page1.id)?.();
    await tick(2);
    managerA.stop();
    managerB.stop();
  });

  test("connected reflects peer presence: false alone, true after join, false after leave", () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const mapB = freshMap();

    const { manager: managerA, sync: syncA } = buildManager("a", mapA, syncNet, presenceNet);
    const { manager: managerB, sync: syncB } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    expect(getSyncStatus().connected).toBe(false);

    managerB.start();
    syncA.connect(syncB);
    expect(getSyncStatus().connected).toBe(true);

    syncA.leave(syncB);
    expect(getSyncStatus().connected).toBe(false);

    managerA.stop();
    managerB.stop();
  });

  test("restart() honours backoff: a second immediate call is refused, +5000ms allows it", () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const map = freshMap();

    const { manager } = buildManager("a", map, syncNet, presenceNet);
    manager.start();

    expect(manager.restart(0)).toBe(true);
    expect(manager.restart(0)).toBe(false);
    expect(manager.restart(5_000)).toBe(true);

    manager.stop();
  });

  test("reconnecting stays true after restart() until a peer joins", () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const mapB = freshMap();

    const { manager: managerA, sync: syncA } = buildManager("a", mapA, syncNet, presenceNet);
    const { manager: managerB, sync: syncB } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    expect(managerA.restart(0)).toBe(true);
    expect(getSyncStatus().reconnecting).toBe(true);

    managerB.start();
    syncA.connect(syncB);
    expect(getSyncStatus().reconnecting).toBe(false);

    managerA.stop();
    managerB.stop();
  });

  test("restart() re-registers the index and re-opens previously opened pages; a remote edit after restart still arrives", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const page = unwrap(createPage(mapA, home.id));
    const mapB = freshMap();

    const openCalls: string[] = [];
    const {
      manager: managerA,
      sync: syncA,
      presence: presenceA,
    } = buildManager("a", mapA, syncNet, presenceNet, {
      openPage: async (pageId) => {
        openCalls.push(pageId);
        return new Y.Doc();
      },
    });
    const {
      manager: managerB,
      sync: syncB,
      presence: presenceB,
    } = buildManager("b", mapB, syncNet, presenceNet);

    managerA.start();
    managerB.start();
    syncA.connect(syncB);
    presenceA.connect(presenceB);
    await tick(3);

    expect(managerA.openedPageIds()).toContain(page.id);
    const openCallsBeforeRestart = openCalls.length;

    expect(managerA.restart(0)).toBe(true);
    await tick(3);

    expect(openCalls.length).toBeGreaterThan(openCallsBeforeRestart);
    expect(managerA.openedPageIds()).toContain(page.id);

    const homeOnB = mapB.get(home.id);
    if (!homeOnB) throw new Error("expected home folder to have synced to B");
    const page2 = unwrap(createPage(mapB, homeOnB.id));
    await tick(3);

    expect(mapA.get(page2.id)).toEqual(page2);

    managerA.stop();
    managerB.stop();
  });

  test("local removeNode does not call destroyPage but unregisters the page", async () => {
    const syncNet = new Map<PeerId, FakeTransport>();
    const presenceNet = new Map<PeerId, FakeTransport>();
    const mapA = freshMap();
    const home = unwrap(createFolder(mapA, null, "Home"));
    const page = unwrap(createPage(mapA, home.id));

    const destroyedOnA: string[] = [];
    const { manager: managerA } = buildManager("a", mapA, syncNet, presenceNet, {
      destroyPage: async (pageId) => {
        destroyedOnA.push(pageId);
      },
    });

    managerA.start();
    await tick(3);
    expect(managerA.openedPageIds()).toContain(page.id);

    unwrap(removeNode(mapA, page.id));
    await tick(3);

    expect(destroyedOnA).toEqual([]);
    expect(managerA.openedPageIds()).not.toContain(page.id);

    managerA.stop();
  });
});
