# Plan 002: Pairing UX — QR code, pair link route, camera scanner, live presence, cursors

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> Touch only in-scope files. On any STOP condition, stop and report. Do not
> improvise. Commit per step group (conventional commits, NO trailers).
> Your reviewer maintains `plans/README.md` — do not edit it.
>
> **Drift check (run first)**:
> `git diff --stat 835e631..HEAD -- apps/app/src apps/app/package.json`
> Any change → compare "Current state" excerpts to live code; mismatch = STOP.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED (camera + cursors are the risky bits; both have skip hatches)
- **Depends on**: plans/001 (DONE, merged at `64167bd`)
- **Category**: direction (roadmap Phase B2)
- **Planned at**: commit `835e631`, 2026-09-01

## Why this matters

B1 made pairing work by typing 12 words. That is fine between two laptops
and painful on a phone. B2 makes pairing a 5-second act: the paired device
shows a QR, the new device scans it in-app (or opens the link), done. It also
makes sync *visible*: the sidebar says "2 online", the Devices page says which
page each device is editing, and the editor shows the other device's cursor.

## Current state (all verified at `835e631`)

Repo facts, conventions, commands: identical to `plans/001-phase-b1-sync-core.md`
(read its "Current state", "Commands", and "Conventions" sections first; they
apply unchanged). Bun only. `packages/ui/**` is registry-pristine, never edit.
Format single files with `cd apps/app && bunx oxfmt <file>`; never root format.

Sync layer that exists now (`apps/app/src/lib/sync/`):

- `secret.ts` — `generateSecret`, `secretToPhrase`, `phraseToSecret` (Result),
  `encodeSecret`/`decodeSecret` (base64url, Result), `readStoredSecret`,
  `storeSecret`, `clearStoredSecret`, `getDeviceId`. Errors are
  `better-result` `TaggedError`s (`InvalidPhraseError`, `InvalidSecretError`).
- `presence.ts` — `class Presence { awareness; setLocal(patch); peers(); onChange(cb); destroy() }`,
  `PresenceState = { deviceId; name; pageId: string | null }`.
- `manager.ts` — `SyncManager` (private fields `presence`, `multiplexer`),
  module singletons `startSyncIfPaired()`, `stopSync()`, `pairWithSecret(secret)`,
  `unpair()`, module var `currentManager: SyncManager | null`.
- `status.ts` — `useSyncStatus()` → `{ paired, connected, peers: PresenceState[], pendingDocs, error }`.

Excerpt — `apps/app/src/routes/page.$pageId.tsx:27-33` (the effect you extend):

```ts
  useEffect(() => {
    recordOpen(pageId);
    setInspectorPage(pageId);
    const node = getNodesMap().get(pageId);
    if (node?.type === "page" && node.folderId !== null) rememberFolder(node.folderId);
    return () => setInspectorPage(null);
  }, [pageId]);
```

Excerpt — `apps/app/src/components/editor.tsx:14-25`:

```ts
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment(PAGE_FRAGMENT),
        // No provider: local-only for now. Awareness/cursors arrive with sync.
        user: { name: "me", color: "#737373" },
      },
    }),
    [doc],
  );
```

Excerpt — `apps/app/src/components/app-sidebar.tsx:254-259`:

```tsx
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Devices" render={<Link to="/devices" />}>
              <Icon icon={ComputerPhoneSyncIcon} />
              Devices
            </SidebarMenuButton>
          </SidebarMenuItem>
```

`apps/app/src/routes/devices.tsx` — B1 page. Unpaired: Card with
"Create pairing code" button and a "Have a code?" form (`Input` +
`Button "Pair"`, error line). Paired: Card listing this device + `status.peers`
rows (`peer.pageId ? "editing" : "online"`), a Card with "Show pairing code" →
`revealedPhrase` mono block + Copy, and "Unpair this device" → AlertDialog.
State: `phraseInput`, `phraseError`, `revealedPhrase`, `copied`, `confirmUnpair`.

