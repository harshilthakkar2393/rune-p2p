# Plan 003: Sync hardening — foreground rejoin, backoff, cursor colours, single destroy

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before moving on. Touch only
> in-scope files. On any STOP condition, stop and report. Commit per step
> group (conventional commits, NO trailers). Do not edit `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7914c6c..HEAD -- apps/app/src/lib/sync apps/app/src/components/editor.tsx apps/app/src/routes/devices.tsx apps/app/src/routes/trash.tsx apps/app/src/hooks/use-index.ts`
> Any change → compare "Current state" excerpts; mismatch = STOP.

## Status

- **Priority** P1 · **Effort** M · **Risk** MED (lifecycle code is browser-only; pure parts are tested)
- **Depends on**: plans/001, plans/002 (both DONE, merged)
- **Planned at**: commit `7914c6c`, 2026-09-02

## Why this matters

B1/B2 sync works while a tab is awake. On phones it is not: iOS suspends
WebRTC when the app is backgrounded or the screen locks, and nothing today
rejoins the room, so sync silently dies until a reload. Relay hiccups look
identical ("connecting…" forever). All remote cursors are the same grey. And a
local permanent delete destroys the page DB twice (caller + manager observer).
This plan fixes those four things. It does not add a service worker or PWA
install (Phase E).

## Current state (verified at `7914c6c`)

Read `plans/001-phase-b1-sync-core.md` "Current state / Commands / Conventions"
first; unchanged. Bun only; `packages/ui/**` never edited; format single files
with `cd apps/app && bunx oxfmt <file>`; never root `bun run format`.

- `apps/app/src/lib/sync/manager.ts` — `SyncManager` with `start()` /
  `stop()` / `setPage()` / `awareness()` / `openedPageIds()` /
  `pendingCount()`; private `observeIndex()`, `handlePageRemoved(pageId)`,
  `pump()`. Module singletons: `startSyncIfPaired()`, `stopSync()`,
  `pairWithSecret()`, `unpair()`, `setPresencePage()`, `getSyncAwareness()`;
  module vars `currentManager`, `startInFlight`. `start()` begins:

  ```ts
  start(): void {
    if (this.started) return;
    this.started = true;
    const { sync, presence, leave } = this.deps.join();
    this.leaveRoom = leave;
  ```
  `stop()` unobserves, destroys presence + multiplexer, calls `leaveRoom`,
  clears queues, and `setSyncStatus({ connected: false, peers: [], pendingDocs: 0 })`.
  `observeIndex()` handles `change.action === "delete"` by calling
  `handlePageRemoved(key)`, which always calls `this.deps.destroyPage(pageId)`.
- `apps/app/src/lib/sync/status.ts` — `SyncStatus = { paired, connected, peers, pendingDocs, error }`, `setSyncStatus(patch)`, `useSyncStatus()`.
- `apps/app/src/lib/sync/transport.ts` — `joinPairedRoom(keys)` returns
  `{ sync, presence, leave, selfId }`; `leave()` calls `room.leave()`.
- `apps/app/src/lib/sync/presence.ts` — `Presence.peers()` returns remote `PresenceState[]`.
- `apps/app/src/components/editor.tsx:26-27`:
  ```ts
        user: { name: getDeviceName(), color: "#737373" },
        showCursorLabels: "activity",
  ```
- `apps/app/src/routes/trash.tsx:73` and `apps/app/src/hooks/use-index.ts:30`
  both call `void destroyPageDoc(pageId)` after a local permanent delete /
  purge. With sync running, the manager's index observer ALSO destroys the
  same page (double call; idempotent today).
- `apps/app/src/lib/sync/manager.test.ts` — `class FakeTransport implements
  Transport` (line 14), `buildManager(...)` helper (line 74), six tests.
  Model new tests on these. `Y.Map` observe events expose
  `event.transaction.local` (true for changes made in this doc).
- Devices page (`apps/app/src/routes/devices.tsx`) shows
  `status.connected ? "connected" : "connecting…"` in a mono `text-tiny` line.

Library facts:
- `document.visibilityState` / `visibilitychange`, `window` `online`/`offline`
  events: standard. iOS Safari fires `visibilitychange` → `visible` on
  foreground; WebRTC peers are usually gone by then (Trystero fires
  `onPeerLeave` late or not at all).
