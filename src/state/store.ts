import { create } from "zustand";
import { CARDS, type CardKey } from "../cards";
import type { ModeKey } from "../modes";
import { socket } from "./socket";
import type {
  ActiveEffect,
  BuzzerState,
  CardMaxes,
  ChatMessage,
  ChatRole,
  Contestant,
  Layout,
  LogEntry,
  Position,
  Reaction,
  Round,
  RoundIntro,
  SpotlightState,
  TargetPicker,
  TimerState,
  VoteRecord,
} from "./types";
import { DEFAULT_LAYOUT } from "./types";

// The client store is a replica of the authoritative state owned by the
// Socket.IO server (see server/state.ts). Every action emits an event to
// the server; incoming "state" broadcasts overwrite the local snapshot.
// Connection status is kept here so the UI can surface a "disconnected"
// indicator.

interface GameState {
  contestants: Contestant[];
  rounds: Round[];
  activeRoundId: string | null;
  roundIntro: RoundIntro | null;
  buzzer: BuzzerState | null;
  positions: Record<string, Position | null | undefined>;
  votes: Record<string, VoteRecord | undefined>;
  revealed: Record<string, true | undefined>;
  voteAnimSeq: Record<string, number | undefined>;
  debateActive: boolean;
  debateTick: number;
  activeEffect: ActiveEffect | null;
  targetPicker: TargetPicker | null;
  reactions: Reaction[];
  eventLog: LogEntry[];
  chatMessages: ChatMessage[];
  layout: Layout;
  spotlight: SpotlightState;
  timer: TimerState;
  timerDurationMs: number;
  cardMaxes: CardMaxes;
  mvpWinnerRevealed: boolean;
  connected: boolean;
}

interface GameActions {
  // round lifecycle
  roundTrigger: (id: string, opts?: { skipIntro?: boolean }) => void;
  roundIntroReplay: (id?: string) => void;
  roundClose: () => void;
  // producer-only round ops
  roundAdd: () => void;
  roundUpdate: (
    id: string,
    patch: Partial<Pick<Round, "title" | "topic" | "mode" | "choices">>,
  ) => void;
  roundDelete: (id: string) => void;
  roundMove: (id: string, dir: -1 | 1) => void;
  roundsResetStatuses: () => void;
  rundownClear: () => void;
  // buzzer
  buzz: (contestantId: string) => void;
  buzzerReset: () => void;
  // RLGL
  positionTake: (contestantId: string, color: Position) => void;
  positionsReset: () => void;
  debateToggle: () => void;
  // mode-specific submissions
  submitTypedBuzz: (contestantId: string, text: string) => void;
  castVote: (contestantId: string, optionKey: string) => void;
  submitSentimentScore: (contestantId: string, score: number) => void;
  submitBiggerDeal: (contestantId: string, choiceIndex: number) => void;
  submitPlay: (
    contestantId: string,
    payload: { choiceIndex?: number; freeform?: string },
  ) => void;
  submitHiddenAnswer: (contestantId: string, text: string) => void;
  submitMvpPick: (contestantId: string, targetId: string) => void;
  revealAnswer: (contestantId: string) => void;
  hostHideAnswer: (contestantId: string) => void;
  // reactions
  reactionSend: (contestantId: string, emoji: string) => void;
  // cards
  cardTryPlay: (byId: string, cardKey: CardKey) => void;
  cardFire: (byId: string, cardKey: CardKey, targetId: string | null) => void;
  cancelTarget: () => void;
  // chat
  chatSend: (payload: {
    role: ChatRole;
    authorId?: string;
    text: string;
  }) => void;
  // producer
  contestantRename: (id: string, name: string) => void;
  // spotlight + countdown
  spotlightSet: (id: string | null) => void;
  timerDurationSet: (ms: number) => void;
  timerStart: () => void;
  timerStop: () => void;
  // layout
  layoutUpdate: (patch: Partial<Layout>) => void;
  layoutReset: () => void;
  // per-player card allotment (producer/host control)
  cardMaxSet: (cardKey: CardKey, max: number) => void;
  // MVP manual winner reveal — the host/producer fires the full-screen
  // celebration after the last pick is revealed. `hide` pulls it back
  // down in case they want to re-fire the flourish.
  mvpWinnerReveal: () => void;
  mvpWinnerHide: () => void;
  // restart the show — rewinds all rounds to pending, clears transient
  // round state, refreshes contestant card charges. Keeps rundown,
  // contestants, chat, event log, and layout intact.
  showRestart: () => void;
  // everything
  resetAll: () => void;
}

export type GameStore = GameState & GameActions;

// Six fixed contestant slots the producer can rename. Kept client-side
// so the edit grid always shows 6 fields, even before the server sync
// delivers real names (or when running without a backend). The server's
// authoritative snapshot overwrites these on the first "state" broadcast.
const PLACEHOLDER_CONTESTANTS: Contestant[] = (
  [
    { id: "a", name: "", color: "#00e5ff", slot: "L1" },
    { id: "b", name: "", color: "#ff2e6b", slot: "L2" },
    { id: "c", name: "", color: "#c6ff00", slot: "L3" },
    { id: "d", name: "", color: "#ffd700", slot: "R1" },
    { id: "e", name: "", color: "#c239ff", slot: "R2" },
    { id: "f", name: "", color: "#ff6b00", slot: "R3" },
  ] as Omit<Contestant, "cards">[]
).map((c) => ({
  ...c,
  cards: Object.fromEntries(
    Object.entries(CARDS).map(([k, v]) => [k, { used: 0, max: v.maxUses }]),
  ) as Contestant["cards"],
}));

