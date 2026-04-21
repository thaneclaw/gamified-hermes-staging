import { CARDS } from "./constants.ts";
import type {
  Contestant,
  GameSnapshot,
  Layout,
  Round,
  SlotKey,
} from "./types.ts";

const INITIAL_ROUNDS: Round[] = [
  { id: "r1", title: "Opening Shot",        topic: "Describe yourself in three words — GO.",      mode: "buzz",     phase: "pending" },
  { id: "r2", title: "Hot Take #1",         topic: "Pineapple belongs on pizza.",                 mode: "redlight", phase: "pending" },
  { id: "r3", title: "Lightning Round",     topic: "Name a film that's better than the book.",    mode: "buzz",     phase: "pending" },
  { id: "r4", title: "Hot Take #2",         topic: "Remote work has been a net negative for culture.", mode: "redlight", phase: "pending" },
  { id: "r5", title: "What's the Word?",    topic: "One word that describes this week in tech.",  mode: "word",     phase: "pending" },
  { id: "r6", title: "Bullish or Bullshit?",topic: "AI will replace 50% of knowledge work by 2030.", mode: "bullish", phase: "pending" },
  { id: "r7", title: "Buy or Sell",         topic: "Nvidia at current valuation.",                mode: "market",   phase: "pending" },
  { id: "r8", title: "Finish the Sentence", topic: "The most overrated startup of the last decade was…", mode: "sentence", phase: "pending" },
];

const INITIAL_CONTESTANTS: Array<Omit<Contestant, "cards"> & { slot: SlotKey }> = [
  { id: "a", name: "ALEX",   color: "#00e5ff", slot: "L1" },
  { id: "b", name: "SAM",    color: "#ff2e6b", slot: "L2" },
  { id: "c", name: "JORDAN", color: "#c6ff00", slot: "L3" },
  { id: "d", name: "RILEY",  color: "#ffd700", slot: "R1" },
  { id: "e", name: "TAYLOR", color: "#c239ff", slot: "R2" },
  { id: "f", name: "CASEY",  color: "#ff6b00", slot: "R3" },
];

// Card allotments default to the baked-in `maxUses` for each card but
// can be overridden per-show via the producer UI. Callers that need the
// current per-player budget should pass in `state.cardMaxes` so every
// contestant gets the same, producer-authored count.
export function freshCards(
  overrides?: Partial<Record<keyof typeof CARDS, number>>,
): Contestant["cards"] {
  return Object.fromEntries(
    Object.entries(CARDS).map(([key, c]) => {
      const max = overrides?.[key as keyof typeof CARDS] ?? c.maxUses;
      return [key, { used: 0, max }];
    }),
  ) as Contestant["cards"];
}

export function seedCardMaxes(): Record<keyof typeof CARDS, number> {
  return Object.fromEntries(
    Object.entries(CARDS).map(([key, c]) => [key, c.maxUses]),
  ) as Record<keyof typeof CARDS, number>;
}

export function seedContestants(): Contestant[] {
  return INITIAL_CONTESTANTS.map((c) => ({ ...c, cards: freshCards() }));
}

// Default layout values chosen to line up with the baked-in graphics on
// public/backdrop.jpg. These are what the overlay looked like before the
// layout editor was added.
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
  // Negative value → placard overlaps into the bottom of the tile.
  placardTopOffset: -2.9,
  topicBar: { left: 27.8, top: 0.0, width: 44.6, height: 4.5 },
  centerSlot: { left: 27.8, top: 14.3, width: 44.6, height: 44.3 },
  // Bottom-center countdown clock. `left`/`top` are the centre of the
  // circle; `width` is its diameter as a % of the overlay width. Height
  // is kept for symmetry but the renderer treats the clock as square.
  timer: { left: 50.0, top: 91.0, width: 5.0, height: 5.0 },
};

export function seedRounds(): Round[] {
  return INITIAL_ROUNDS.map((r) => ({ ...r }));
}

export function seedState(): GameSnapshot {
  return {
    contestants: seedContestants(),
    rounds: seedRounds(),
    layout: { ...DEFAULT_LAYOUT, rowTops: [...DEFAULT_LAYOUT.rowTops] },
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
    // No contestant spotlighted at seed.
    spotlight: { id: null },
    // Countdown clock starts off — producer hits "start" to begin.
    timer: { startedAt: null },
    // 30 seconds is a sane default for a game-show round — enough for a
    // take, short enough to keep energy up. Producer/host can dial it.
    timerDurationMs: 30_000,
    // Mirror the card baked-in maxUses as the default allotment; the
    // producer can tweak this at any time from Show Setup and every
    // contestant's hand is updated in place.
    cardMaxes: seedCardMaxes(),
    // MVP celebration is off until host/producer hits "reveal winner".
    mvpWinnerRevealed: false,
  };
}
