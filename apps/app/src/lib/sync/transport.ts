import { joinRoom, selfId } from "trystero";

import type { PeerId, Transport } from "@/lib/sync/multiplex";

/**
 * Trystero adapter: joins one serverless WebRTC room (Nostr relay
 * signaling) and exposes it as two Transports — one for doc sync, one for
 * presence — so they never collide on the wire despite sharing a room.
 *
 * Trystero's Room only accepts a single onPeerJoin/onPeerLeave callback, so
 * both Transports' listeners are fanned out from one room-level callback.
 * Verified against the installed trystero@0.25.x public types: makeAction
 * returns an object whose `onMessage` is a settable property (not a
 * method you call with a listener) — this adapter is written against that
 * real shape, not the method-call notation in older trystero examples.
 */

export type RoomHandle = {
  sync: Transport;
  presence: Transport;
  leave(): void;
  selfId: string;
};

function makeTransport(
  action: {
    send: (data: Uint8Array, options?: { target?: PeerId }) => Promise<void>;
    onMessage: ((data: Uint8Array, context: { peerId: string }) => void) | null;
  },
  peers: () => PeerId[],
  onJoin: (handler: (peer: PeerId) => void) => () => void,
  onLeave: (handler: (peer: PeerId) => void) => () => void,
): Transport {
  const messageListeners = new Set<(bytes: Uint8Array, from: PeerId) => void>();

  action.onMessage = (data, context) => {
    // Binary payloads arrive as ArrayBuffer on the receiver, not as the
    // Uint8Array view they were sent as — rewrap before handing them off.
    const bytes = new Uint8Array(data as unknown as ArrayBuffer);
    for (const listener of messageListeners) listener(bytes, context.peerId);
  };

  return {
    send(bytes, target) {
      void action.send(bytes, target ? { target } : undefined);
    },
    onMessage(handler) {
      messageListeners.add(handler);
      return () => messageListeners.delete(handler);
    },
    onPeerJoin: onJoin,
    onPeerLeave: onLeave,
    peers,
  };
}

export function joinPairedRoom(keys: { roomId: string; password: string }): RoomHandle {
  const room = joinRoom(
    { appId: "rune", password: keys.password, relayConfig: { redundancy: 5 } },
    keys.roomId,
  );

  const peerJoinListeners = new Set<(peer: PeerId) => void>();
  const peerLeaveListeners = new Set<(peer: PeerId) => void>();
  room.onPeerJoin = (peerId) => {
    for (const listener of peerJoinListeners) listener(peerId);
  };
  room.onPeerLeave = (peerId) => {
    for (const listener of peerLeaveListeners) listener(peerId);
  };
  const onJoin = (handler: (peer: PeerId) => void) => {
    peerJoinListeners.add(handler);
    return () => peerJoinListeners.delete(handler);
  };
  const onLeave = (handler: (peer: PeerId) => void) => {
    peerLeaveListeners.add(handler);
    return () => peerLeaveListeners.delete(handler);
  };
  const peers = () => Object.keys(room.getPeers());

  const syncAction = room.makeAction<Uint8Array>("y-sync");
  const presenceAction = room.makeAction<Uint8Array>("y-aware");

  return {
    sync: makeTransport(syncAction, peers, onJoin, onLeave),
    presence: makeTransport(presenceAction, peers, onJoin, onLeave),
    leave() {
      void room.leave();
    },
    selfId,
  };
}
