# Plan 001: Ship the P2P sync core — pairing secret, doc multiplexer, presence, manager, minimal Devices page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f057633..HEAD -- apps/app/src/lib apps/app/src/hooks apps/app/src/routes/devices.tsx apps/app/src/routes/__root.tsx apps/app/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (new network layer; pure parts fully unit-tested, network part manually tested)
- **Depends on**: none
- **Category**: direction (approved roadmap Phase B1)
- **Planned at**: commit `f057633`, 2026-09-01

## Why this matters

rune is a local-first notes PWA with no accounts and no server. Today every
device is an island: notes live only in the IndexedDB of the browser that
wrote them. Phase B makes a user's own devices converge on the same data
peer-to-peer. B1 (this plan) delivers the working core: a pairing secret that
two devices share, a transport over Trystero (serverless WebRTC signaling via
public Nostr relays), a multiplexer that syncs the index Y.Doc and every page
Y.Doc over ONE room, presence (which devices are online), a manager that wires
it to the existing persistence, and a deliberately minimal Devices page to
pair/unpair by typing a 12-word phrase. QR, camera scanning, cursors, and
polish are later plans (B2/B3) and are out of scope here.

The full design rationale is in `docs/plans/phase-b-sync.md` (read it once;
this plan is self-contained but that file explains the "why" of each choice).

## Current state

Repo: `~/Desktop/rune`, Turborepo, **bun only** (never npm/pnpm/yarn).
`apps/app` = the Vite + TanStack Router SPA (`@rune/app`). `packages/ui` =
shadcn components (registry-pristine, do NOT edit, do NOT run the root
`format` script — it rewrites them).

Relevant files today:

- `apps/app/src/lib/index-doc.ts` — singleton index `Y.Doc`, `getIndexDoc()`,
  `getNodesMap()` (a `Y.Map<Node>` named `"nodes"`), `initIndexPersistence()`
  (y-indexeddb, db `rune:index`), `deletePageDb(pageId)`.
- `apps/app/src/lib/page-doc.ts` — `getPageDoc(pageId): { doc, whenSynced }`
  (one `Y.Doc` per page, y-indexeddb db `rune:page:<id>`, session-cached in
  a module `Map`), `destroyPageDoc(pageId)`.
- `apps/app/src/lib/nodes.ts` — all index mutations. `listLive(map)`,
  `listTrashed(map)`, `removeNode(map,id)` (permanent delete, returns
  `removedPageIds`), `purgeExpired(map)`. Errors use `better-result`
  `TaggedError` + `Result` (see lines 25-70). Match this for new error types.
- `apps/app/src/hooks/use-index.ts` — React binding for the index map. Lines
  21-35 bootstrap persistence then run `purgeExpired` / `ensureDefaultFolder`
  / `adoptOrphanPages`. **There is no observer that reacts to pages removed
  from the map by a REMOTE peer**, so a page deleted on device A would leave
  its `rune:page:<id>` IndexedDB on device B forever. This plan adds that.
- `apps/app/src/lib/device.ts` — `getDeviceName()` / `setDeviceName()`
  (localStorage key `rune-device-name`).
- `apps/app/src/lib/inspector.ts` and `apps/app/src/lib/palette.ts` — the
  repo's store pattern: module-level state + `Set` of listeners +
  `useSyncExternalStore`. Copy this shape for `status.ts`.
- `apps/app/src/routes/devices.tsx` — placeholder page: `<h1
  class="text-h1">Devices</h1>` inside `<main className="mx-auto w-full
  max-w-2xl px-8 pt-3 pb-6">` in a `ScrollArea`, with an `Empty` block "Local
  only". Replace the Empty block; keep the header/layout.
- `apps/app/src/routes/__root.tsx` — root layout. Providers: ThemeProvider >
  TooltipProvider > SidebarProvider. The sync manager is started from here
  (Step 8).
- `apps/app/src/lib/nodes.test.ts` — the test exemplar: `bun:test`
  (`describe/test/expect`), fresh `Y.Doc` per test, `unwrap()` helper for
  Results. Model all new tests on it.