- Trystero `joinRoom` never rejects on relay failure; there is no
  "connected to relays" event we can trust. So "connected" is defined by
  peers, not by joining.

## Scope

**In scope** (only these):
- `apps/app/src/lib/sync/backoff.ts` (create) + `backoff.test.ts`
- `apps/app/src/lib/sync/device-color.ts` (create) + `device-color.test.ts`
- `apps/app/src/lib/sync/lifecycle.ts` (create; browser event wiring, no tests)
- `apps/app/src/lib/sync/manager.ts` + `manager.test.ts`
- `apps/app/src/lib/sync/status.ts`
- `apps/app/src/components/editor.tsx` (colour line only)
- `apps/app/src/routes/devices.tsx` (status line only)

**Out of scope**: `packages/ui/**`; `secret.ts`, `multiplex.ts`,
`presence.ts`, `transport.ts`, `pair-link.ts`; `trash.tsx`, `use-index.ts`,
`page-doc.ts`, `nodes.ts`; service worker / manifest / `storage.persist()`;
any new UI beyond the one status line; new shadcn components.

## Steps

### Step 1: `backoff.ts` — tests first

Pure, no timers:
```ts
export type BackoffState = { attempt: number; nextAllowedAt: number };
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 5 * 60_000;
export function initialBackoff(): BackoffState;                       // attempt 0, nextAllowedAt 0
export function canAttempt(state: BackoffState, now: number): boolean;
export function recordAttempt(state: BackoffState, now: number): BackoffState; // attempt+1, next = now + min(BASE * 2^attempt, MAX)
export function resetBackoff(): BackoffState;                         // back to initial
```
Tests (`backoff.test.ts`): initial allows immediately; after one attempt at
t=0 the next is allowed at 5 000 not 4 999; sequence of delays is 5s, 10s,
20s, 40s…; caps at 300 000; `resetBackoff()` allows immediately again;
functions never mutate their input (assert `Object.isFrozen` is NOT
required, but the input object must be unchanged after the call).
RED → commit `test: reconnect backoff spec` → implement → GREEN → commit
`feat: reconnect backoff`.

### Step 2: `device-color.ts` — tests first

```ts
export const DEVICE_COLORS: readonly string[]; // 8 oklch strings, L≈0.7 C≈0.15, hues 20,65,110,155,200,245,290,335
export function deviceColor(deviceId: string): string; // stable pick by FNV-1a hash of the id
```
Tests: same id → same colour; different ids spread (over 200 random nanoid-like
strings at least 6 of 8 colours appear); every result is in `DEVICE_COLORS`;
empty string does not throw. RED → commit → implement → commit
`feat: stable per-device colour`.

### Step 3: manager — connection semantics, restart, local-delete dedupe (tests first)

Extend `SyncStatus` in `status.ts`:
```ts
export type SyncStatus = {
  paired: boolean;
  /** true once at least one peer has joined this session. */
  connected: boolean;
  /** true while a restart is pending or in flight after a suspend/offline. */
  reconnecting: boolean;
  peers: PresenceState[];
  pendingDocs: number;
  error: string | null;
};
```
(add `reconnecting: false` to the initial state).

`manager.ts` changes:
1. **`connected` = peers > 0.** In `start()` stop setting `connected: true`
   on join; instead subscribe to the sync transport's `onPeerJoin` /
   `onPeerLeave` (the `Transport` interface has both) and set
   `connected: sync.peers().length > 0` on each. On first peer join call
   `this.backoff = resetBackoff()`.
2. **`restart(now = Date.now())`** public method: if
   `!canAttempt(this.backoff, now)` return `false`; else
   `this.backoff = recordAttempt(this.backoff, now)`, `setSyncStatus({ reconnecting: true })`,
   `this.stop()`, `this.start()`, `setSyncStatus({ reconnecting: false })`, return `true`.
   Page docs re-open instantly because `getPageDoc` caches; that is fine.