Routes are file-based (TanStack Router, `apps/app/src/routes/*.tsx`);
`apps/app/src/routeTree.gen.ts` is generated — regenerate with
`cd apps/app && bun run generate-routes` after adding a route file.

Library facts (verified 2026-09-01 against the docs/types):

- **BlockNote 0.54** collaboration option: `provider?: { awareness?: Awareness }`
  (a plain object is accepted — verified in
  `@blocknote/core/types/src/yjs/extensions/index.d.ts`). Also
  `showCursorLabels?: "always" | "activity"`, `user: { name, color }`.
- **lean-qr** (install latest 2.x): `import { generate, correction } from "lean-qr"`;
  `import { toSvgSource } from "lean-qr/extras/svg"`;
  `toSvgSource(generate(text, { minCorrectionLevel: correction.M }), { on: "currentColor", off: "transparent", pad: 2, xmlDeclaration: false })`
  returns an `<svg>` string. Rendering that string with
  `dangerouslySetInnerHTML` is safe here — it is generated locally from our
  own data, never from user input.
- **qr-scanner** (nimiq, 1.4.x): `import QrScanner from "qr-scanner"`;
  `new QrScanner(videoEl, (result) => …, { returnDetailedScanResult: true, highlightScanRegion: true, preferredCamera: "environment" })`;
  `result.data` is the decoded string; `await scanner.start()`, `scanner.stop()`,
  `scanner.destroy()`; `await QrScanner.hasCamera()`. The `<video>` needs
  `playsInline muted`. Vite bundles its worker automatically. Camera needs a
  secure context — the dev server already serves https (basic-ssl).
- **Trystero** reminder: `onPeerJoin` etc. are settable properties (see 001 correction). Not touched here.

## Commands

Same table as plan 001. Add deps: `cd apps/app && bun add lean-qr qr-scanner`.
Test count baseline: 54 (`bun test` at repo root).

## Scope

**In scope** (only these):
- `apps/app/package.json` (deps) + root `bun.lock`
- `apps/app/src/lib/sync/pair-link.ts` (create) + `pair-link.test.ts`
- `apps/app/src/lib/sync/manager.ts` (add two exports; see Step 3)
- `apps/app/src/components/pair-qr.tsx` (create)
- `apps/app/src/components/qr-scan-dialog.tsx` (create)
- `apps/app/src/routes/pair.tsx` (create) + `apps/app/src/routeTree.gen.ts` (regenerated)
- `apps/app/src/routes/devices.tsx`
- `apps/app/src/routes/page.$pageId.tsx` (one effect line + cleanup)
- `apps/app/src/components/app-sidebar.tsx` (Devices row only)
- `apps/app/src/components/editor.tsx` (collaboration provider + user)

**Out of scope**: `packages/ui/**`; `secret.ts`, `multiplex.ts`, `presence.ts`,
`transport.ts`, `status.ts`; `nodes.ts`, `page-doc.ts`, `index-doc.ts`,
`schema.ts`; reconnect/visibility handling (B3); any new shadcn component
(STOP and name it if you think one is needed).

## Steps

### Step 1: deps
`cd apps/app && bun add lean-qr qr-scanner && cd .. && bun install`.
**Verify**: `bun run check` → 0 errors. Commit `chore: add lean-qr, qr-scanner`.

### Step 2: `pair-link.ts` — tests first

Exports:
```ts
export function buildPairLink(secret: Uint8Array, origin: string): string; // `${origin}/pair#s=${encodeSecret(secret)}`
export function parsePairInput(text: string): Result<Uint8Array, InvalidPairInputError>;
```
`parsePairInput` accepts, after `trim()`: (a) a full pair URL (any origin,
path `/pair`, hash `#s=<base64url>`), (b) a bare `#s=<base64url>` or
`s=<base64url>`, (c) a bare base64url secret of exactly 22 chars, (d) a
12-word phrase (delegate to `phraseToSecret`). Anything else → `Result.err`
of a new `InvalidPairInputError` (TaggedError, message
"That doesn't look like a pairing code or link."). Never throws.