Excerpt — `apps/app/src/hooks/use-index.ts:21-35` (the bootstrap you will
extend):

```ts
function start() {
  if (started) return;
  started = true;
  void initIndexPersistence().then(() => {
    const map = getNodesMap();
    const { removedPageIds } = purgeExpired(map);
    for (const pageId of removedPageIds) void destroyPageDoc(pageId);
    ensureDefaultFolder(map);
    adoptOrphanPages(map);
  });
  refreshSnapshot();
}
```

Excerpt — `apps/app/src/lib/page-doc.ts:19-31`:

```ts
export function getPageDoc(pageId: string): PageDocHandle {
  const existing = openDocs.get(pageId);
  if (existing) return existing.handle;
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(pageDbName(pageId), doc);
  const handle: PageDocHandle = { doc, whenSynced: persistence.whenSynced.then(() => undefined) };
  openDocs.set(pageId, { handle, persistence });
  return handle;
}
```

Conventions to match:

- Imports: `@/lib/...` alias. `verbatimModuleSyntax` is on: `import type`
  for types. `noUnusedLocals`/`noUnusedParameters` are on.
- Files 200-400 lines, small functions, no mutation of shared objects where a
  copy is natural (see `use-selection.ts`). Errors are explicit; never
  swallow. Doc comments explain *why*, briefly.
- Formatting: run `cd apps/app && bunx oxfmt <file>` on files you touch. NOT
  the root `bun run format`.
- UI: only shadcn components from `@rune/ui/components/*` (Button, Input,
  InputGroup, Badge, AlertDialog, Empty, Card exist). Header grammar:
  `text-h1`, mono `text-tiny text-muted-foreground` meta. No arbitrary
  Tailwind values when a scale class exists.
- Commits: conventional (`feat:`, `fix:`, `test:`), e.g. `feat: New page as
  primary sidebar action`. **No Co-Authored-By trailers** (attribution is
  disabled in this repo). Local-only git, never push.

Library facts (verified 2026-09-01; do not rely on older snippets):

- `trystero@0.25.x`: `import { joinRoom, selfId } from "trystero"` (Nostr
  strategy is the default export). `joinRoom({ appId, password, relayConfig:
  { redundancy: 5 } }, roomId)`. **`room.makeAction<T>("name")` returns an
  OBJECT** `{ send, onMessage, onProgress }` (older versions returned a
  tuple — do not copy those). `send(data, { target?: peerId | peerId[] })`.
  `onMessage((data, { peerId }) => …)`. Binary `Uint8Array` arrives as
  `ArrayBuffer` on the receiver — wrap it: `new Uint8Array(buf)`.
  **CORRECTION (verified in installed types at review): `action.onMessage`, `room.onPeerJoin`, `room.onPeerLeave` are settable PROPERTIES holding one callback, e.g. `room.onPeerJoin = (peerId) => …` — not methods.** `room.getPeers()`,
  `room.leave()`. Action names ≤ 32 bytes. Trystero hashes `password` with a
  single SHA-256, so pass it a derived key, never the raw secret.
- `@scure/bip39@2.x`: `entropyToMnemonic(bytes16, wordlist)` → 12 words;
  `mnemonicToEntropy(phrase, wordlist)` → `Uint8Array(16)` (throws on bad
  checksum); `validateMnemonic(phrase, wordlist)`. Wordlist import:
  `import { wordlist } from "@scure/bip39/wordlists/english.js"`.
- `y-protocols` (already installed): `import * as syncProtocol from
  "y-protocols/sync"`; `writeSyncStep1(encoder, doc)`,
  `readSyncMessage(decoder, encoder, doc, origin)` returns the message type
  (`0` = SyncStep1, meaning the encoder now holds a reply that must be sent),
  `writeUpdate(encoder, update)`. `import { Awareness,
  encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from
  "y-protocols/awareness"`. Encoding helpers: `import * as encoding from
  "lib0/encoding"`, `import * as decoding from "lib0/decoding"` (lib0 is a
  dependency of yjs; add it explicitly if the import fails).