3. **`restartIfAlone(now)`**: `if (this.deps.join && this.peerCount() === 0) return this.restart(now); return false;`
   (`peerCount()` reads the current sync transport's `peers().length`.)
4. **Local delete dedupe:** in `observeIndex`, for `delete` actions only call
   `handlePageRemoved` when `event.transaction.local === false`. Local deletes
   are already destroyed by the caller (`trash.tsx`, `use-index.ts`).
   `handlePageRemoved` must still unregister the doc for local deletes —
   split it: always `unregisterPage(pageId)`; destroy only when remote.

Tests to add in `manager.test.ts` (FakeTransport already tracks peers via
`join(a,b)`; add a `leave(a,b)` helper that fires `onPeerLeave` on both if it
does not exist):
- `connected` is false right after `start()` with no peers, true after
  `join`, false again after `leave`.
- `restart()` honours backoff: two immediate calls → second returns false;
  with `now + 5000` → true.
- `restart()` re-registers the index and re-opens previously opened pages
  (openPage called again for each), and a remote edit after restart still
  arrives.
- Local `removeNode` on A: A's `destroyPage` is NOT called, and `"page:<id>"`
  is unregistered (`openedPageIds()` no longer contains it).
- Remote `removeNode` (from B): A's `destroyPage` called exactly once
  (existing test must still pass unchanged).

RED → commit `test: connection state, restart, local-delete dedupe` →
implement → GREEN → `bun test` all green → commit `feat: peer-based connected,
restart with backoff, single destroy`.

### Step 4: `lifecycle.ts` — browser wiring (no tests)

```ts
/** Rejoins the room when the tab returns to the foreground or the network comes back, if no peers are present. */
export function installSyncLifecycle(manager: { restartIfAlone(now?: number): boolean }): () => void;
```
Listeners: `document` `visibilitychange` → when `document.visibilityState === "visible"`
call `manager.restartIfAlone()`; `window` `online` → same; `window`
`pageshow` with `event.persisted === true` (bfcache) → same. Return a
function that removes all three. Guard `typeof document === "undefined"`.

In `manager.ts` `startSyncIfPaired()`: after `manager.start()`, call
`uninstallLifecycle = installSyncLifecycle(manager)`; in `stopSync()` and
`unpair()` call `uninstallLifecycle?.()` first. Module-level `let uninstallLifecycle: (() => void) | null`.
**Verify**: `bun run check` → 0. Commit `feat: rejoin on foreground / online`.

### Step 5: cursor colours

`editor.tsx`: `color: deviceColor(getDeviceId())` (import `deviceColor` from
`@/lib/sync/device-color`, `getDeviceId` from `@/lib/sync/secret`). Nothing else.
**Verify**: `bun run check` → 0; `bun run build` ok. Commit `feat: per-device cursor colour`.

### Step 6: Devices status line

In `devices.tsx` replace the `connected ? "connected" : "connecting…"` text with:
`status.reconnecting ? "reconnecting…" : status.connected ? "connected" : "looking for your devices…"`.
Keep the `pendingDocs` suffix. **Verify**: `bun run check` → 0; `bun run build` ok.
Commit `feat: honest sync status wording`.

## Done criteria

- [ ] `bun run check` → 0 warnings, 0 errors ×2
- [ ] `bun test` → 0 fail, ≥ 66 + 12 new tests
- [ ] `bun run build` ok
- [ ] `grep -n "connected: true" apps/app/src/lib/sync/manager.ts` → no match inside `start()` (connected is peer-driven)
- [ ] `grep -n "#737373" apps/app/src/components/editor.tsx` → no match
- [ ] `git diff --stat 7914c6c..HEAD` lists only in-scope files; `git status` clean
- [ ] Manual (reviewer/Harshil): background the iPhone app 30 s, foreground → Devices shows "reconnecting…" then "connected" within ~10 s, and an edit syncs without reload. 3-device (Mac/iPhone/iPad) session converges.

## STOP conditions

- Excerpts above no longer match.
- The `Transport` interface lacks `onPeerLeave` or `peers()` (it should have both; report if not).
- A test must be weakened to pass.
- Any edit needed in out-of-scope files.

## Maintenance notes

- `connected` now means "a peer is here". A lone device is `paired && !connected`, which is normal, not an error.
- Backoff resets on the first peer join, so a flapping network does not lock out reconnects for minutes once it recovers.
- Phase E (PWA) should reuse `installSyncLifecycle`; a service worker does not keep WebRTC alive, foreground rejoin still matters.