`pair-link.test.ts` (model on `secret.test.ts`): round-trip link → secret;
each of (b) (c) (d) parse; wrong-origin URL still parses; `/pair?x=1#s=…`
parses; garbage → err with the tag `InvalidPairInputError`; a 16-byte
secret that decodes to the wrong length (e.g. 10 bytes base64url) → err.
Run → RED (module missing). Commit `test: pair link parsing spec`. Implement.
**Verify**: `bun test` → 0 fail, ≥ 61 tests. Commit `feat: pair links`.

### Step 3: manager exports for presence page + awareness

In `manager.ts` add to `SyncManager`: `setPage(pageId: string | null)` →
`this.presence?.setLocal({ pageId })`; `awareness(): Awareness | null` →
`this.presence?.awareness ?? null`. Module-level:
```ts
export function setPresencePage(pageId: string | null): void { currentManager?.setPage(pageId); }
export function getSyncAwareness(): Awareness | null { return currentManager?.awareness() ?? null; }
```
Import `type { Awareness } from "y-protocols/awareness"`.
**Verify**: `bun run check` → 0; `bun test` unchanged. Commit `feat: expose presence page + awareness`.

### Step 4: page route sets presence

In `page.$pageId.tsx` effect: add `setPresencePage(pageId);` after
`setInspectorPage(pageId);` and `setPresencePage(null);` in the cleanup
(keep `setInspectorPage(null)`). Import from `@/lib/sync/manager`.
**Verify**: `bun run check` → 0. Commit `feat: publish current page to presence`.

### Step 5: `pair-qr.tsx`

```tsx
export function PairQr({ secret, className }: { secret: Uint8Array; className?: string })
```
Renders `<div className={cn("aspect-square w-44 text-foreground [&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} aria-label="Pairing QR code" role="img" />`
where `svg = toSvgSource(generate(buildPairLink(secret, window.location.origin), { minCorrectionLevel: correction.M }), { on: "currentColor", off: "transparent", pad: 2, xmlDeclaration: false })`,
memoized with `useMemo` on `secret`. `currentColor` keeps it theme-correct.
**Verify**: `bun run check` → 0. Commit `feat: pairing QR`.

### Step 6: `qr-scan-dialog.tsx`