- WebCrypto HKDF: `crypto.subtle.importKey("raw", secret, "HKDF", false,
  ["deriveBits"])` then `crypto.subtle.deriveBits({ name: "HKDF", hash:
  "SHA-256", salt, info }, key, 256)`. Works in Bun's test runtime and in
  Safari 11+. Requires a secure context in browsers (https or localhost).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `cd ~/Desktop/rune && bun install` | exit 0 |
| Add deps | `cd ~/Desktop/rune/apps/app && bun add trystero @scure/bip39` | package.json updated, exit 0 |
| Typecheck + lint | `cd ~/Desktop/rune && bun run check` | `Found 0 warnings and 0 errors` for both packages, `Tasks: 2 successful` |
| Tests | `cd ~/Desktop/rune && bun test` | `0 fail`, count grows from 26 as you add tests |
| Single test file | `cd ~/Desktop/rune/apps/app && bun test src/lib/sync/multiplex.test.ts` | `0 fail` |
| Build | `cd ~/Desktop/rune && bun run build` | `✓ built in …`, `Tasks: 1 successful` |
| Format a file | `cd ~/Desktop/rune/apps/app && bunx oxfmt src/lib/sync/secret.ts` | exit 0 |
| Dev server | `cd ~/Desktop/rune && bun run dev` | app on http://localhost:3000 |

## Scope

**In scope** (the only files you may create or modify):

- `apps/app/package.json` (dependency additions only) + root `bun.lock`
- `apps/app/src/lib/sync/secret.ts` (create) + `secret.test.ts`
- `apps/app/src/lib/sync/multiplex.ts` (create) + `multiplex.test.ts`
- `apps/app/src/lib/sync/presence.ts` (create) + `presence.test.ts`
- `apps/app/src/lib/sync/transport.ts` (create)
- `apps/app/src/lib/sync/manager.ts` (create) + `manager.test.ts`
- `apps/app/src/lib/sync/status.ts` (create)
- `apps/app/src/hooks/use-index.ts` (add remote-delete observer + start sync)
- `apps/app/src/routes/devices.tsx` (replace placeholder content)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `packages/ui/**` — shadcn registry files; never hand-edit. If you believe
  a new shadcn component is required, STOP and report which one.
- `apps/app/src/lib/index-doc.ts`, `page-doc.ts`, `nodes.ts`, `schema.ts` —
  persistence and CRUD are consumed as-is. If the design seems to require
  changing them, STOP and report.
- `apps/app/src/components/editor.tsx` (cursors are B2),
  `app-sidebar.tsx` (indicator is B2), any new route such as `/pair` (B2).
- QR generation, camera scanning, visibility/reconnect handling (B2/B3).
- Root `bun run format`.

## Git workflow

- Work on the current branch (repo is local-only, single developer). Do not
  push, do not open a PR.
- One commit per step group: `test:` for red tests, `feat:` for the module
  that turns them green, `feat:` for UI. Conventional commit style; no
  trailers.

## Steps

### Step 1: Add dependencies

```
cd ~/Desktop/rune/apps/app && bun add trystero @scure/bip39
cd ~/Desktop/rune && bun install
```

Then confirm `lib0` resolves: `cd apps/app && bun -e 'import("lib0/encoding").then(()=>console.log("ok"))'`.
If it prints anything other than `ok`, run `bun add lib0` as well.

**Verify**: `cd ~/Desktop/rune && bun run check` → 0 errors (nothing uses the
deps yet).

### Step 2: `secret.ts` — tests first, then implement

Create `apps/app/src/lib/sync/secret.test.ts` covering (model on
`nodes.test.ts`):

1. `generateSecret()` returns a `Uint8Array` of length 16; two calls differ.
2. `secretToPhrase(secret)` returns exactly 12 space-separated words; all
   words are in the english wordlist.
3. `phraseToSecret(secretToPhrase(s))` round-trips to the same bytes.
   Accepts extra whitespace and mixed case (normalize with `trim()`,
   collapse whitespace, `toLowerCase()`).