const emptyState: GameState = {
  contestants: PLACEHOLDER_CONTESTANTS,
  rounds: [],
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
  eventLog: [],
  chatMessages: [],
  layout: { ...DEFAULT_LAYOUT, rowTops: [...DEFAULT_LAYOUT.rowTops] },
  spotlight: { id: null },
  timer: { startedAt: null },
  timerDurationMs: 30_000,
  // Mirror CARDS maxUses for a plausible pre-sync default so the UI
  // renders sensible numbers before the first "state" broadcast arrives.
  cardMaxes: Object.fromEntries(
    Object.entries(CARDS).map(([k, v]) => [k, v.maxUses]),
  ) as CardMaxes,
  mvpWinnerRevealed: false,
  connected: false,
};

export const useGameStore = create<GameStore>(() => ({
  ...emptyState,

  // ── Every action below is a thin emit. The server applies the action,
  // then broadcasts the next state — which lands in the socket.on("state")
  // handler below and replaces the local snapshot.

  roundTrigger: (id, opts) =>
    socket.emit("round:trigger", { id, skipIntro: opts?.skipIntro === true }),
  roundIntroReplay: (id) => socket.emit("round:intro-replay", { id }),
  roundClose: () => socket.emit("round:close"),
  roundAdd: () => socket.emit("round:add"),
  roundUpdate: (id, patch) => socket.emit("round:update", { id, patch }),
  roundDelete: (id) => socket.emit("round:delete", { id }),
  roundMove: (id, dir) => socket.emit("round:move", { id, dir }),
  roundsResetStatuses: () => socket.emit("rounds:reset"),
  rundownClear: () => socket.emit("rundown:clear"),

  buzz: (contestantId) => socket.emit("buzz", { contestantId }),
  buzzerReset: () => socket.emit("buzzer:reset"),

  positionTake: (contestantId, color) =>
    socket.emit("position:take", { contestantId, color }),
  positionsReset: () => socket.emit("positions:reset"),
  debateToggle: () => socket.emit("debate:toggle"),

  submitTypedBuzz: (contestantId, text) =>
    socket.emit("typedbuzz:submit", { contestantId, text }),
  castVote: (contestantId, optionKey) =>
    socket.emit("vote:cast", { contestantId, optionKey }),
  submitSentimentScore: (contestantId, score) =>
    socket.emit("sentiment:submit", { contestantId, score }),
  submitBiggerDeal: (contestantId, choiceIndex) =>
    socket.emit("biggerdeal:submit", { contestantId, choiceIndex }),
  submitPlay: (contestantId, payload) =>
    socket.emit("play:submit", { contestantId, ...payload }),
  submitHiddenAnswer: (contestantId, text) =>
    socket.emit("answer:submit", { contestantId, text }),
  submitMvpPick: (contestantId, targetId) =>
    socket.emit("mvp:submit", { contestantId, targetId }),
  revealAnswer: (contestantId) =>
    socket.emit("answer:reveal", { contestantId }),
  hostHideAnswer: (contestantId) =>
    socket.emit("answer:hide", { contestantId }),

  reactionSend: (contestantId, emoji) =>
    socket.emit("reaction:send", { contestantId, emoji }),

  cardTryPlay: (byId, cardKey) => socket.emit("card:try", { byId, cardKey }),
  cardFire: (byId, cardKey, targetId) =>
    socket.emit("card:fire", { byId, cardKey, targetId }),
  cancelTarget: () => socket.emit("card:cancel"),

  contestantRename: (id, name) => socket.emit("contestant:rename", { id, name }),

  spotlightSet: (id) => socket.emit("spotlight:set", { id }),
  timerDurationSet: (ms) => socket.emit("timer:duration-set", { ms }),
  timerStart: () => socket.emit("timer:start"),
  timerStop: () => socket.emit("timer:stop"),

  chatSend: (payload) => socket.emit("chat:send", payload),

  layoutUpdate: (patch) => socket.emit("layout:update", patch),
  layoutReset: () => socket.emit("layout:reset"),

  cardMaxSet: (cardKey, max) => socket.emit("cards:set-max", { cardKey, max }),
  mvpWinnerReveal: () => socket.emit("mvp:winner-reveal"),
  mvpWinnerHide: () => socket.emit("mvp:winner-hide"),

  showRestart: () => socket.emit("show:restart"),
  resetAll: () => socket.emit("reset:all"),
}));

// ── Socket wiring (runs once on module import) ────────────────────────
// Server → client: "state" is the full authoritative snapshot. Replace
// local state wholesale. Non-state keys (actions, connected) are kept via
// a partial merge.
type ServerSnapshot = Omit<GameState, "connected">;

socket.on("state", (snapshot: ServerSnapshot) => {
  useGameStore.setState(snapshot);
});

socket.on("connect", () => {
  useGameStore.setState({ connected: true });
});

socket.on("disconnect", () => {
  useGameStore.setState({ connected: false });
});

// ── selectors ─────────────────────────────────────────────────────────
export const selectActiveRound = (s: GameStore): Round | null =>
  s.rounds.find((r) => r.id === s.activeRoundId) ?? null;

export const selectGameMode = (s: GameStore): ModeKey =>
  selectActiveRound(s)?.mode ?? "buzz";

export const selectWinner = (s: GameStore): Contestant | null =>
  s.buzzer
    ? (s.contestants.find((c) => c.id === s.buzzer!.contestantId) ?? null)
    : null;

export const selectEffectBy = (s: GameStore): Contestant | null =>
  s.activeEffect
    ? (s.contestants.find((c) => c.id === s.activeEffect!.by) ?? null)
    : null;

export const selectEffectTarget = (s: GameStore): Contestant | null =>
  s.activeEffect?.target
    ? (s.contestants.find((c) => c.id === s.activeEffect!.target) ?? null)
    : null;
