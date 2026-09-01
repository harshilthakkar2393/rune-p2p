import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type * as Y from "yjs";

import type { PeerId, Transport } from "@/lib/sync/multiplex";

/**
 * Which devices are online, and what each is doing, shared via y-protocols
 * Awareness over its own Transport (never the doc-sync transport — see
 * transport.ts, which hands Presence a dedicated Trystero action).
 */

export type PresenceState = { deviceId: string; name: string; pageId: string | null };

const REMOTE_ORIGIN = "remote";

export class Presence {
  readonly awareness: Awareness;

  private readonly transport: Transport;
  private readonly changeListeners = new Set<() => void>();
  private readonly unsubscribeMessage: () => void;
  private readonly unsubscribeJoin: () => void;
  private readonly onAwarenessUpdate: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void;

  constructor(doc: Y.Doc, transport: Transport, local: PresenceState) {
    this.transport = transport;
    this.awareness = new Awareness(doc);

    // "update" (not "change") also fires on the periodic renewal tick, which
    // remote peers need to see or they'll time this client out after 30s.
    this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin !== REMOTE_ORIGIN) {
        const changedClients = [...added, ...updated, ...removed];
        this.transport.send(encodeAwarenessUpdate(this.awareness, changedClients));
      }
      this.emitChange();
    };
    this.awareness.on("update", this.onAwarenessUpdate);
    this.awareness.setLocalState(local);

    this.unsubscribeMessage = transport.onMessage((bytes) => {
      applyAwarenessUpdate(this.awareness, bytes, REMOTE_ORIGIN);
    });
    this.unsubscribeJoin = transport.onPeerJoin((peer: PeerId) => {
      this.transport.send(encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]), peer);
    });
  }

  setLocal(patch: Partial<PresenceState>): void {
    const current = this.awareness.getLocalState() as PresenceState | null;
    this.awareness.setLocalState({ ...current, ...patch });
  }

  /** Remote states only, excluding this client. */
  peers(): PresenceState[] {
    const states: PresenceState[] = [];
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.awareness.clientID) continue;
      if (state) states.push(state as PresenceState);
    }
    return states;
  }

  onChange(cb: () => void): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  destroy(): void {
    removeAwarenessStates(this.awareness, [this.awareness.clientID], "local");
    this.unsubscribeMessage();
    this.unsubscribeJoin();
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
  }

  private emitChange(): void {
    for (const cb of this.changeListeners) cb();
  }
}
