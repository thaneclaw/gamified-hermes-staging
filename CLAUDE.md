# CLAUDE.md

You are working on **Gamified** — a podcast overlay system for a weekly video gameshow run on VDO.Ninja + OBS. This file is loaded at the start of every Claude Code session. Read it fully before doing anything else.

## What this project is

A real-time gamification layer for an existing live-to-tape podcast. Six rotating guests debate gaming topics across themed rounds. The producer (the user you're talking to) runs the show through OBS. The host moderates. An editor records a backup.

This project does **not** replace the existing OBS + VDO.Ninja setup. It adds three things on top:

1. A **guest wrapper page** that iframes VDO.Ninja and surrounds it with reaction buttons + cards
2. A **transparent OBS overlay** that animates emojis and card effects on top of the producer's existing scenes
3. A **producer panel** (dockable inside OBS) for setting roster names, resetting cards, and calibrating tile positions

All three are static pages served from Cloudflare Pages. There is no server. Real-time signaling rides VDO.Ninja's existing P2P data channels.

## Why architecture choices were made (don't second-guess these)

- **No backend server.** Earlier the project used Socket.IO + Fly.io. We removed it. Real-time events ride VDO.Ninja's `sendData` API (P2P data channels) instead. Adding a server later is allowed if state persistence becomes necessary, but only after explicit discussion. Default: stateless.
- **Wrapper iframes VDO.Ninja, doesn't replace it.** Guest cameras still publish through VDO.Ninja's existing infrastructure with the user's existing push IDs and room. The wrapper is chrome around an iframe — it does **not** create new peer connections, does **not** capture video itself, does **not** handle WebRTC. Conserving guest upload bandwidth is the highest priority constraint of the entire show.
- **One overlay browser source, nested as a scene.** The user has 8 OBS scenes. The overlay lives in a dedicated `_Overlay` scene, added as a nested scene source on top of every other scene. This means one peer connection, one render context, no scene-switch reconnects.
- **Producer's Virtual Camera is what guests see.** Guests do not receive each other's video directly (`roombitrate=0`). They view the producer's composited stream via `view=TBSqrdw`. This means animations only need to render in the producer's OBS — they automatically reach all guests through the existing video pipe.

## Tech stack

- **Frontend framework:** React + Vite + TypeScript (inherited from forked repo, kept)
- **Routing:** React Router (already in repo)
- **Styling:** keep whatever the existing repo uses; do not introduce new CSS frameworks
- **Real-time transport:** VDO.Ninja IFRAME API (`postMessage` to/from the iframe; `sendData` for P2P broadcasts)
- **State:** local component state + `localStorage` for per-guest persistence (card counters, roster names). No global store needed for MVP.
- **Hosting:** Cloudflare Pages, auto-deploy from GitHub. Free `*.pages.dev` subdomain for MVP.
- **Branches:** `main` = production, `staging` = pre-production validation, feature branches = preview URLs.

## Repo conventions

- All new code lives under `src/` following the existing structure
- New routes go in `src/routes/`
- Tile coordinate config: `src/coords.ts` (NEW — replaces `src/slots.ts`)
- VDO.Ninja iframe wrapper logic: `src/lib/vdoninja.ts` (NEW)
- Card definitions: `src/cards.ts` (already exists, will be modified)
- Emoji set: `src/emojis.ts` (NEW)
- The legacy server/, plus old routes (LoginRoute, ProducerRoute, HostRoute, OverlayRoute, ContestantRoute) can be **deleted** — they were Socket.IO based and we are not migrating them. Strip them out cleanly rather than leaving dead code.
- Do not introduce new dependencies without justifying it in the PR description.

## Hard rules

1. **Never add VDO.Ninja peer connections beyond what already exists.** Each guest publishes once. The wrapper iframes their existing publish URL.
2. **Never write text inside the center 44% of the 1920×1080 overlay canvas** unless explicitly asked — that area is reserved for the producer's existing topic graphics in OBS scenes.
3. **Never use `localStorage` for shared state** — it's per-browser. Use it only for per-guest preferences (card counters, panel collapse state).
4. **Never write to or assume access to a server.** This is a static site.
5. **Never break the legacy chat path.** The wrapper preserves VDO.Ninja's built-in chat inside the iframe (Option A). Do not strip iframe chrome that affects chat visibility.
6. **No emoji in code comments or UI text** — emoji are content, rendered via the configured set in `src/emojis.ts`. Do not hardcode emoji elsewhere.
7. **Preserve the user's existing OBS scene structure.** This project adds one nested scene (`_Overlay`); it does not modify the eight existing episode scenes' layouts.

## Build workflow

For every change:
1. Create a feature branch from `staging` (`git checkout -b feat/<short-name>`)
2. Implement the change
3. Run the build (`npm run build`) — must pass
4. Commit with a short imperative subject + body explaining the why
5. Push the branch
6. Open PR targeting `staging`
7. Wait for the user to test the Cloudflare Pages preview URL
8. After user approval, the user merges to `staging`
9. Once a feature is verified on staging, the user merges `staging` → `main`

You can do everything up through opening the PR autonomously. The user is the merge gate.

## Tile coordinates (1920×1080 canvas)

Final measured values from the user's OBS scenes. Use these as defaults in `src/coords.ts`:

```ts
export const TILES = {
  L1: { x: 94,   y: 53,  w: 280, h: 280 }, // top-left      — Guest 1 (Tony)
  L2: { x: 94,   y: 382, w: 280, h: 280 }, // middle-left   — Guest 2 (Gnoc)
  L3: { x: 94,   y: 717, w: 280, h: 280 }, // bottom-left   — Guest 3 (Matthew)
  R1: { x: 1544, y: 53,  w: 280, h: 280 }, // top-right     — Guest 4 (Chris)
  R2: { x: 1545, y: 385, w: 280, h: 280 }, // middle-right  — Guest 5 (Kohji)
  R3: { x: 1544, y: 719, w: 280, h: 280 }, // bottom-right  — Guest 6 (Wills)
};
```

Calibration mode (producer panel toggles `?calibrate=1` on overlay) lets these be visually adjusted without code changes; adjustments persist via `localStorage` on the overlay browser source's machine.

## Current status

- [x] Phase 1: Repo cleanup — delete legacy Socket.IO server, delete unused routes
- [x] Phase 2: Coordinate map + emoji/card config files
- [x] Phase 3: VDO.Ninja iframe wrapper library (`src/lib/vdoninja.ts`)
- [x] Phase 4: `/play` wrapper route — iframe + emoji panel + card panel
- [x] Phase 5: `/overlay` route — transparent, listens for events, animates
- [x] Phase 6: `/producer` route — roster names, reset cards, calibration mode
- [x] Phase 7: Cloudflare Pages deploy + custom domain config

Update this checklist as phases complete. Keep it honest — if something's half-done, mark it half-done.

## Communication style

The user is technical but not a software engineer. Explain choices with one-sentence rationales when helpful, but don't lecture. Show diffs for meaningful changes. When something is genuinely ambiguous, ask before guessing — the user prefers a brief question over the wrong implementation.
