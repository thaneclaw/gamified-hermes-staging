import {
  ArrowLeftRight,
  ArrowUpDown,
  Flag,
  Gauge,
  Lightbulb,
  MessageSquare,
  Scale,
  Star,
  TrendingUp,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type ModeKey =
  | "buzz"
  | "redlight"
  | "word"
  | "bullish"
  | "market"
  | "sentence"
  | "sentiment"
  | "fairfoul"
  | "biggerdeal"
  | "whoyagot"
  | "whatstheplay"
  | "overunder"
  | "mvp";

export type VoteKind =
  | "typed-buzz"
  | "vote-anim"
  | "hidden-answer"
  | "sentiment-score"
  | "bigger-deal"
  | "play-pick"
  | "mvp-pick";

export type ModePrimary = "buzz" | "position" | VoteKind;

export interface VoteOption {
  key: string;
  label: string;
  color: string;
  emoji: string;
  arrow: "up" | "down";
}

export interface Mode {
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
  primary: ModePrimary;
  placeholder?: string;
  maxLength?: number;
  options?: VoteOption[];
}

export const MODES: Record<ModeKey, Mode> = {
  buzz: {
    name: "BUZZER",
    icon: Zap,
    color: "#00e5ff",
    description: "First to buzz answers.",
    primary: "buzz",
  },
  redlight: {
    name: "RED LIGHT / GREEN LIGHT",
    icon: Flag,
    color: "#ffab00",
    description: "Contestants declare GREEN or RED, then debate.",
    primary: "position",
  },
  word: {
    name: "WHAT'S THE WORD?",
    icon: Type,
    color: "#00e5ff",
    description: "Type a word to buzz in. Typed entry = your buzz.",
    primary: "typed-buzz",
    placeholder: "your word…",
    maxLength: 24,
  },
  bullish: {
    name: "BULLISH OR BULLSHIT",
    icon: TrendingUp,
    color: "#c6ff00",
    description: "Hit BULLISH or BULLSHIT. Your tile shows your call.",
    primary: "vote-anim",
    options: [
      { key: "bullish", label: "BULLISH", color: "#00e676", emoji: "🐂", arrow: "up" },
      { key: "bullshit", label: "BULL💩", color: "#ff1744", emoji: "💩", arrow: "down" },
    ],
  },
  market: {
    name: "BUY OR SELL",
    icon: TrendingUp,
    color: "#00e676",
    description: "BUY or SELL. Up/down arrow slams your tile.",
    primary: "vote-anim",
    options: [
      { key: "buy", label: "BUY", color: "#00e676", emoji: "📈", arrow: "up" },
      { key: "sell", label: "SELL", color: "#ff1744", emoji: "📉", arrow: "down" },
    ],
  },
  sentence: {
    name: "FINISH THE SENTENCE",
    icon: MessageSquare,
    color: "#c239ff",
    description: "Lock in your answer. Reveal it when it's your turn.",
    primary: "hidden-answer",
    placeholder: "finish it…",
    maxLength: 80,
  },
  sentiment: {
    name: "SENTIMENT SCORE",
    icon: Gauge,
    color: "#ff9500",
    description: "Pick 1-10. Needle swings from red (low) to green (high).",
    primary: "sentiment-score",
  },
  fairfoul: {
    name: "FAIR OR FOUL",
    icon: Scale,
    color: "#00b3ff",
    description: "Hit FAIR or FOUL — the call slams into the name bar.",
    primary: "vote-anim",
    options: [
      { key: "fair", label: "FAIR", color: "#00e676", emoji: "⚖️", arrow: "up" },
      { key: "foul", label: "FOUL", color: "#ff1744", emoji: "🚫", arrow: "down" },
    ],
  },
  // Sports-book style binary — contestants call OVER or UNDER against
  // whatever number the host puts on the board (the topic field is a
  // fine place to park "over/under 3.5 TDs"). Same primary + rendering
  // shape as bullish/market/fairfoul, so every downstream component
  // (contestant buttons, overlay banner, host tally, submissions panel,
  // producer card) picks it up automatically from modeCfg.options.
  overunder: {
    name: "OVER / UNDER",
    icon: ArrowUpDown,
    color: "#1de9b6",
    description:
      "Set a line, then contestants call OVER or UNDER — slam animates on the name bar.",
    primary: "vote-anim",
    options: [
      { key: "over", label: "OVER", color: "#00e676", emoji: "🔼", arrow: "up" },
      { key: "under", label: "UNDER", color: "#ff1744", emoji: "🔽", arrow: "down" },
    ],
  },
  biggerdeal: {
    name: "BIGGER DEAL",
    icon: ArrowLeftRight,
    color: "#ff61c7",
    description: "Two producer-supplied choices — pick the bigger deal.",
    primary: "bigger-deal",
  },
  // Same functional shape as biggerdeal (two producer-supplied choices,
  // bigger-deal vote kind) — just a different brand so the host can cue
  // a "WHO YA GOT?" segment without relabelling. Kept as a distinct
  // ModeKey so the dropdown, intro animation title, and producer colour
  // all reflect the different framing.
  whoyagot: {
    name: "WHO YA GOT",
    icon: ArrowLeftRight,
    color: "#7c4dff",
    description: "Two producer-supplied choices — who ya got?",
    primary: "bigger-deal",
  },
  // Multi-choice producer-seeded plays plus a freeform "other" slot so
  // contestants can write their own call. Stored in `round.choices`
  // (variable length, 2..N). Vote value encoding is `idx:N` for a preset
  // pick or `custom:TEXT` for a freeform answer; use `encodePlayVote` /
  // `decodePlayVote` below to read/write them so the on-wire format
  // stays consistent.
  whatstheplay: {
    name: "WHAT'S THE PLAY",
    icon: Lightbulb,
    color: "#ff5252",
    description:
      "Producer seeds N plays; contestants tap one OR type their own call.",
    primary: "play-pick",
  },
  mvp: {
    name: "MVP",
    icon: Star,
    color: "#ffd700",
    description:
      "Contestants pick who their MVP of the show is. Each player reveals their own pick, then the show tallies and crowns a winner.",
    primary: "mvp-pick",
  },
};

// Default choices used when a new "bigger deal" round is created. The
// producer overrides them in the rundown editor.
export const DEFAULT_BIGGER_DEAL_CHOICES: [string, string] = [
  "OPTION A",
  "OPTION B",
];

// Tile / banner colours for each side of a "bigger deal" vote. Kept in
// one place so ContestantPhone + OverlayPreview + SubmissionsPanel agree.
export const BIGGER_DEAL_COLORS: [string, string] = ["#00e5ff", "#ff2e6b"];

// Default choices seeded when switching a round TO whatstheplay. Three
// slots out of the box so the producer can see the multi-choice shape
// and add/remove from there.
export const DEFAULT_PLAY_CHOICES: string[] = [
  "OPTION A",
  "OPTION B",
  "OPTION C",
];

// Hard caps for the whatstheplay choice list — enforced in the producer
// editor + the server action. 2 is the minimum because a single choice is
// just a yes/no; 6 is about as many buttons as fit on a phone screen.
export const PLAY_MIN_CHOICES = 2;
export const PLAY_MAX_CHOICES = 6;

// Encoding helpers for the `play-pick` vote value. The value is either
// `idx:N` (contestant tapped the Nth preset choice) or `custom:TEXT`
// (contestant typed their own answer). Having one parse function means
// every renderer interprets votes the same way; no ad-hoc string
// splitting in component code.
export type PlayVoteSelection =
  | { kind: "preset"; index: number }
  | { kind: "custom"; text: string };

export function encodePlayVote(sel: PlayVoteSelection): string {
  return sel.kind === "preset" ? `idx:${sel.index}` : `custom:${sel.text}`;
}

export function decodePlayVote(value: string): PlayVoteSelection {
  if (value.startsWith("idx:")) {
    const n = Number(value.slice(4));
    return { kind: "preset", index: Number.isFinite(n) && n >= 0 ? n : 0 };
  }
  if (value.startsWith("custom:")) {
    return { kind: "custom", text: value.slice(7) };
  }
  // Fallback for legacy / malformed values — treat as index 0.
  const n = Number(value);
  return {
    kind: "preset",
    index: Number.isFinite(n) && n >= 0 ? n : 0,
  };
}

// Shared bounds for the sentiment-score dial so the overlay + contestant
// phone + host submissions all agree on the scale.
export const SENTIMENT_MIN = 1;
export const SENTIMENT_MAX = 10;