4. `phraseToSecret("abandon ".repeat(12).trim())` (bad checksum) returns
   `Result.err` with a `TaggedError` named `InvalidPhraseError` — never
   throws. Also 11 words → err.
5. `deriveKeys(secret)` resolves to `{ roomId: string; password: string }`,
   both 64-char lowercase hex; deterministic (same input → same output) and
   `roomId !== password`.
6. `encodeSecret(secret)` / `decodeSecret(str)` round-trip via base64url
   (no `+`, `/`, `=` in the string). `decodeSecret("not-base64!!")` returns
   `Result.err(InvalidSecretError)`.

Run: `cd apps/app && bun test src/lib/sync/secret.test.ts` → **must fail**
(module missing). Commit `test: pairing secret spec`.

Create `apps/app/src/lib/sync/secret.ts` with exactly those exports plus:

- `readStoredSecret(): Uint8Array | null` — `localStorage["rune-pair-secret"]`
  decoded; returns `null` on missing, invalid, or when `localStorage` is
  unavailable (wrap in try/catch, like `device.ts`).
- `storeSecret(secret)` / `clearStoredSecret()`.
- `getDeviceId(): string` — `localStorage["rune-device-id"]`, created with
  `nanoid()` on first read; falls back to a per-session nanoid when storage
  is unavailable.
- HKDF constants: salt `new TextEncoder().encode("rune-v1")`, info strings
  `"room"` and `"signal"`.

Tests must only exercise the pure functions (Bun has no `localStorage`).

**Verify**: `bun test src/lib/sync/secret.test.ts` → 0 fail. `bun run check`
→ 0 errors. Commit `feat: pairing secret — phrase, HKDF keys, storage`.

### Step 3: `multiplex.ts` — the transport-agnostic doc sync

Define in `multiplex.ts`:

```ts
export type PeerId = string;
export interface Transport {
  /** Send bytes to one peer, or broadcast when target is undefined. */
  send(bytes: Uint8Array, target?: PeerId): void;
  onMessage(handler: (bytes: Uint8Array, from: PeerId) => void): () => void;
  onPeerJoin(handler: (peer: PeerId) => void): () => void;
  onPeerLeave(handler: (peer: PeerId) => void): () => void;
  peers(): PeerId[];
}
export class Multiplexer {
  constructor(transport: Transport);
  register(docId: string, doc: Y.Doc): void;   // sends SyncStep1 for this doc to every current peer
  unregister(docId: string): void;            // detaches update listener
  has(docId: string): boolean;
  destroy(): void;                            // unregisters all, removes transport handlers
  /** Called when a frame arrives for a docId that is not registered. Default: ignore. */
  onUnknownDoc?: (docId: string, from: PeerId) => void;
}
```

Frame layout (all via lib0 encoding): `writeVarString(docId)`,
`writeVarUint(MSG_SYNC = 0)`, then the y-protocols sync payload. Behaviors:

- On `register`: attach `doc.on("update", (update, origin) => …)`; when
  `origin !== this` (use the Multiplexer instance as the origin marker for
  remote-applied updates) broadcast a frame with `syncProtocol.writeUpdate`.
  Then, for each current peer, send SyncStep1 for this doc.
- On peer join: send SyncStep1 for every registered doc to that peer.
- On message: decode docId; if unregistered call `onUnknownDoc` and drop;
  else `readSyncMessage(decoder, replyEncoder, doc, this)`; if the returned
  type is `0` (step1) send the reply encoder's bytes back to `from`.
  Pass `this` as the transaction origin so the update listener above does
  not echo remote updates.
- Never throw on malformed frames: catch, `console.warn` with docId/peer, drop.

Tests first — `multiplex.test.ts` — with an in-memory `FakeTransport` that
links N transports (each `send` delivers synchronously to the target(s)'
`onMessage` handlers; `join(a, b)` fires `onPeerJoin` on both). Cases:

1. Two peers, both register `"index"` with docs that each have prior local
   text → after join both docs' `getText("t").toString()` are equal and
   contain both inserts.
