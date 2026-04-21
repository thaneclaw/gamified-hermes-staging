import {
  CARDS,
  DEFAULT_BIGGER_DEAL_CHOICES,
  DEFAULT_PLAY_CHOICES,
  HOST_COLOR,
  MODES,
  PLAY_MAX_CHOICES,
  PLAY_MIN_CHOICES,
  PRODUCER_COLOR,
  type CardKey,
  type ModeKey,
} from "./constants.ts";
import {
  clearSettings,
  loadLayout,
  loadSettings,
  scheduleLayoutSave,
  scheduleSave,
} from "./persist.ts";
import {
  DEFAULT_LAYOUT,
  freshCards,
  seedCardMaxes,
  seedContestants,
  seedRounds,
  seedState,
} from "./seed.ts";
import type {
  ChatRole,
  GameSnapshot,
  Layout,
  Position,
  Round,
} from "./types.ts";

// ── Authoritative state ─────────────────────────────────────────────────
// Everything that's shared across clients lives here. Subscribers fire
// every time any action mutates the snapshot.

let state: GameSnapshot = seedState();

type Listener = (next: GameSnapshot) => void;
const listeners = new Set<Listener>();

export function getSnapshot(): GameSnapshot {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function broadcast() {
  for (const listener of listeners) listener(state);
  // Persist producer-authored config on every state change. Rundown +
  // roster + card allotment + timer duration live in settings.json; the
  // overlay layout lives in its own file so it survives a "reset all".
  // Both writes are debounced inside persist.ts, so rapid bursts (e.g.
  // dragging a layout slider or stepping a card counter) coalesce into
  // a single disk write.
  scheduleSave({
    version: 3,
    rounds: state.rounds,
    contestants: state.contestants,
    cardMaxes: state.cardMaxes,
    timerDurationMs: state.timerDurationMs,
  });
  scheduleLayoutSave(state.layout);
}

// Called once at server bootstrap. If a previous session left a saved
// settings file, restore the rundown and contestant roster — but reset
// any in-progress show state (round phases, card usage) because those
// only make sense while a show is live.
export async function initState(): Promise<void> {
  const persisted = await loadSettings();
  const persistedLayout = await loadLayout();

  if (persisted) {
    // Apply cardMaxes first so the freshCards() call below hands every
    // contestant a deck that reflects the persisted per-player allotment
    // rather than the default seed. Missing persisted keys (older files,
    // or a newly-added card) fall back to the seed value.
    const mergedCardMaxes = persisted.cardMaxes
      ? { ...state.cardMaxes, ...persisted.cardMaxes }
      : state.cardMaxes;
    state = {
      ...state,
      cardMaxes: mergedCardMaxes,
      rounds: persisted.rounds.map((r) => ({ ...r, phase: "pending" as const })),
      contestants: persisted.contestants.map((c) => ({
        ...c,
        cards: freshCards(mergedCardMaxes),
      })),
      // Restore the producer-tuned countdown preset so e.g. a 90s default
      // sticks across server restarts. Clamp to the same [5s, 10m] window
      // used by timerDurationSet below so a malformed file can't seed a
      // nonsense value.
      timerDurationMs:
        typeof persisted.timerDurationMs === "number"
          ? Math.max(5_000, Math.min(600_000, persisted.timerDurationMs))
          : state.timerDurationMs,
    };
  }

  // Prefer the standalone layout file. Fall back to the legacy inline v2
  // layout in settings.json (one-time migration — next broadcast will
  // write it back to layout.json so settings.json can drop it). Merge
  // onto DEFAULT_LAYOUT so older files without newer fields (tileScale,
  // tileCornerRadius, …) pick up the current defaults instead of turning
  // those numbers into `undefined`.
  const loaded = persistedLayout ?? persisted?.layout;
  const layout = loaded ? { ...DEFAULT_LAYOUT, ...loaded } : null;
  if (layout) {
    state = { ...state, layout };
  }

  const rounds = persisted?.rounds.length ?? 0;
  const contestants = persisted?.contestants.length ?? state.contestants.length;
  console.log(
    `[state] restored ${rounds} rounds + ${contestants} contestants${layout ? " + layout" : ""} from disk`,
  );
}

function set(patch: Partial<GameSnapshot>) {
  state = { ...state, ...patch };
  broadcast();
}

function log(text: string, color = "#f0f0f0") {
  state = {
    ...state,
    eventLog: [
      { id: Date.now() + Math.random(), text, color, time: Date.now() },
      ...state.eventLog,
    ].slice(0, 20),
  };
  // broadcast once per action — callers do that; log() only updates state
}

function activeMode(): ModeKey {
  return state.rounds.find((r) => r.id === state.activeRoundId)?.mode ?? "buzz";
}

// Timer bookkeeping — these are server-owned so all clients see effects
// expire at the same wall-clock moment.
let activeEffectTimer: NodeJS.Timeout | null = null;
let debateTickTimer: NodeJS.Timeout | null = null;

function clearTimers() {
  if (activeEffectTimer) {
    clearTimeout(activeEffectTimer);
    activeEffectTimer = null;
  }
  if (debateTickTimer) {
    clearInterval(debateTickTimer);
    debateTickTimer = null;
  }
}

function scheduleEffectClear(duration: number) {
  if (activeEffectTimer) clearTimeout(activeEffectTimer);
  activeEffectTimer = setTimeout(() => {
    activeEffectTimer = null;
    if (debateTickTimer) {
      clearInterval(debateTickTimer);
      debateTickTimer = null;
    }
    set({ activeEffect: null });
  }, duration);
}

function startDebateTick() {
  if (debateTickTimer) clearInterval(debateTickTimer);
  debateTickTimer = setInterval(() => {
    state = { ...state, debateTick: state.debateTick + 1 };
    broadcast();
  }, 500);
}

function clearTransientRoundState() {
  state = {
    ...state,
    buzzer: null,
    positions: {},
    debateActive: false,
    votes: {},
    revealed: {},
    voteAnimSeq: {},
  };
}

// ── Actions ─────────────────────────────────────────────────────────────
// One exported entry point per socket event. Each action mutates state
// and triggers a single broadcast() so connected clients see one coherent
// snapshot per action.

export const actions = {
  // `skipIntro` is used by the producer's "reopen" button — reopens a
  // closed round without replaying its intro animation. Default path
  // (trigger a pending round) still plays the intro. Host/producer can
  // always force a replay via roundIntroReplay ("retrigger").
  roundTrigger(id: string, opts: { skipIntro?: boolean } = {}) {
    const r = state.rounds.find((x) => x.id === id);
    if (!r) return;
    clearTransientRoundState();
    state = {
      ...state,
      rounds: state.rounds.map((x) =>
        x.id === id
          ? { ...x, phase: "live" as const }
          : x.phase === "live"
            ? { ...x, phase: "closed" as const }
            : x,
      ),
      activeRoundId: id,
      // Kick off the mode-specific intro animation. The overlay uses `t`
      // as a re-mount key, so bumping it replays the animation whether
      // this is the first trigger or a retrigger. When `skipIntro` is
      // set (reopen), clear roundIntro instead so the overlay mounts the
      // round without the animation.
      roundIntro: opts.skipIntro ? null : { mode: r.mode, t: Date.now() },
      // New round, clean slate — hide any lingering MVP celebration from
      // the previous round so its marquee lights don't carry over.
      mvpWinnerRevealed: false,
    };
    log(`ROUND LIVE — "${r.title}"`, MODES[r.mode].color);
    broadcast();
  },

  // Replay the intro animation. Cheaper than roundTrigger — it doesn't
  // touch rounds/activeRoundId and won't wipe transient state (buzzer,
  // votes, positions). If `id` is given, replay that round's intro (even
  // if it's closed — the producer can re-show a segment's intro after
  // closing it); otherwise fall back to the currently-live round.
  roundIntroReplay(id?: string) {
    const targetId = id ?? state.activeRoundId;
    if (!targetId) return;
    const r = state.rounds.find((x) => x.id === targetId);
    if (!r) return;
    state = {
      ...state,
      roundIntro: { mode: r.mode, t: Date.now() },
    };
    broadcast();
  },

  roundClose() {
    if (!state.activeRoundId) return;
    const r = state.rounds.find((x) => x.id === state.activeRoundId);
    state = {
      ...state,
      rounds: state.rounds.map((x) =>
        x.id === state.activeRoundId ? { ...x, phase: "closed" as const } : x,
      ),
      activeRoundId: null,
      roundIntro: null,
      // Drop the MVP celebration when the round ends so marquee lights
      // + full-screen flourish don't linger into the next round intro.
      mvpWinnerRevealed: false,
    };
    clearTransientRoundState();
    log(`round closed — "${r?.title ?? ""}"`, "#888");
    broadcast();
  },

  roundAdd() {
    const id = "r" + Date.now();
    set({
      rounds: [
        ...state.rounds,
        {
          id,
          title: "New Round",
          topic: "",
          mode: "buzz" as ModeKey,
          phase: "pending",
        },
      ],
    });
  },

  roundUpdate(
    id: string,
    patch: Partial<Pick<Round, "title" | "topic" | "mode" | "choices">>,
  ) {
    set({
      rounds: state.rounds.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // When switching TO a vote mode that reads `choices`, seed
        // defaults if the round doesn't already have them. When
        // switching AWAY, leave them alone — the field is ignored
        // unless the mode reads `choices`. biggerdeal/whoyagot are
        // fixed-length 2; whatstheplay is variable-length (2..N).
        if (
          (patch.mode === "biggerdeal" || patch.mode === "whoyagot") &&
          !next.choices
        ) {
          next.choices = [
            DEFAULT_BIGGER_DEAL_CHOICES[0],
            DEFAULT_BIGGER_DEAL_CHOICES[1],
          ];
        }
        if (patch.mode === "whatstheplay" && !next.choices) {
          next.choices = [...DEFAULT_PLAY_CHOICES];
        }
        // Clamp whatstheplay choice list to the min/max. Producer UI
        // also enforces this, but the server is the authority — if a
        // buggy client ever sends an out-of-bounds list we normalize
        // here so no contestant ever renders < 2 buttons.
        if (next.mode === "whatstheplay" && next.choices) {
          const padded = [...next.choices];
          while (padded.length < PLAY_MIN_CHOICES) {
            padded.push("");
          }
          if (padded.length > PLAY_MAX_CHOICES) {
            padded.length = PLAY_MAX_CHOICES;
          }
          next.choices = padded;
        }
        return next;
      }),
    });
  },

  roundDelete(id: string) {
    if (id === state.activeRoundId) return;
    set({ rounds: state.rounds.filter((r) => r.id !== id) });
  },

  roundMove(id: string, dir: -1 | 1) {
    const idx = state.rounds.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= state.rounds.length) return;
    const next = [...state.rounds];
    [next[idx], next[swap]] = [next[swap]!, next[idx]!];
    set({ rounds: next });
  },

  roundsResetStatuses() {
    state = {
      ...state,
      rounds: state.rounds.map((r) => ({ ...r, phase: "pending" as const })),
      activeRoundId: null,
      roundIntro: null,
      buzzer: null,
      positions: {},
      debateActive: false,
      mvpWinnerRevealed: false,
    };
    log("all rounds reset to pending", "#888");
    broadcast();
  },

  // Empty the rundown entirely. Only allowed when no round is live — the
  // producer has to close the live round first so the host doesn't get
  // the queue yanked out from under them.
  rundownClear() {
    if (state.activeRoundId) {
      log("can't clear rundown — a round is live, close it first", "#ff1744");
      broadcast();
      return;
    }
    const before = state.rounds.length;
    state = { ...state, rounds: [] };
    log(`rundown cleared (${before} round${before === 1 ? "" : "s"})`, "#888");
    broadcast();
  },

  buzz(contestantId: string) {
    if (activeMode() !== "buzz") return;
    if (state.buzzer) return;
    state = { ...state, buzzer: { contestantId, t: Date.now() } };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) log(`${c.name} BUZZED IN`, c.color);
    broadcast();
  },

  buzzerReset() {
    state = { ...state, buzzer: null };
    log("buzzer reset", "#888");
    broadcast();
  },

  positionTake(contestantId: string, color: Position) {
    if (activeMode() !== "redlight") return;
    const prev = state.positions[contestantId];
    state = {
      ...state,
      positions: {
        ...state.positions,
        [contestantId]: prev === color ? null : color,
      },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (!c) {
      broadcast();
      return;
    }
    const already = prev === color;
    log(
      `${c.name} ${already ? "cleared position" : "went " + color.toUpperCase()}`,
      color === "green" ? "#00e676" : "#ff1744",
    );
    broadcast();
  },

  positionsReset() {
    state = { ...state, positions: {}, debateActive: false };
    log("positions cleared", "#888");
    broadcast();
  },

  debateToggle() {
    const next = !state.debateActive;
    state = { ...state, debateActive: next };
    log(next ? "DEBATE STARTED" : "debate ended", "#ffab00");
    broadcast();
  },

  submitTypedBuzz(contestantId: string, text: string) {
    const mode = activeMode();
    if (!state.activeRoundId || mode !== "word") return;
    const value = (text || "").trim();
    if (!value) return;
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: { kind: "typed-buzz", value, t: Date.now() },
      },
      buzzer: state.buzzer ?? { contestantId, t: Date.now() },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) log(`${c.name} submitted "${value}"`, c.color);
    broadcast();
  },

  castVote(contestantId: string, optionKey: string) {
    if (!state.activeRoundId) return;
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: { kind: "vote-anim", value: optionKey, t: Date.now() },
      },
      voteAnimSeq: {
        ...state.voteAnimSeq,
        [contestantId]: (state.voteAnimSeq[contestantId] ?? 0) + 1,
      },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    const mode = MODES[activeMode()];
    const opt = mode.options?.find((o) => o.key === optionKey);
    if (c) log(`${c.name} → ${opt?.label ?? optionKey}`, opt?.color ?? c.color);
    broadcast();
  },

  submitBiggerDeal(contestantId: string, choiceIndex: number) {
    // Accept submissions from either of the two-choice vote modes —
    // they share the same "bigger-deal" vote kind.
    if (!state.activeRoundId) return;
    const mode = activeMode();
    if (mode !== "biggerdeal" && mode !== "whoyagot") return;
    const idx = choiceIndex === 0 || choiceIndex === 1 ? choiceIndex : -1;
    if (idx < 0) return;
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: {
          kind: "bigger-deal",
          value: String(idx),
          t: Date.now(),
        },
      },
      voteAnimSeq: {
        ...state.voteAnimSeq,
        [contestantId]: (state.voteAnimSeq[contestantId] ?? 0) + 1,
      },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    const activeRound = state.rounds.find((r) => r.id === state.activeRoundId);
    // idx is either 0 or 1 (validated above), but narrow explicitly to
    // keep the tuple index safe for TS.
    const choice = idx === 0 ? 0 : 1;
    const label =
      activeRound?.choices?.[choice] ?? (choice === 0 ? "OPTION A" : "OPTION B");
    if (c) log(`${c.name} → ${label}`, c.color);
    broadcast();
  },

  // WHAT'S THE PLAY submission. Contestant either tapped one of the
  // producer-seeded preset choices (choiceIndex set) OR typed their own
  // freeform answer (freeform set). Encoded into `value` with the
  // `idx:N` / `custom:TEXT` convention so every renderer can decode it
  // the same way. Either field may be supplied — if both show up,
  // freeform wins (more specific intent).
  submitPlay(
    contestantId: string,
    payload: { choiceIndex?: number; freeform?: string },
  ) {
    if (!state.activeRoundId || activeMode() !== "whatstheplay") return;
    const activeRound = state.rounds.find((r) => r.id === state.activeRoundId);
    let value: string | null = null;
    let logLabel = "";
    if (typeof payload.freeform === "string") {
      const text = payload.freeform.trim();
      if (!text) return;
      // Hard cap freeform length to keep overlay banners readable — the
      // phone UI also enforces this, but defence in depth matters.
      value = `custom:${text.slice(0, 80)}`;
      logLabel = `"${text.slice(0, 80)}"`;
    } else if (typeof payload.choiceIndex === "number") {
      const n = payload.choiceIndex;
      const choices = activeRound?.choices ?? [];
      if (n < 0 || n >= choices.length) return;
      value = `idx:${n}`;
      logLabel = choices[n] ?? `OPTION ${n + 1}`;
    }
    if (value == null) return;
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: {
          kind: "play-pick",
          value,
          t: Date.now(),
        },
      },
      voteAnimSeq: {
        ...state.voteAnimSeq,
        [contestantId]: (state.voteAnimSeq[contestantId] ?? 0) + 1,
      },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) log(`${c.name} → ${logLabel}`, c.color);
    broadcast();
  },

  submitSentimentScore(contestantId: string, score: number) {
    if (!state.activeRoundId || activeMode() !== "sentiment") return;
    const clamped = Math.max(1, Math.min(10, Math.round(score)));
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: {
          kind: "sentiment-score",
          value: String(clamped),
          t: Date.now(),
        },
      },
      // Bump the anim seq so the overlay re-plays the needle swing if the
      // contestant changes their mind mid-round.
      voteAnimSeq: {
        ...state.voteAnimSeq,
        [contestantId]: (state.voteAnimSeq[contestantId] ?? 0) + 1,
      },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) log(`${c.name} scored ${clamped}/10`, c.color);
    broadcast();
  },

  submitHiddenAnswer(contestantId: string, text: string) {
    if (!state.activeRoundId || activeMode() !== "sentence") return;
    const value = (text || "").trim();
    if (!value) return;
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: { kind: "hidden-answer", value, t: Date.now() },
      },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) log(`${c.name} locked in answer`, c.color);
    broadcast();
  },

  // MVP mode: the contestant's vote value stores the id of another
  // contestant (their MVP pick). Unlike "sentence" (which stays hidden
  // until the host flips it), MVP picks auto-reveal on lock — tapping
  // a name on the phone immediately drops the pick on-air. The host's
  // "reveal winner" button still controls when the full-screen
  // celebration fires.
  submitMvpPick(contestantId: string, targetId: string) {
    if (!state.activeRoundId || activeMode() !== "mvp") return;
    // Can't MVP yourself — silently drop. Picker UI hides the self
    // option, this is just a belt-and-suspenders check.
    if (targetId === contestantId) return;
    const target = state.contestants.find((x) => x.id === targetId);
    if (!target) return;
    state = {
      ...state,
      votes: {
        ...state.votes,
        [contestantId]: {
          kind: "mvp-pick",
          value: targetId,
          t: Date.now(),
        },
      },
      // Auto-reveal — every downstream surface (overlay tally, host
      // panel, contestant phone) reads `revealed[c.id]` to decide
      // whether to show the pick, so flipping it on at submit time is
      // the whole of "auto-reveal."
      revealed: { ...state.revealed, [contestantId]: true },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) log(`${c.name} picked ${target.name} as MVP`, c.color);
    broadcast();
  },

  revealAnswer(contestantId: string) {
    if (!state.activeRoundId) return;
    const mode = activeMode();
    if (mode !== "sentence" && mode !== "mvp") return;
    const vote = state.votes[contestantId];
    if (!vote) return;
    if (vote.kind !== "hidden-answer" && vote.kind !== "mvp-pick") return;
    state = {
      ...state,
      revealed: { ...state.revealed, [contestantId]: true },
    };
    const c = state.contestants.find((x) => x.id === contestantId);
    if (c) {
      if (vote.kind === "mvp-pick") {
        const target = state.contestants.find((x) => x.id === vote.value);
        log(`${c.name} picked ${target?.name ?? "?"} as MVP`, c.color);
      } else {
        log(`${c.name} REVEALED: "${vote.value}"`, c.color);
      }
    }
    broadcast();
  },

  hostHideAnswer(contestantId: string) {
    const next = { ...state.revealed };
    delete next[contestantId];
    set({ revealed: next });
  },

  reactionSend(contestantId: string, emoji: string) {
    const id = Date.now() + Math.random();
    state = {
      ...state,
      reactions: [
        ...state.reactions,
        { id, emoji, contestantId, t: Date.now() },
      ],
    };
    broadcast();
    setTimeout(() => {
      state = {
        ...state,
        reactions: state.reactions.filter((x) => x.id !== id),
      };
      broadcast();
    }, 2200);
  },

  cardTryPlay(byId: string, cardKey: CardKey) {
    const card = CARDS[cardKey];
    const c = state.contestants.find((x) => x.id === byId);
    if (!c) return;
    if (c.cards[cardKey].used >= c.cards[cardKey].max) return;
    if (card.needsTarget) {
      set({ targetPicker: { byId, cardKey } });
      return;
    }
    actions.cardFire(byId, cardKey, null);
  },

  cardFire(byId: string, cardKey: CardKey, targetId: string | null) {
    const card = CARDS[cardKey];
    const byName = state.contestants.find((x) => x.id === byId)?.name;
    const tName =
      targetId && state.contestants.find((x) => x.id === targetId)?.name;
    state = {
      ...state,
      contestants: state.contestants.map((c) =>
        c.id === byId
          ? {
              ...c,
              cards: {
                ...c.cards,
                [cardKey]: {
                  ...c.cards[cardKey],
                  used: c.cards[cardKey].used + 1,
                },
              },
            }
          : c,
      ),
      activeEffect: {
        type: cardKey,
        by: byId,
        target: targetId,
        t: Date.now(),
        duration: card.duration,
      },
      targetPicker: null,
      // interrupt also drops whoever was holding the buzzer
      buzzer: cardKey === "interrupt" ? null : state.buzzer,
    };
    log(
      `${byName ?? "?"} played ${card.name}${tName ? " → " + tName : ""}`,
      card.color,
    );
    broadcast();
    scheduleEffectClear(card.duration);
    if (cardKey === "quickdebate") startDebateTick();
  },

  cancelTarget() {
    set({ targetPicker: null });
  },

  contestantRename(id: string, name: string) {
    set({
      contestants: state.contestants.map((c) =>
        c.id === id ? { ...c, name: (name || "").toUpperCase() } : c,
      ),
    });
  },

  // Spotlight exactly one contestant. Clicking the same id again clears
  // the spotlight. The countdown clock is independent now — see
  // timerStart / timerStop.
  spotlightSet(id: string | null) {
    if (!id) {
      if (!state.spotlight.id) return;
      set({ spotlight: { id: null } });
      return;
    }
    const same = state.spotlight.id === id;
    if (same) {
      set({ spotlight: { id: null } });
      return;
    }
    set({ spotlight: { id } });
  },

  // Start the bottom-center countdown clock. Anchors `startedAt` to the
  // server's wall clock so every connected client converges on the same
  // remaining time without a tick broadcast. Calling while already
  // running restarts from zero with the current budget.
  timerStart() {
    set({ timer: { startedAt: Date.now() } });
  },

  // Stop + hide the countdown clock. The overlay reads `timer.startedAt`
  // and renders nothing when it's null, so this also makes the clock
  // disappear from stream.
  timerStop() {
    if (state.timer.startedAt === null) return;
    set({ timer: { startedAt: null } });
  },

  // Update the countdown budget. If the clock is currently running,
  // restart it so the new budget takes effect immediately rather than
  // kicking in on the next start.
  timerDurationSet(ms: number) {
    const clamped = Math.max(5_000, Math.min(600_000, Math.round(ms)));
    if (clamped === state.timerDurationMs && state.timer.startedAt === null) {
      // no-op when the timer is off and the value didn't change
      return;
    }
    const nextTimer =
      state.timer.startedAt !== null
        ? { startedAt: Date.now() }
        : state.timer;
    set({ timerDurationMs: clamped, timer: nextTimer });
  },

  // Layout — one set of numbers drives every contestant tile + placard,
  // plus the topic bar and main stage rects. Mirroring is automatic
  // because the renderer derives all six tiles from these values.
  layoutUpdate(patch: Partial<Layout>) {
    set({ layout: { ...state.layout, ...patch } });
  },

  layoutReset() {
    set({
      layout: {
        ...DEFAULT_LAYOUT,
        rowTops: [...DEFAULT_LAYOUT.rowTops],
      },
    });
    log("layout reset to defaults", "#888");
  },

  chatSend(payload: { role: ChatRole; authorId?: string; text: string }) {
    const value = (payload.text || "").trim();
    if (!value) return;
    let name = "";
    let color = "";
    if (payload.role === "contestant") {
      const c = state.contestants.find((x) => x.id === payload.authorId);
      if (!c) return;
      name = c.name;
      color = c.color;
    } else if (payload.role === "host") {
      name = "HOST";
      color = HOST_COLOR;
    } else {
      name = "PRODUCER";
      color = PRODUCER_COLOR;
    }
    state = {
      ...state,
      chatMessages: [
        ...state.chatMessages,
        {
          id: Date.now() + Math.random(),
          role: payload.role,
          authorId: payload.authorId,
          name,
          color,
          text: value,
          time: Date.now(),
        },
      ].slice(-200),
    };
    broadcast();
  },

  // Set the per-player allotment for a single card. Updates the shared
  // `cardMaxes` map AND reflows each contestant's hand: if `used` already
  // exceeds the new ceiling, we clamp it so no one carries a "negative"
  // remaining count. Fractional/negative values are clamped to 0..9 —
  // nine is plenty for a show and keeps the UI tidy.
  cardMaxSet(cardKey: CardKey, max: number) {
    if (!(cardKey in CARDS)) return;
    const clamped = Math.max(0, Math.min(9, Math.round(max)));
    if (state.cardMaxes[cardKey] === clamped) return;
    state = {
      ...state,
      cardMaxes: { ...state.cardMaxes, [cardKey]: clamped },
      contestants: state.contestants.map((c) => ({
        ...c,
        cards: {
          ...c.cards,
          [cardKey]: {
            max: clamped,
            used: Math.min(c.cards[cardKey].used, clamped),
          },
        },
      })),
    };
    log(`card allotment: ${CARDS[cardKey].name} → ${clamped}/player`, CARDS[cardKey].color);
    broadcast();
  },

  // Fire the MVP winner celebration manually. The overlay was
  // auto-firing when the last contestant revealed their pick, but
  // producers wanted control over when the full-screen flourish + marquee
  // lights appear (the host needs a beat to riff on the reveal first).
  // Gated on every contestant having LOCKED a pick — reveal status is
  // ignored because firing the winner reveal force-reveals any
  // still-hidden picks in the same action (so the host can short-circuit
  // the per-player flip if a contestant forgot to reveal their own card).
  mvpWinnerReveal() {
    if (activeMode() !== "mvp") return;
    if (state.mvpWinnerRevealed) return;
    const allVoted =
      state.contestants.length > 0 &&
      state.contestants.every(
        (c) => state.votes[c.id]?.kind === "mvp-pick",
      );
    if (!allVoted) return;
    // Force-reveal every pick so the overlay has a full tally on
    // screen when the celebration fires. Any pick that was already
    // revealed stays revealed.
    const nextRevealed = { ...state.revealed };
    for (const c of state.contestants) {
      if (!nextRevealed[c.id]) nextRevealed[c.id] = true;
    }
    log("MVP WINNER REVEALED", "#ffd700");
    set({ revealed: nextRevealed, mvpWinnerRevealed: true });
  },

  // Hide the MVP celebration. Lets the host redo the reveal (e.g. if the
  // full-screen flourish was interrupted) without needing to bounce the
  // round. Marquee lights + full-screen overlay both gate on
  // `mvpWinnerRevealed`, so flipping this off pulls everything off stage.
  mvpWinnerHide() {
    if (!state.mvpWinnerRevealed) return;
    set({ mvpWinnerRevealed: false });
  },

  // Restart the show from the top. Rewinds every round back to "pending",
  // clears all transient game state (votes, reveals, buzzer, positions,
  // effects, spotlight, timer, reactions), and refreshes each contestant's
  // card charges — but preserves the rundown the producer built, their
  // contestant names/colors, the chat history, the event log, and the
  // overlay layout. Use `resetAll` if you want a clean slate including
  // rundown + roster.
  showRestart() {
    clearTimers();
    state = {
      ...state,
      rounds: state.rounds.map((r) => ({ ...r, phase: "pending" as const })),
      contestants: state.contestants.map((c) => ({
        ...c,
        cards: freshCards(state.cardMaxes),
      })),
      activeRoundId: null,
      roundIntro: null,
      buzzer: null,
      positions: {},
      votes: {},
      revealed: {},
      voteAnimSeq: {},
      debateActive: false,
      debateTick: 0,
      activeEffect: null,
      targetPicker: null,
      reactions: [],
      spotlight: { id: null },
      timer: { startedAt: null },
      mvpWinnerRevealed: false,
    };
    log("show restarted — rundown preserved", "#ffd700");
    broadcast();
  },

  resetAll() {
    clearTimers();
    // Preserve the producer's layout across "reset all" — resetting rounds
    // and contestants shouldn't clobber their carefully-tuned overlay
    // geometry. Use `layoutReset` in the editor if you actually want to
    // restore DEFAULT_LAYOUT.
    const preservedLayout = state.layout;
    // Card allotments reset along with everything else — resetAll is the
    // "nuke the show" button, so the producer's cardMaxes tweaks go back
    // to baked-in defaults via seedState(). `showRestart` is the softer
    // button that keeps them.
    state = {
      ...seedState(),
      contestants: seedContestants(),
      rounds: seedRounds(),
      layout: preservedLayout,
      cardMaxes: seedCardMaxes(),
    };
    log("full game reset — layout preserved", "#888");
    // Wipe the rundown/roster file; broadcast below will immediately
    // re-persist the seed values. The layout file is deliberately NOT
    // cleared — it's persisted separately and belongs to the layout,
    // not the show.
    void clearSettings();
    broadcast();
  },
};

export type ServerActions = typeof actions;