```tsx
export function QrScanDialog({ open, onOpenChange, onSecret }: { open: boolean; onOpenChange: (o: boolean) => void; onSecret: (secret: Uint8Array) => void })
```
shadcn `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle`
("Scan pairing code") / `DialogDescription` ("Point the camera at the QR on
your other device."). Body: `<video ref playsInline muted className="aspect-square w-full rounded-2xl bg-muted object-cover" />`.
Effect on `open`: `QrScanner.hasCamera()` → if false set a message state
"No camera found on this device." Else create
`new QrScanner(video, ({ data }) => { const r = parsePairInput(data); if (r.isOk()) { scanner.stop(); onSecret(r.value); onOpenChange(false); } }, { returnDetailedScanResult: true, highlightScanRegion: true, preferredCamera: "environment" })`,
`await scanner.start()` in try/catch → on error set message
"Camera access was denied. Allow it in your browser settings and try again."
Cleanup on close/unmount: `scanner.stop(); scanner.destroy()`. Render the
message under the video in `text-destructive text-small` when set.
**Verify**: `bun run check` → 0. Commit `feat: in-app QR scanner`.

### Step 7: `/pair` route

`apps/app/src/routes/pair.tsx`, `createFileRoute("/pair")`. On mount read
`window.location.hash` and `parsePairInput(window.location.hash)`. Layout
= same `ScrollArea` + `max-w-2xl` column as Devices, `h1` "Pair this device".
- Parsed ok: Card. If `useSyncStatus().paired` already → description
  "This device is already paired. Pairing again replaces that." Buttons:
  primary "Pair this device" → `await pairWithSecret(secret)` →
  `navigate({ to: "/devices" })`; ghost "Cancel" → navigate to `/devices`.
- Parse failed: Card "This link isn't a pairing code." + Button "Go to Devices".
Then `cd apps/app && bun run generate-routes`.
**Verify**: `bun run check` → 0; `git status` shows `routeTree.gen.ts` changed. Commit `feat: /pair link route`.

### Step 8: Devices page upgrades

In `devices.tsx`:
1. Replace `phraseToSecret(phraseInput)` with `parsePairInput(phraseInput)`;
   placeholder "twelve words or a pairing link".
2. Unpaired card: next to the Pair button add `Button variant="outline"`
   "Scan" that opens `QrScanDialog`; `onSecret` → `pairWithSecret`.
3. Paired "Show pairing code": render `<PairQr secret={…} />` above the word
   block (need the raw secret: keep `revealedSecret: Uint8Array | null`
   state instead of only the phrase; derive the phrase with `secretToPhrase`).
   Add a second small button "Copy link" → `navigator.clipboard.writeText(buildPairLink(secret, window.location.origin))`.
   Word block: render the 12 words as a 3-column grid, each word prefixed by its
   1-based index in `text-muted-foreground` (`grid grid-cols-3 gap-x-5 gap-y-1.5 font-mono text-small tabular-nums`).
4. Peer rows: look up `peer.pageId` in `useNodes()`; show
   `editing <title or "Untitled">` when found, `editing` when the page is
   unknown locally, `online` when `pageId` is null. Title in `text-foreground`,
   the word "editing" muted.
**Verify**: `bun run check` → 0; `bun run build` ok. Commit `feat: Devices — QR, scan, link, live page titles`.

### Step 9: sidebar "N online"

In the Devices `SidebarMenuItem`: `const { peers } = useSyncStatus();` (hook
call must be at `AppSidebar` top level). When `peers.length > 0` append
`<span className="ml-auto font-mono text-tiny text-muted-foreground group-data-[collapsible=icon]:hidden">{peers.length} online</span>`
inside the button after the label, and make the tooltip
`peers.length > 0 ? \`Devices · ${peers.length} online\` : "Devices"`.
**Verify**: `bun run check` → 0. Commit `feat: sidebar shows devices online`.

### Step 10: editor cursors (skip hatch)

In `editor.tsx`: `const awareness = getSyncAwareness();` inside `BoundEditor`
before `useCreateBlockNote`; pass
`provider: awareness ? { awareness } : undefined`,
`user: { name: getDeviceName(), color: "#737373" }`, `showCursorLabels: "activity"`.
Keep `[doc]` deps. Note in a comment: awareness is shared across pages; the
cursor plugin only renders positions that resolve inside this page's doc.
**Verify**: `bun run check` → 0; `bun run build` ok. Commit `feat: remote cursors via shared awareness`.
**Skip hatch**: if `bun run check` fails on the collaboration types in a way
that needs a cast to `any`/`never`, do NOT cast — revert this step's edit,
commit nothing for it, and report it under NOTES.

## Done criteria

- [ ] `bun run check` → 0 warnings, 0 errors ×2
- [ ] `bun test` → 0 fail, ≥ 61 tests
- [ ] `bun run build` ok
- [ ] `grep -rn "dangerouslySetInnerHTML" apps/app/src` matches only `pair-qr.tsx`
- [ ] `grep -rn "phraseToSecret" apps/app/src/routes` → no matches (Devices uses `parsePairInput`)
- [ ] `git diff --stat 835e631..HEAD` lists only in-scope files; `git status` clean
- [ ] Manual (reviewer): Mac shows QR; phone scans in-app → paired; sidebar "1 online"; Devices shows "editing <title>"; link opened in a fresh browser lands on /pair and pairs.

## STOP conditions

- "Current state" excerpts don't match live code.
- A step needs `packages/ui/**` or an out-of-scope sync/lib file.
- `qr-scanner` fails to import or type-check under Vite/TS (report the error; do not vendor a worker).
- A test must be weakened to pass.

## Maintenance notes

- Pair link format `/pair#s=<base64url>` is now a compatibility surface with
  any QR printed or link shared; version it before changing.
- B3: visibility/reconnect, 3-device hardening, cursor colors per device.