2. Local edit after sync propagates to the other peer.
3. No echo: count frames sent by A; a remote-applied update produces zero
   additional sends from A.
4. Late registration: B registers `"page:1"` after join; A registers later;
   they still converge.
5. Isolation: A registers `"page:1"` and `"page:2"`; an edit in page:1 never
   touches B's page:2 state.
6. Unknown doc: frame for unregistered id calls `onUnknownDoc(id, from)` and
   throws nothing.
7. Three peers converge (A,B,C all joined pairwise).
8. Malformed bytes (`new Uint8Array([255,1,2])`) do not throw.

Run → must fail. Commit `test: doc multiplexer spec`. Implement. Run → 0 fail.
Commit `feat: multiplexer — N Y.Docs over one transport`.

**Verify**: `bun test src/lib/sync/multiplex.test.ts` → 0 fail; `bun run
check` → 0 errors.

### Step 4: `presence.ts`

```ts
export type PresenceState = { deviceId: string; name: string; pageId: string | null };
export class Presence {
  constructor(doc: Y.Doc, transport: Transport, local: PresenceState);
  readonly awareness: Awareness;
  setLocal(patch: Partial<PresenceState>): void;
  /** Remote states only, excluding this client. */
  peers(): PresenceState[];
  onChange(cb: () => void): () => void;
  destroy(): void;
}
```

Wire exactly as y-protocols expects: on awareness `"update"` (not
`"change"` — `"update"` also fires on the 3-second renewal so remote peers
do not time us out) with origin `!== "remote"`, send
`encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed])`;
incoming bytes → `applyAwarenessUpdate(awareness, bytes, "remote")`; on
peer join send own state to that peer; `destroy()` calls
`removeAwarenessStates(awareness, [awareness.clientID], "local")`.

Presence frames travel on the SAME `Transport` interface but must not
collide with sync frames. Do this by giving `Presence` its own Transport
instance (the real transport in Step 5 exposes two: one per Trystero action).
Tests (`presence.test.ts`). Do NOT create a shared `fake-transport.ts`
module; copy the ~30-line `FakeTransport` helper from `multiplex.test.ts`
into this test file. Test helpers stay inside test files in this repo:

1. Two presences over linked fake transports: after join, `A.peers()` has
   B's state and vice versa.
2. `setLocal({ pageId: "p1" })` on A shows up in `B.peers()`.
3. `destroy()` on A removes it from `B.peers()`.

Commit `test:` then `feat: presence over awareness`.

### Step 5: `transport.ts` — Trystero adapter (no unit tests; manual)

```ts
export type RoomHandle = {
  sync: Transport;      // action "y-sync"
  presence: Transport;  // action "y-aware"
  leave(): void;
  selfId: string;
};
export function joinPairedRoom(keys: { roomId: string; password: string }): RoomHandle;
```

`joinRoom({ appId: "rune", password: keys.password, relayConfig: { redundancy: 5 } }, keys.roomId)`.
Each `Transport` wraps one `room.makeAction<Uint8Array>(name)`: `send` →
`action.send(bytes, target ? { target } : undefined)`; `onMessage` →
`action.onMessage((data, meta) => handler(new Uint8Array(data as ArrayBuffer), meta.peerId))`.
`onPeerJoin`/`onPeerLeave` fan out `room.onPeerJoin`/`onPeerLeave` to a local
listener set (Trystero accepts one callback per room; multiplex them yourself).
`peers()` → `Object.keys(room.getPeers())`.

**Verify**: `bun run check` → 0 errors. Commit `feat: trystero transport`.

### Step 6: `status.ts` — store for the UI

Same shape as `inspector.ts`:

```ts
export type SyncStatus = {
  paired: boolean;
  connected: boolean;          // room joined
  peers: PresenceState[];      // online devices, excluding self
  pendingDocs: number;         // page docs still queued for first sync
};
export function useSyncStatus(): SyncStatus;
export function setSyncStatus(patch: Partial<SyncStatus>): void;  // used by manager only
```

