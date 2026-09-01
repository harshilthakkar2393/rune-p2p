import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import type * as Y from "yjs";

/**
 * Syncs N Y.Docs over ONE transport (one Trystero room). Each wire frame is
 * tagged with a docId so the index doc and every page doc share a single
 * connection instead of one WebRTC action per document.
 *
 * Frame layout: writeVarString(docId), writeVarUint(MSG_SYNC), then the
 * y-protocols sync payload (which carries its own SyncStep1/Step2/Update tag).
 */

export type PeerId = string;

export interface Transport {
  /** Send bytes to one peer, or broadcast when target is undefined. */
  send(bytes: Uint8Array, target?: PeerId): void;
  onMessage(handler: (bytes: Uint8Array, from: PeerId) => void): () => void;
  onPeerJoin(handler: (peer: PeerId) => void): () => void;
  onPeerLeave(handler: (peer: PeerId) => void): () => void;
  peers(): PeerId[];
}

const MSG_SYNC = 0;

type RegisteredDoc = {
  doc: Y.Doc;
  updateHandler: (update: Uint8Array, origin: unknown) => void;
};

export class Multiplexer {
  /** Called when a frame arrives for a docId that is not registered. Default: ignore. */
  onUnknownDoc?: (docId: string, from: PeerId) => void;

  private readonly transport: Transport;
  private readonly docs = new Map<string, RegisteredDoc>();
  private readonly unsubscribeMessage: () => void;
  private readonly unsubscribeJoin: () => void;

  constructor(transport: Transport) {
    this.transport = transport;
    this.unsubscribeMessage = transport.onMessage((bytes, from) => this.handleMessage(bytes, from));
    this.unsubscribeJoin = transport.onPeerJoin((peer) => this.handlePeerJoin(peer));
  }

  register(docId: string, doc: Y.Doc): void {
    if (this.docs.has(docId)) return;
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      // Updates we applied ourselves while decoding a remote frame carry `this`
      // as their origin — rebroadcasting those would echo forever.
      if (origin === this) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarString(encoder, docId);
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.transport.send(encoding.toUint8Array(encoder));
    };
    doc.on("update", updateHandler);
    this.docs.set(docId, { doc, updateHandler });

    for (const peer of this.transport.peers()) {
      this.sendSyncStep1(docId, doc, peer);
    }
  }

  unregister(docId: string): void {
    const entry = this.docs.get(docId);
    if (!entry) return;
    entry.doc.off("update", entry.updateHandler);
    this.docs.delete(docId);
  }

  has(docId: string): boolean {
    return this.docs.has(docId);
  }

  destroy(): void {
    for (const docId of Array.from(this.docs.keys())) this.unregister(docId);
    this.unsubscribeMessage();
    this.unsubscribeJoin();
  }

  private sendSyncStep1(docId: string, doc: Y.Doc, target?: PeerId): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarString(encoder, docId);
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    this.transport.send(encoding.toUint8Array(encoder), target);
  }

  private handlePeerJoin(peer: PeerId): void {
    for (const [docId, entry] of this.docs) this.sendSyncStep1(docId, entry.doc, peer);
  }

  private handleMessage(bytes: Uint8Array, from: PeerId): void {
    try {
      const decoder = decoding.createDecoder(bytes);
      const docId = decoding.readVarString(decoder);
      decoding.readVarUint(decoder); // MSG_SYNC wrapper — only one wrapper type exists today

      const entry = this.docs.get(docId);
      if (!entry) {
        this.onUnknownDoc?.(docId, from);
        return;
      }

      const replyEncoder = encoding.createEncoder();
      encoding.writeVarString(replyEncoder, docId);
      encoding.writeVarUint(replyEncoder, MSG_SYNC);
      // Pass `this` as the transaction origin so our own update listener (above)
      // recognizes this as a remote-applied change and does not rebroadcast it.
      const messageType = syncProtocol.readSyncMessage(decoder, replyEncoder, entry.doc, this);
      if (messageType === 0) {
        this.transport.send(encoding.toUint8Array(replyEncoder), from);
      }
    } catch (error) {
      console.warn("multiplex: dropping malformed frame", { from, error });
    }
  }
}
