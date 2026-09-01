# Phase B — Pairing + P2P sync

Status: PLAN, awaiting go. Written 2026-09-01. Research basis: trystero 0.25.4,
y-protocols 1.0.7, @scure/bip39 2.4.0, lean-qr 2.7.3, qr-scanner 1.4.2.

## Goal

Two or more of Harshil's devices holding the same pairing secret find each
other with no server and converge on the same index + page documents, live
while co-present and by catch-up after offline gaps. No accounts.

## Decisions (locked by this plan)

| Topic | Decision | Why |
| --- | --- | --- |
| Signaling | `trystero` 0.25.4, default Nostr strategy, `relayConfig.redundancy` 5 | Maintainer-recommended; 29 live relays; torrent trackers churn. 22 kB gz. |
| Provider | **Own ~150-line multiplexer**, not `y-webrtc-trystero` | That lib is one-room-per-doc, beta, pinned to trystero 0.21, broken by 0.25 `makeAction` object return. `y-trystero` archived. |
| Doc transport | ONE room per pairing, two actions `y-sync` / `y-aware`, frame = `[varString docId][varUint type][payload]` | Hundreds of page docs must not mean hundreds of relay announces. Subdocs rejected: no provider syncs them over one transport, and IndexedDB-per-doc already exists. |
| Which page docs sync | Index first, then **all** page docs (live + trashed) via a background queue, concurrency 8, plus any page that later appears in the index | Device B must receive content for pages it never opened. Docs are journal-sized. Lazy "have lists" = complexity for no gain at this scale. |
| Secret | 16 random bytes. `@scure/bip39` → 12 words (checksummed). Stored `localStorage["rune-pair-secret"]` base64url | Audited, 14 kB gz. Checksum catches typos. Loss is trivial (notes are local anyway). |
| Key derivation | WebCrypto HKDF-SHA256, salt `rune-v1`, `info` = `room` → roomId hex, `info` = `signal` → Trystero `password` | Trystero only SHA-256s the password once, so feed it a derived key, never the raw secret. Distinct infos per purpose. |
| QR | `lean-qr` (SVG, <4 kB). Payload = `${origin}/pair#<phrase>` (fragment never reaches a server) | Desktop-to-desktop works with any scanner; in-app scanner handles PWA. |
| Scanning | `qr-scanner` (nimiq) in-app + manual phrase entry | iOS Safari `BarcodeDetector` is off by default; iOS Camera app opens URLs in Safari whose storage is separate from the installed PWA, so the PWA needs its own scanner. Phrase entry is the universal fallback. |
| Presence | One `Awareness` on the index doc: `{ deviceId, name, pageId }` | Presence is per device, not per page. Also feeds BlockNote remote cursors. |
| Reconnect | `visibilitychange` → if hidden>foreground and no peers, leave + rejoin | iOS suspends WebRTC in background. Trystero issues #151/#161 (partial mesh ≥3 peers) accepted; rejoin is the fix. |
| Remote deletes | Index `observe` → for removed page ids, `destroyPageDoc` + unregister | Currently B never drops a page DB that A deleted. Gap found during planning. |
| Editor | Pass `{ awareness }` as BlockNote collaboration provider, user = device name | Free cross-device cursors. |

## Non-goals

- Always-on replica (Pi tab). Selective sync. At-rest encryption. Conflict UI
  (CRDT handles it). Sync to Safari-tab AND installed-PWA on same iPhone.
- Rewriting persistence: y-indexeddb stays as is.

## Module layout (`apps/app/src/lib/sync/`)

| File | Responsibility | Test |
| --- | --- | --- |
| `secret.ts` | generate / phrase↔bytes / HKDF derive / localStorage read-write-clear / deviceId | `secret.test.ts`: roundtrip, checksum rejects, HKDF deterministic + distinct per info |
| `multiplex.ts` | pure: `register(docId, doc)`, `unregister`, `onPeerJoin(peer)` → step1 per doc, `onMessage(peer, bytes)`, update broadcast with origin tagging. Depends on an injected `Transport` interface | `multiplex.test.ts`: two multiplexers over an in-memory fake transport: full sync, no echo, late-registered doc catches up, per-doc isolation, three peers |
| `presence.ts` | Awareness wiring, `y-aware` frames, local state setters | `presence.test.ts`: encode/apply through fake transport |
| `transport.ts` | Trystero room lifecycle, `Transport` impl, visibility rejoin | manual (network) |
| `manager.ts` | glue: on secret → join; register index; page queue; index observer for new/removed pages | `manager.test.ts` with fake transport: remote delete destroys, new page registers |
| `status.ts` | `useSyncExternalStore` store: `{ paired, peers: [{deviceId,name}], pendingDocs }` | trivial |

Public surface used by UI: `startSync()`, `stopSync()`, `pair(secret)`,
`unpair()`, `useSyncStatus()`, `getPairingPhrase()`.

## UI

- **/devices** (existing settings column): unpaired → "Pair your devices"
  card: [Create pairing code] / [I have a code]. Paired → this device (name
  editable, exists), online devices list (dot + name + "editing <page>"),
  [Show pairing code] (QR + 12 words, copy), [Unpair this device] (confirm:
  notes stay).
- **/pair** route: reads `#phrase`, shows confirm, stores, redirects to
  /devices. In-app scanner opens as a Dialog with `<video playsinline muted>`.
- **Sidebar Devices row**: trailing mono `text-tiny` "2 online" when peers>0.
- Follows existing header grammar; only shadcn primitives (Dialog, Input,
  InputGroup, Badge, Empty, AlertDialog).

## Delivery — three `/ship` runs

**B1 core (no network UI polish):** deps; `secret`, `multiplex`, `presence`,
`transport`, `manager`, `status`; index observer for remote deletes; minimal
Devices page = show phrase / enter phrase / unpair. TDD on all pure modules.
Acceptance: Chrome + Safari on one Mac paired by phrase; page created on A
appears with content on B ≤1 s; concurrent edits merge; delete on A removes
on B; B offline edits merge on return.

**B2 pairing UX:** QR generate (`lean-qr`), `/pair` route, in-app scanner
(`qr-scanner`), online devices list, sidebar indicator, BlockNote cursors.

**B3 hardening:** visibility rejoin, reconnect backoff, 3-device real test
(Mac / iPhone / iPad on LAN and on cellular), queue tuning, PWA note.

## Risks

- **Secure context on LAN devices**: WebCrypto + camera need https. `vite
  --host` over http fails on iPad. Use `@vitejs/plugin-basic-ssl` for dev or a
  Vercel preview URL. Decide in B1.
- Nostr relays blocked on some networks → no discovery. Mitigation later:
  add `@trystero-p2p/mqtt` as second strategy.
- Hundreds of IndexedDB opens on first pair. Queue with cap 8; measure.
- Trystero `makeAction` returns object in 0.25 — do not copy 0.21-era snippets.

## Open questions for Harshil

1. Phrase language: English wordlist only? (yes assumed)
2. Show "editing <page title>" in presence, or just device name? (assumed: yes)
3. Dev https approach: basic-ssl plugin vs Vercel preview? (assumed: basic-ssl)