**Verify**: `bun run check` → 0 errors.

### Step 7: `manager.ts` — glue, with tests through an injected transport

```ts
export type ManagerDeps = {
  indexDoc: Y.Doc;
  nodesMap: Y.Map<Node>;
  openPage: (pageId: string) => Promise<Y.Doc>;   // prod: getPageDoc(id) → whenSynced → doc
  destroyPage: (pageId: string) => Promise<void>; // prod: destroyPageDoc
  join: () => { sync: Transport; presence: Transport; leave(): void };
  local: PresenceState;
  concurrency?: number;                           // default 8
};
export class SyncManager {
  constructor(deps: ManagerDeps);
  start(): void;   // joins, registers index, starts page queue, installs index observer
  stop(): void;    // leaves, destroys multiplexer/presence, removes observer
}
export function startSyncIfPaired(): void;   // reads stored secret; derives keys; builds deps from real modules; starts. Idempotent.
export function stopSync(): void;
export function pairWithSecret(secret: Uint8Array): Promise<void>;  // store, then startSyncIfPaired
export function unpair(): void;                                     // stopSync, clearStoredSecret, status paired=false
```

Behaviors (each is a test in `manager.test.ts`, using FakeTransport and
in-memory `openPage` that returns a fresh `Y.Doc` per id):

1. `start()` registers `"index"` on the multiplexer (two managers over linked
   transports converge their nodes maps).
2. Page queue: with 20 pages in the index (live and trashed both count), all
   20 get `openPage` called and registered; at most `concurrency` opens are
   in flight at once (assert via a counter in the fake `openPage` that
   resolves manually).
3. A page added to the index by the REMOTE peer (B creates via `createPage`)
   gets opened and registered on A within the same tick after the index
   update is applied.
4. **Remote delete**: B calls `removeNode(map, pageId)`; A's manager calls
   `destroyPage(pageId)` exactly once and unregisters `"page:<id>"`.
   Trashing (`trashNode`) must NOT trigger destroy — only removal from the
   map.
5. `stop()` then a remote edit → A's index doc unchanged.
6. `onUnknownDoc` for a `"page:<id>"` that IS in the index but not yet
   opened triggers an immediate open + register (jump the queue), so the
   currently-edited page on B syncs first.

Doc ids: `"index"` for the index doc, `"page:" + pageId` for pages.

Index observer implementation: `nodesMap.observe(event => { for (const [key, change] of event.changes.keys) if (change.action === "delete") … ; if (change.action === "add") … })`. Ignore `"update"`.

Run tests → fail. Commit `test:`. Implement. Commit `feat: sync manager`.

**Verify**: `bun test` → 0 fail (all suites), `bun run check` → 0 errors.

### Step 8: Wire into the app

In `apps/app/src/hooks/use-index.ts` `start()`, after `adoptOrphanPages(map);`
add `startSyncIfPaired();` (import from `@/lib/sync/manager`). This is the
one place the app boots the index, so sync boots there too. Nothing else
changes in this file.

Note: the remote-delete observer lives in the manager (Step 7), not here, so
unpaired devices keep today's behavior.

**Verify**: `bun run check` → 0 errors; `bun run dev` boots without console
errors when unpaired.

### Step 9: Minimal Devices page

Replace the `Empty` block in `apps/app/src/routes/devices.tsx`. Keep the
existing header and `max-w-2xl` column. Use `useSyncStatus()`.

Unpaired state (a `Card` with `p-6`):
- Title "Pair your devices" (`text-h3`), one-line muted description.
- Button "Create pairing code" → generates a secret, calls
  `pairWithSecret`, then shows the phrase (see below).
- Below, "Have a code?" — an `Input` (placeholder "twelve words") + Button
  "Pair". On submit: `phraseToSecret`; on err show the message under the
  input in `text-destructive text-small`; on ok `pairWithSecret`.

Paired state:
- Row: this device — `getDeviceName()` (already editable elsewhere? if not,
  plain text is fine here) + `Badge` "this device".
