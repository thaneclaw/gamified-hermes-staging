// Server-side state types. Must match src/state/types.ts on the wire —
// anything that goes over Socket.IO is serialized as JSON, so `time` is a
// millisecond epoch number rather than a Date here.

import type { CardKey, ModeKey, VoteKind } from "./constants.ts";

export type SlotKey = "L1" | "L2" | "L3" | "R1" | "R2" | "R3" | "CENTER";

export type Position = "green" | "red";
export type RoundPhase = "pending" | "live" | "closed";
export type ChatRole = "contestant" | "host" | "producer";

export interface Contestant {
  id: string;
  name: string;
  color: string;
  slot: SlotKey;
  cards: Record<CardKey, { used: number; max: number }>;
}

export interface Round {
  id: string;
  title: string;
  topic: string;
  mode: ModeKey;
  phase: RoundPhase;
  // Variable-length. biggerdeal/whoyagot use exactly two entries;
  // whatstheplay can be 2..PLAY_MAX_CHOICES. Server normalizes to the
  // per-mode bounds in roundUpdate. Mirrors src/state/types.ts.
  choices?: string[];
}

export interface BuzzerState {
  contestantId: string;
  t: number;
}

export interface VoteRecord {
  kind: VoteKind;
  value: string;
  t: number;
}

export interface ActiveEffect {
  type: CardKey;
  by: string;
  target?: string | null;
  t: number;
  duration: number;
}

export interface TargetPicker {
  byId: string;
  cardKey: CardKey;
}

export interface Reaction {
  id: number;
  emoji: string;
  contestantId: string;
  t: number;
}

export interface LogEntry {
  id: number;
  text: string;
  color: string;
  time: number;
}

export interface ChatMessage {
  id: number;
  role: ChatRole;
  authorId?: string;
  name: string;
  color: string;
  text: string;
  time: number;
}

// All numbers below are percentages of the overlay container (1654×936).
// `placardTopOffset` is additive vs. the slot's bottom edge: a negative
// value pulls the placard up into the tile (overlap), positive pushes it
// below. All tiles share the same width/height; all placards share the
// same width/height/offset — editing one propagates to all six.
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Layout {
  tileWidth: number;
  tileHeight: number;
  // Uniform scale applied to every contestant tile, anchored at each
  // tile's centre. 1.0 = nominal tileWidth × tileHeight.
  tileScale: number;
  // Corner radius of the contestant tile outline, as a % of the tile's
  // own width (tracks the backdrop's video-frame corners as it scales).
  tileCornerRadius: number;
  columnLeftL: number;
  columnLeftR: number;
  rowTops: [number, number, number];
  placardWidth: number;
  placardHeight: number;
  placardTopOffset: number;
  topicBar: Rect;
  centerSlot: Rect;
  // Bottom-center countdown clock. Percent-based so it scales with the
  // overlay. Width drives the size; height is ignored — the clock is a
  // perfect circle whose diameter equals `width` as a % of the overlay.
  timer: Rect;
}

// Intro animation that plays on round trigger. `t` is a timestamp that
// bumps on every (re)trigger so the overlay can use it as a re-mount key
// to restart the animation without tracking per-round "has played" flags.
export interface RoundIntro {
  mode: ModeKey;
  t: number;
}

// Spotlight state — purely "who is the hot seat". Independent from the
// countdown clock (see TimerState). Toggling spotlight no longer starts
// or stops the countdown; the producer/host runs the timer explicitly.
export interface SpotlightState {
  id: string | null;
}

// Bottom-center countdown clock. `startedAt` = server-authored wall-clock
// moment the run began, or null when the clock is off. Clients use it with
// `timerDurationMs` to converge on the same remaining time without a tick
// broadcast. Changing duration while running re-anchors startedAt so the
// new budget takes effect immediately.
export interface TimerState {
  startedAt: number | null;
}

export interface GameSnapshot {
  contestants: Contestant[];
  rounds: Round[];
  layout: Layout;
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
  spotlight: SpotlightState;
  timer: TimerState;
  timerDurationMs: number;
  // Producer-configured per-player allotment for each card. `freshCards()`
  // and `showRestart` both read these to hand every contestant the same
  // number of each card. Seeded from CARDS[key].maxUses; editing one value
  // propagates to every contestant on the next refresh and, for in-flight
  // rounds, updates each contestant's `cards[key].max` immediately.
  cardMaxes: Record<CardKey, number>;
  // MVP winner reveal is manual now — the host/producer hits a button on
  // the round interface to fire the full-screen celebration. Reset to
  // false on every round trigger/close + show restart so a stale reveal
  // flag can't bleed into the next MVP round.
  mvpWinnerRevealed: boolean;
}
