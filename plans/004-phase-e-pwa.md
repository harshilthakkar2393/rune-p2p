# Plan 004: PWA — service worker, persistent storage, update prompt, install hint

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before moving on. Touch only
> in-scope files. On any STOP condition, stop and report. Commit per step
> group (conventional commits, NO trailers). Do not edit `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ce85570..HEAD -- apps/app/vite.config.ts apps/app/index.html apps/app/public apps/app/src/routes/__root.tsx apps/app/src/routes/devices.tsx apps/app/src/hooks/use-index.ts apps/app/src/lib`
> Any change → compare "Current state" excerpts; mismatch = STOP.

## Status

- **Priority** P1 · **Effort** M · **Risk** MED (service workers are easy to get subtly wrong; keep it to the plugin's defaults)
- **Depends on**: plans/001–003 (DONE)
- **Planned at**: commit `ce85570`, 2026-09-02

## Why this matters

rune is local-first, but on a phone it is still a Safari tab: no offline
shell, and Safari can evict IndexedDB for a tab after 7 days of disuse.
Installing it as a PWA with a service worker and persistent storage removes
both risks and gives the app its own icon and window. This plan adds the
service worker, asks for persistent storage, shows the result, prompts on
updates instead of swapping code under an open editor, and offers install
where the platform allows a prompt.

## Current state (verified at `ce85570`)

Read `plans/001-phase-b1-sync-core.md` "Current state / Commands / Conventions"
first. Bun only. `packages/ui/**` never edited. Format single files with
`cd apps/app && bunx oxfmt <file>`; never root `bun run format`. Only shadcn
components from `@rune/ui/components/*` (Button, Card, Badge, Empty exist).

- `apps/app/vite.config.ts` — plugins: `basicSsl()`, `devtools()`,
  `tailwindcss()`, `tanstackRouter(...)`, `viteReact()`; `server: { host: true }`.
- `apps/app/index.html` head:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Rune</title>
  <meta name="theme-color" content="#000000" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  ```
- `apps/app/public/manifest.webmanifest` — name/short_name "Rune",
  `start_url: "/"`, `display: "standalone"`, background/theme `#000000`,
  icons 192, 512, maskable 512. `apps/app/public/` also has `favicon.svg`,
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`.
- `apps/app/src/routes/__root.tsx` — `RootComponent` renders
  `<ThemeProvider><HeadContent/><TooltipProvider>…<SidebarProvider>…<InspectorSlot/>{isMobile && <MobileDock/>}</SidebarProvider></TooltipProvider><SearchPalette/><Shortcuts/>…`.
- `apps/app/src/hooks/use-index.ts` `start()` runs once at boot:
  `initIndexPersistence().then(() => { purgeExpired…; ensureDefaultFolder; adoptOrphanPages; importLegacyRecents(getRecentsMap()); startSyncIfPaired(); })`.
- `apps/app/src/routes/devices.tsx` — `DevicesView`: `<ScrollArea><main className="mx-auto w-full max-w-2xl px-4 md:px-8 pt-3 pb-6"><h1 className="text-h1">Devices</h1> … cards … <AlertDialog/> <QrScanDialog/></main></ScrollArea>`.
- Store pattern for module state + React: `apps/app/src/lib/sync/status.ts` (`setX`, `useX` via `useSyncExternalStore`). Copy it.
- Tests: `bun:test`, e.g. `apps/app/src/lib/sync/backoff.test.ts` for a pure-module pattern.

Library facts (verified 2026-09-02):
- `vite-plugin-pwa@1.3.0`, peer `vite ^8` ok. `import { VitePWA } from "vite-plugin-pwa"`.
  Options used here: `registerType: "prompt"` (we show our own prompt),
  `manifest: false` (keep our static `manifest.webmanifest`; the plugin then
  injects no manifest link — ours is already in index.html),
  `includeAssets: ["favicon.svg", "apple-touch-icon.png"]`,
  `workbox: { navigateFallback: "/index.html", globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"], navigateFallbackDenylist: [/^\/api\//] }`,
  `devOptions: { enabled: false }` (SW off in dev; HMR + https on phone stay simple).
- React hook: `import { useRegisterSW } from "virtual:pwa-register/react"` →
  `{ needRefresh: [boolean, setter], offlineReady: [boolean, setter], updateServiceWorker(reloadPage?: boolean) }`.
  Types: add `/// <reference types="vite-plugin-pwa/react" />` to
  `apps/app/src/vite-env.d.ts` (create if missing) — check `tsconfig`
  `types` already lists `vite/client`; keep that.
- `navigator.storage.persist()` → `Promise<boolean>`; `navigator.storage.persisted()`;
  both may be undefined (older Safari, insecure context) — feature-detect.
  On iOS, `persist()` resolves true only for installed PWAs / after
  engagement; treat `false` as "not yet", not an error.
- Install prompt: Chromium fires `beforeinstallprompt` on `window`; call
  `event.preventDefault()`, keep it, later `event.prompt()`. iOS has none;
  detect standalone via `window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true`.

## Scope

**In scope**:
- `apps/app/package.json` (+ `vite-plugin-pwa` devDependency) + root `bun.lock`
- `apps/app/vite.config.ts`
- `apps/app/index.html` (meta tags only)
- `apps/app/src/vite-env.d.ts` (create or extend)
- `apps/app/src/lib/pwa.ts` (create) + `pwa.test.ts`
- `apps/app/src/components/update-prompt.tsx` (create)
- `apps/app/src/routes/__root.tsx` (mount UpdatePrompt)
- `apps/app/src/hooks/use-index.ts` (call `requestPersistentStorage()` once)
- `apps/app/src/routes/devices.tsx` (add one "This device" storage/install card)

**Out of scope**: `packages/ui/**`; anything under `lib/sync/`; manifest
icons (done); push notifications; background sync; caching of relay/WebRTC
traffic (not cacheable); a custom service worker file (use generateSW).

## Steps

### Step 1: dependency + Vite config
`cd apps/app && bun add -d vite-plugin-pwa && cd .. && bun install`.
Add `VitePWA({...})` (options above) as the LAST plugin in `vite.config.ts`.
**Verify**: `bun run build` → output lists `dist/sw.js` and `dist/workbox-*.js`
and the summary line "PWA v1.3.0 … precache N entries". Commit `chore: vite-plugin-pwa`.

### Step 2: `lib/pwa.ts` — tests first

Pure-ish module with a store (copy `status.ts` shape):
```ts
export type PwaStatus = {
  persisted: boolean | null;   // null = unknown / unsupported
  standalone: boolean;         // running as installed app
  canInstall: boolean;         // a deferred beforeinstallprompt is held
  offlineReady: boolean;
  needRefresh: boolean;
};
export function usePwaStatus(): PwaStatus;
export function setPwaStatus(patch: Partial<PwaStatus>): void;
export function isStandalone(win?: { matchMedia?: (q: string) => { matches: boolean }; navigator?: { standalone?: boolean } }): boolean;
export function requestPersistentStorage(storage?: { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> } | null): Promise<boolean | null>;
export function captureInstallPrompt(win?: Window): () => void;  // installs beforeinstallprompt listener, sets canInstall, returns uninstall
export function promptInstall(): Promise<boolean>;                // uses the deferred event; resolves accepted?; clears canInstall
```
`requestPersistentStorage`: if no API → set `persisted: null`, return null;
else `persisted()` first; if true → true; else `persist()` → result; store it.
Never throws.

Tests (`pwa.test.ts`, inject fakes, no DOM):
1. `isStandalone` true for `matchMedia` match, true for `navigator.standalone === true`, false otherwise, false when `win` lacks both.
2. `requestPersistentStorage(null)` → null and status `persisted: null`.
3. Already persisted → true without calling `persist`.
4. Not persisted → calls `persist`, returns its result, status updated.
5. `persist` rejecting → resolves null, no throw.
6. `promptInstall()` with no captured event → false.
RED → commit `test: pwa status spec` → implement → GREEN → commit `feat: pwa status store`.

### Step 3: boot wiring
`use-index.ts` `start()`: after `importLegacyRecents(...)` add `void requestPersistentStorage();`.
`__root.tsx` `RootComponent`: `useEffect(() => captureInstallPrompt(), [])` and set
`standalone` once: `useEffect(() => setPwaStatus({ standalone: isStandalone(window) }), [])`.
**Verify**: `bun run check` → 0. Commit `feat: request persistent storage, capture install prompt`.

### Step 4: `update-prompt.tsx`
Uses `useRegisterSW({ onOfflineReady() { setPwaStatus({ offlineReady: true }) }, onNeedRefresh() { setPwaStatus({ needRefresh: true }) } })`.
Renders nothing unless `needRefresh`. When set: a fixed bottom-center pill
(reuse the SelectionBar look: `rounded-full border bg-popover py-1 pr-1 pl-4 shadow-lg`,
above the phone dock: `bottom-24 md:bottom-6`, `z-50`) with text "Update ready"
(`text-sm`) and a `Button size="sm" className="rounded-full"` "Reload" →
`updateServiceWorker(true)`, plus a ghost "Later" that hides it for the session.
Mount `<UpdatePrompt />` in `__root.tsx` next to `<SearchPalette />`.
Import must be guarded for SSR-less SPA: fine as-is (client only).
**Verify**: `bun run check` → 0; `bun run build` ok. Commit `feat: update-ready prompt`.

### Step 5: Devices "This device" card
At the end of the column in `devices.tsx` (after both branches, before dialogs)
add a `Card className="p-6"` titled "This device" (`text-h3`) with three rows
(`flex items-center justify-between text-sm`):
- **Installed** — `standalone ? <Badge variant="secondary">app</Badge> : canInstall ? <Button size="sm" onClick={() => void promptInstall()}>Install</Button> : <span className="text-small text-muted-foreground">{isIOS ? "Share → Add to Home Screen" : "Open in a browser that supports install"}</span>`
  where `isIOS = /iPhone|iPad/.test(navigator.userAgent)` computed in the component.
- **Storage** — `persisted === true ? "persistent" : persisted === false ? "not yet persistent" : "unknown"`, mono `text-tiny text-muted-foreground`; when `false` add a second line `text-small text-muted-foreground` "Install the app to keep notes safe from browser cleanup." (iOS) / "Grant persistent storage when asked." (others).
- **Offline** — `offlineReady ? "ready" : "after first load"`.
**Verify**: `bun run check` → 0; `bun run build` ok. Commit `feat: Devices shows install, storage and offline state`.

### Step 6: head meta
`index.html`: add after theme-color:
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Rune" />
```
**Verify**: `bun run build` ok. Commit `chore: standalone web-app meta`.

## Done criteria
- [ ] `bun run check` → 0 ×2 · `bun test` → 0 fail, ≥ 89 + 6 · `bun run build` prints the PWA precache line and emits `dist/sw.js`
- [ ] `grep -n "registerType" apps/app/vite.config.ts` → `"prompt"`
- [ ] `grep -n "manifest: false" apps/app/vite.config.ts` → match (static manifest kept)
- [ ] `git diff --stat ce85570..HEAD` only in-scope files; `git status` clean
- [ ] Manual (reviewer): `bun run build && cd apps/app && bunx vite preview --host` → open https://<ip>:4173 on the phone, Add to Home Screen shows the ᚱ icon, app opens standalone, airplane mode → app still loads, Devices shows storage persistent.

## STOP conditions
- Excerpts drift. · Plugin fails to build under Vite 8 (report the error; do not downgrade Vite). · `virtual:pwa-register/react` types unresolved after the reference directive (report). · Any out-of-scope edit needed. · A test must be weakened.

## Maintenance notes
- `registerType: "prompt"` means users control reloads; do not switch to `autoUpdate` — Yjs persists every keystroke, but a reload mid-edit still loses caret/scroll.
- The static manifest and the plugin's `manifest: false` must stay in sync by hand; icons live in `public/`.
- Dev server never runs the SW; test PWA behaviour on `vite preview` or a deploy.