- Rows for each `status.peers` entry: dot + name + muted `pageId ? "editing" : "online"` (title lookup is B2; do not add it).
- Muted mono `text-tiny`: `connected ? "connected" : "connecting…"`, and
  `pendingDocs > 0 ? " · syncing N" : ""`.
- Button "Show pairing code" → reveals the 12 words in a `font-mono
  text-small` block with a "Copy" button (`navigator.clipboard.writeText`).
- Button variant `ghost` in `text-destructive`: "Unpair this device" →
  `AlertDialog` ("Notes stay on this device. It just stops syncing.") →
  `unpair()`.

**Verify**: `bun run check` → 0 errors; `bun run build` succeeds. Manual:
open http://localhost:3000/devices in Chrome and Safari on the same Mac.
Chrome: Create pairing code, copy phrase. Safari: paste, Pair. Within ~5 s
both pages show the other device online. Create a page in Chrome, type a
line: Safari's Library shows the page and opening it shows the line.
Delete it permanently from Chrome's Trash: it disappears from Safari's
Trash and `indexedDB.databases()` in Safari's console no longer lists
`rune:page:<id>`. Unpair in Safari: Chrome shows 0 peers.

Commit `feat: Devices page — pair by phrase, online devices, unpair`.

## Test plan

- `secret.test.ts` — 6 cases in Step 2.
- `multiplex.test.ts` — 8 cases in Step 3 with in-file `FakeTransport`.
- `presence.test.ts` — 3 cases in Step 4.
- `manager.test.ts` — 6 cases in Step 7.
- Pattern: `apps/app/src/lib/nodes.test.ts`. Pure Y.Docs, no IndexedDB, no
  network, no DOM.
- Verification: `cd ~/Desktop/rune && bun test` → 0 fail, ≥ 49 tests.

## Done criteria

ALL must hold:

- [ ] `cd ~/Desktop/rune && bun run check` → `Found 0 warnings and 0 errors` ×2
- [ ] `bun test` → `0 fail`, ≥ 49 tests, including the four new files
- [ ] `bun run build` succeeds
- [ ] `grep -rn "makeAction" apps/app/src/lib/sync/transport.ts` shows object
      destructuring or property access, never `const [send, get] =`
- [ ] `grep -rn "rune-pair-secret" apps/app/src` matches only `secret.ts`
- [ ] `git status --short` lists only in-scope files
- [ ] Manual two-browser check in Step 9 passed (state which browsers)
- [ ] `plans/README.md` row 001 updated

## STOP conditions

Stop and report back if:

- Excerpts in "Current state" no longer match the live files.
- `room.makeAction` in the installed trystero returns an array/tuple (means a
  version < 0.25 was installed; report the version from `bun pm ls trystero`).
- `crypto.subtle.deriveBits` with HKDF throws in `bun test` — report; do not
  swap in a hand-rolled HKDF.
- Any step needs edits to `packages/ui/**`, `index-doc.ts`, `page-doc.ts`,
  `nodes.ts`, or `schema.ts`.
- A test written in Steps 2/3/4/7 needs to be weakened to pass. Report which
  and why instead.
- Two browsers never see each other within 60 s in the Step 9 manual check
  (likely relay/network); report console output rather than adding relays.

## Maintenance notes

- Doc id convention `"index"` / `"page:<id>"` is now a wire format shared by
  all paired devices. Changing it later requires every device to update
  together; version it (`"v2:..."`) rather than renaming.
- The page queue opens every page doc on join. If page count grows into the
  thousands, revisit with a "have-list" exchange. Watch `pendingDocs`.
- B2 will add: QR (`lean-qr`), `/pair` route reading `#phrase`, in-app
  scanner (`qr-scanner`), sidebar "N online", BlockNote cursors via
  `presence.awareness`. B3: `visibilitychange` rejoin (iOS suspends WebRTC
  in background), reconnect backoff, 3-device real test.
- Reviewer focus: origin handling in `multiplex.ts` (echo storms are the
  classic bug), the delete-vs-trash distinction in the index observer, and
  that `unpair()` leaves the room before clearing the secret.
