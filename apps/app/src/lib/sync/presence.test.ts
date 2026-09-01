import { describe, expect, test } from "bun:test";
import * as Y from "yjs";

import { Presence, type PresenceState } from "@/lib/sync/presence";
import type { PeerId, Transport } from "@/lib/sync/multiplex";

/**
 * In-memory Transport, copied from multiplex.test.ts per repo convention
 * (test helpers stay inside their test files, not a shared module).
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
}

function network(): Map<PeerId, FakeTransport> {
  return new Map();
}

function stateOf(id: string): PresenceState {
  return { deviceId: id, name: id, pageId: null };
}

describe("Presence", () => {
  test("after join, each side's peers() includes the other's state", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const presenceA = new Presence(new Y.Doc(), transportA, stateOf("A"));
    const presenceB = new Presence(new Y.Doc(), transportB, stateOf("B"));

    transportA.connect(transportB);

    expect(presenceA.peers()).toEqual([stateOf("B")]);
    expect(presenceB.peers()).toEqual([stateOf("A")]);

    presenceA.destroy();
    presenceB.destroy();
  });

  test("setLocal on A shows up in B.peers()", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const presenceA = new Presence(new Y.Doc(), transportA, stateOf("A"));
    const presenceB = new Presence(new Y.Doc(), transportB, stateOf("B"));
    transportA.connect(transportB);

    presenceA.setLocal({ pageId: "p1" });

    expect(presenceB.peers()).toEqual([{ deviceId: "A", name: "A", pageId: "p1" }]);

    presenceA.destroy();
    presenceB.destroy();
  });

  test("destroy() on A removes it from B.peers()", () => {
    const net = network();
    const transportA = new FakeTransport("a", net);
    const transportB = new FakeTransport("b", net);
    const presenceA = new Presence(new Y.Doc(), transportA, stateOf("A"));
    const presenceB = new Presence(new Y.Doc(), transportB, stateOf("B"));
    transportA.connect(transportB);

    expect(presenceB.peers().length).toBe(1);

    presenceA.destroy();

    expect(presenceB.peers()).toEqual([]);

    presenceB.destroy();
  });
});
