# Game Show Control Deck

Interactive layer for a live OBS + VDO Ninja game show.

Four clients share one piece of state:

| Route | Audience | Role |
| --- | --- | --- |
| `/` | dev | all four clients side-by-side (useful while iterating) |
| `/producer` | pre-show author | rundown + contestant roster editor |
| `/host` | live moderator | trigger rounds, reset buzzer, force card effects |
| `/contestant?id=<a\|b\|c\|d\|e\|f>` | phone-per-player | mode-specific controls + cards + reactions |
| `/overlay` | OBS browser source | transparent composite drawn over VDO Ninja feeds |

## Status — Phase 1

This is the post-artifact refactor: the monolithic Claude.ai prototype has been split into
real files, typed with TypeScript, and backed by a Zustand store that stands in for the
eventual websocket server.

- ✅ all four routes render
- ✅ full state + every demo action (buzz, RLGL, typed-buzz, vote-anim, hidden-answer, cards, reactions)
- ✅ 6 modes and 4 cards, same behavior as the artifact
- ⛔ no server — state resets on refresh, and separate tabs do not sync

Phases 2 and 3 (Node + Socket.IO server, wiring clients to it) are intentionally out of scope
for this commit. The Zustand action names were chosen to match the future socket event
schema — `buzz`, `roundTrigger`, `castVote`, `cardFire`, etc. — so Phase 3 should be
mostly a find-and-replace of store internals with `socket.emit`.

## Scripts

```
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview    # serve the production build
```

## Where the source lives

```
src/
├── modes.ts             # 6 game modes (buzz, redlight, word, bullish, market, sentence)
├── cards.ts             # 4 cards (interrupt, quickdebate, doublepoints, wildcard)
├── slots.ts             # pixel-measured tile positions on the studio backdrop
├── state/
│   ├── types.ts         # Contestant, Round, VoteRecord, ActiveEffect, …
│   ├── store.ts         # Zustand store — state + actions (future socket events)
│   └── effects.ts       # useGameEffects() — drives the quickdebate ping-pong timer
├── routes/              # thin route wrappers (DevSplitScreen, Host, Producer, Contestant, Overlay)
└── components/
    ├── shared/          # AppHeader, SectionLabel, EventLog, DeploymentGuide
    ├── overlay/         # OverlayPreview (the 1654×936 composite) + RLGLCenterTile
    ├── contestant/      # ContestantPhone + mode-specific inputs
    ├── host/            # HostPanel, RoundsPanel, SubmissionsPanel
    └── producer/        # ProducerView, ContestantEditor, ProducerRoundCard
```

`public/backdrop.jpg` is the studio photo for the OBS overlay. It's a static
asset referenced by the overlay route at `/backdrop.jpg`.

The original Claude.ai artifact and the handoff doc are preserved in
`_handoff/` for reference.

## OBS setup (once you're ready)

1. Add a **Browser Source** pointing at `http://<dev-host>/overlay`
2. Size: 1920×1080
3. Shut off custom CSS — the route already sets the body background
   to transparent via `body.overlay-route`.
4. Layer it on top of the VDO Ninja video tiles.
