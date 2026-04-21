import type { CardKey } from "../cards";
import type { ModeKey, VoteKind } from "../modes";
import type { SlotKey } from "../slots";

export type Position = "green" | "red";

export type RoundPhase = "pending" | "live" | "closed";

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
  // Producer-supplied choices shown to contestants. Shape depends on mode:
  //   - biggerdeal / whoyagot → always exactly 2 entries
  //   - whatstheplay → 2..N entries; contestants can also submit a
  //     freeform answer that isn't in this list.
  // Other modes ignore this field. Optional so older rounds stay valid.
  choices?: string[];
}

// Intro animation that plays on round trigger. Re-bumping `t` while the
// same mode is live (retrigger) causes the overlay to re-mount and replay
// the animation. `null` when no round is live.
export interface RoundIntro {
  mode: ModeKey;
  t: number;
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
  // Epoch ms. Serialized as a number over Socket.IO; render with
  // new Date(time).toTimeString() at the UI layer.
  time: number;
}

export type ChatRole = "contestant" | "host" | "producer";

export interface ChatMessage {
  id: number;
  role: ChatRole;
  // authorId is only set for contestants (maps back to Contestant.id)
  authorId?: string;
  name: string;
  color: string;
  text: string;
  time: number;
}

// Overlay layout — percentages of the overlay container. Shared across
// all six tiles so editing one propagates to all six (mirroring is
// automatic because every tile derives from these values).
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Layout {
  tileWidth: number;
  tileHeight: number;
  // Uniform scale applied to every contestant tile, anchored to each
  // tile's centre so they grow in place. 1.0 = nominal tileWidth x
  // tileHeight. Let the producer size the whole video grid with a
  // single slider without also rewriting column/row positions.
  tileScale: number;
  // Contestant-tile corner radius, expressed as a % of the tile's own
  // width so the roundness tracks the backdrop's video-frame corners
  // even as the tile scales.
  tileCornerRadius: number;
  columnLeftL: number;
  columnLeftR: number;
  rowTops: [number, number, number];
  placardWidth: number;
  placardHeight: number;
  // Additive offset from the slot's bottom edge. Negative = placard
  // overlaps into the tile; positive = sits below.
  placardTopOffset: number;
  topicBar: Rect;
  centerSlot: Rect;
  // Countdown clock rect. `left`/`top` are the CENTRE of the circle
  // (percent of the overlay); `width` is its diameter (height tracks
  // width automatically — the clock is always a perfect circle).
  timer: Rect;
}

// Spotlight state — purely "who is in the hot seat". The pulsing tile
// ring follows this; the countdown clock is independent (see TimerState).
export interface SpotlightState {
  id: string | null;
}

// Bottom-center countdown clock. `startedAt` is server-assigned so every
// client computes the same remaining time without a tick broadcast. When
// null the overlay hides the clock.
export interface TimerState {
  startedAt: number | null;
}

// Producer-configured per-player card allotment. Mirrors the keys in
// CARDS; every contestant's `cards[key].max` is reflowed from this
// record whenever the producer edits a value.
export type CardMaxes = Record<CardKey, number>;

export const DEFAULT_LAYOUT: Layout = {
  tileWidth: 14.4,
  tileHeight: 25.0,
  tileScale: 1.0,
  tileCornerRadius: 12,
  columnLeftL: 5.3,
  columnLeftR: 80.4,
  rowTops: [5.7, 36.2, 66.7],
  placardWidth: 10.1,
  placardHeight: 3.4,
  placardTopOffset: -2.9,
  topicBar: { left: 27.8, top: 0.0, width: 44.6, height: 4.5 },
  centerSlot: { left: 27.8, top: 14.3, width: 44.6, height: 44.3 },
  timer: { left: 50.0, top: 91.0, width: 5.0, height: 5.0 },
};
