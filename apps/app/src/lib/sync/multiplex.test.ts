import { describe, expect, test } from "bun:test";
import * as Y from "yjs";

import { Multiplexer, type PeerId, type Transport } from "@/lib/sync/multiplex";

/**
 * In-memory Transport: `send` delivers synchronously to the target(s)'
 * onMessage handlers. `join(a, b)` links two instances and fires
 * onPeerJoin on both. Copied per-file per repo convention — no shared
 * fake-transport module.
 */
class FakeTransport implements Transport {
  readonly id: string;
  readonly peerIds = new Set<PeerId>();
  sendCount = 0;
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
    this.sendCount += 1;
    const targets = target ? [target] : Array.from(this.peerIds);
    for (const peerId of targets) {
      this.registry.get(peerId)?.deliver(bytes, this.id);
    }
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
}

function network(): Map<PeerId, FakeTransport> {
  return new Map();
}

function join(a: FakeTransport, b: FakeTransport) {
  a.connect(b);
}

function text(doc: Y.Doc): string {
  return doc.getText("t").toString();
}

describe("Multiplexer", () => {
  test("two peers with prior local text converge on join+register", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);

    const docA = new Y.Doc();
    docA.getText("t").insert(0, "hello ");
    const docB = new Y.Doc();
    docB.getText("t").insert(0, "world");

    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);
    mpA.register("index", docA);
    mpB.register("index", docB);

    join(transportA, transportB);

    expect(text(docA)).toBe(text(docB));
    expect(text(docA)).toContain("hello");
    expect(text(docA)).toContain("world");
  });

  test("a local edit after sync propagates to the other peer", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);
    mpA.register("index", docA);
    mpB.register("index", docB);
    join(transportA, transportB);

    docA.getText("t").insert(0, "late edit");

    expect(text(docB)).toBe("late edit");
  });

  test("no echo: a remote-applied update produces zero additional sends from A", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);
    mpA.register("index", docA);
    mpB.register("index", docB);
    join(transportA, transportB);

    const sendCountBefore = transportA.sendCount;
    docB.getText("t").insert(0, "from b");
    expect(text(docA)).toBe("from b");
    expect(transportA.sendCount).toBe(sendCountBefore);
  });

  test("late registration: B registers after join, A registers later, they still converge", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);

    join(transportA, transportB);

    const docB = new Y.Doc();
    docB.getText("t").insert(0, "b first");
    mpB.register("page:1", docB);

    const docA = new Y.Doc();
    mpA.register("page:1", docA);

    expect(text(docA)).toBe("b first");
  });

  test("isolation: an edit in page:1 never touches page:2 state", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);

    const docA1 = new Y.Doc();
    const docA2 = new Y.Doc();
    mpA.register("page:1", docA1);
    mpA.register("page:2", docA2);

    const docB1 = new Y.Doc();
    mpB.register("page:1", docB1);

    join(transportA, transportB);

    docA1.getText("t").insert(0, "page one text");

    expect(text(docB1)).toBe("page one text");
    expect(text(docA2)).toBe("");
  });

  test("unknown doc: an unregistered docId calls onUnknownDoc and does not throw", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);

    const calls: Array<{ docId: string; from: PeerId }> = [];
    mpA.onUnknownDoc = (docId, from) => calls.push({ docId, from });

    join(transportA, transportB);

    const docB = new Y.Doc();
    expect(() => mpB.register("page:unseen", docB)).not.toThrow();

    expect(calls).toEqual([{ docId: "page:unseen", from: "b" }]);
  });

  test("three peers converge when all joined pairwise", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const transportC = new FakeTransport("c", net);
    const mpA = new Multiplexer(transportA);
    const mpB = new Multiplexer(transportB);
    const mpC = new Multiplexer(transportC);

    const docA = new Y.Doc();
    docA.getText("t").insert(0, "A");
    const docB = new Y.Doc();
    docB.getText("t").insert(0, "B");
    const docC = new Y.Doc();
    docC.getText("t").insert(0, "C");

    mpA.register("index", docA);
    mpB.register("index", docB);
    mpC.register("index", docC);

    join(transportA, transportB);
    join(transportA, transportC);
    join(transportB, transportC);

    expect(text(docA)).toBe(text(docB));
    expect(text(docB)).toBe(text(docC));
    expect(text(docA)).toContain("A");
    expect(text(docA)).toContain("B");
    expect(text(docA)).toContain("C");
  });

  test("malformed bytes do not throw", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportC = new FakeTransport("c", net);
    const mpA = new Multiplexer(transportA);
    void mpA;
    join(transportA, transportC);

    expect(() => transportC.send(new Uint8Array([255, 1, 2]))).not.toThrow();
  });
});
