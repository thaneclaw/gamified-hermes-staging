# Game Show Control Deck — Handoff to Claude Code

I've been prototyping this in a Claude.ai artifact and we've hit the limit
of what that format can do. I'm moving it into a real project. Everything
below is context for you so we can pick up where the artifact left off.

## What the system is

An interactive layer for a live game show built on OBS + VDO Ninja.
VDO Ninja pipes contestants' video into OBS; this project adds
buzz-in, emoji reactions, mode-based rounds, and a card system for
"twists" (interrupt, quick debate, etc.) that show up as overlays on
the stream.

There are FOUR distinct clients that all talk to one shared state:

1. **Producer** (`/producer`) — pre-show. Authors the round rundown
   (title, topic, mode per round). Edits contestant names. Read-write.
2. **Host** (`/host`) — live during the show. Triggers each round,
   closes rounds, resets buzzer, manages debate on/off, plays cards
   on contestants' behalf, reveals hidden answers. Read-write.
3. **Contestant** (`/contestant?id=<alex|sam|...>`) — one per phone.
   Shows STANDBY until host opens a round, then displays controls
   appropriate to that round's mode (BUZZ / GREEN+RED / text input /
   two-option vote / lock-in-then-reveal). Plus emoji reactions and
   their remaining cards. Scoped read-write.
4. **Overlay** (`/overlay`) — transparent browser source for OBS.
   Renders the composited layer on top of VDO Ninja's video feeds:
   per-tile highlights, buzz pulses, card effects, lower-third topic
   banner, RLGL tally. Read-only.

The shared state lives on a small Node + Socket.IO server. All clients
subscribe to it; host/producer/contestant emit actions; server
broadcasts new state.

## What already exists

The attached `game_show_demo.jsx` file (~3500 lines) is the working
single-page demo with all four clients visible side-by-side. Every
behavior below is implemented and working in the demo — our job is
to split it into real files and wire the server.

### Modes registry (MODES object, top of file)
- `buzz` — first to press BUZZ wins
- `redlight` — GREEN or RED position + debate toggle
- `word` — type word to buzz (typed-buzz primary)
- `bullish` — BULLISH / BULLSHIT two-button vote (vote-anim primary)
- `market` — BUY / SELL two-button vote (vote-anim primary)
- `sentence` — lock in hidden answer, reveal on cue (hidden-answer primary)

Each mode has `{name, icon, color, description, primary}`. Adding a new
mode is one entry. The contestant UI dispatches on `MODES[mode].primary`.

### Cards (CARDS object)
- `interrupt` ("SHUT THE !@#$ UP!!") — dims target tile, shows SHH!,
  fires a screen-shake. 2 uses.
- `quickdebate` — outlines two tiles, ping-pongs glow, VS center. 1 use.
- `doublepoints` — 2X overlay. 1 use.
- `wildcard` — rainbow conic spin + emoji burst. 1 use.

### State shape (see `GameShowDemo` function)
```
contestants: [{id, name, color, slot, cards:{...}}]  — 6 total
rounds: [{id, title, topic, mode, phase}]            — phase: pending|live|closed
activeRoundId: string|null
buzzer: {contestantId, t} | null
positions: {[id]: "green"|"red"}
votes: {[id]: {kind, value, t}}                      — kind dispatched on mode.primary
revealed: {[id]: true}
voteAnimSeq: {[id]: tick}                            — re-fires tile animations
debateActive: bool
activeEffect: {type, by, target?, t, duration} | null
reactions: [{id, emoji, contestantId, t}]
eventLog: [{id, text, color, time}]
```

### Overlay layout
The OBS backdrop is a studio photo with 6 black rectangles (contestant
slots) + 1 big center rectangle. Exact positions are in a `SLOTS`
constant (pixel-measured percentages). The overlay draws transparent
tiles at those positions and composites effects on top.

### Design language
- Anton for display, JetBrains Mono for UI text
- Neon accents on near-black (each contestant has a distinct color)
- Chunky borders + offset shadows (`4px 4px 0 <color>`)
- Keyframes live at bottom of the file: slamIn, buzzPulse, buzzRing,
  arrowUp, arrowDown, shake, flashOnce, flashRed, floatUp, pulseDot,
  pulseGlow, spin

## What we're building next

### Phase 1 — Project scaffolding
- Vite + React + TypeScript (or keep JS if you prefer — ask me)
- Tailwind already in use via classes, keep it
- Split the monolith file into: `src/modes.ts`, `src/cards.ts`,
  `src/state/types.ts`, `src/components/overlay/`,
  `src/components/contestant/`, `src/components/host/`,
  `src/components/producer/`, `src/routes/`
- React Router for the four client URLs

### Phase 2 — Server
- Node + Socket.IO, single source of truth for game state
- Event schema mirroring the demo's actions: `round:trigger`,
  `round:close`, `buzz`, `position:take`, `vote:cast`, `answer:submit`,
  `answer:reveal`, `card:play`, `reaction:send`, `contestant:rename`, etc.
- Host-only actions gated (simple shared secret env var is fine for now)

### Phase 3 — Real wiring
- Each client subscribes to state via socket
- Actions flow: client emit → server validates → server broadcasts state
- Contestant auth: each phone gets a URL with their `?id=` — no passwords needed
- OBS browser source: make `body { background: transparent }` for the
  overlay route so it composites cleanly

## First steps

1. Read through `game_show_demo.jsx` end to end
2. Propose a file structure before writing any code
3. Ask me about TS vs JS and anything else ambiguous
4. Scaffold the Vite project and split the demo into files — don't
   wire the server yet. I want to see the split compile and run the
   four routes locally (with a shared React context or Zustand store
   standing in for the websocket) before we add networking.
