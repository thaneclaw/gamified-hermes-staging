// Server-side constants — mirror of src/modes.ts and src/cards.ts minus the
// lucide-react icon references, which can't be imported outside a browser
// environment. When a mode or card is added, both files need the update.

export type CardKey = "interrupt" | "quickdebate" | "yesand";

export interface CardMeta {
  name: string;
  color: string;
  maxUses: number;
  needsTarget: boolean;
  duration: number;
}

export const CARDS: Record<CardKey, CardMeta> = {
  interrupt: {
    name: "SHUT THE !@#$ UP!!",
    color: "#ff2e6b",
    maxUses: 2,
    needsTarget: true,
    duration: 2200,
  },
  quickdebate: {
    name: "QUICK DEBATE",
    color: "#ffab00",
    maxUses: 1,
    needsTarget: true,
    duration: 4000,
  },
  yesand: {
    name: "YES AND",
    color: "#c239ff",
    maxUses: 1,
    needsTarget: false,
    duration: 2800,
  },
};

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
}

export interface ModeMeta {
  color: string;
  primary: ModePrimary;
  options?: VoteOption[];
}

export const MODES: Record<ModeKey, ModeMeta> = {
  buzz: { color: "#00e5ff", primary: "buzz" },
  redlight: { color: "#ffab00", primary: "position" },
  word: { color: "#00e5ff", primary: "typed-buzz" },
  bullish: {
    color: "#c6ff00",
    primary: "vote-anim",
    options: [
      { key: "bullish", label: "BULLISH", color: "#00e676" },
      { key: "bullshit", label: "BULL💩", color: "#ff1744" },
    ],
  },
  market: {
    color: "#00e676",
    primary: "vote-anim",
    options: [
      { key: "buy", label: "BUY", color: "#00e676" },
      { key: "sell", label: "SELL", color: "#ff1744" },
    ],
  },
  sentence: { color: "#c239ff", primary: "hidden-answer" },
  sentiment: { color: "#ff9500", primary: "sentiment-score" },
  fairfoul: {
    color: "#00b3ff",
    primary: "vote-anim",
    options: [
      { key: "fair", label: "FAIR", color: "#00e676" },
      { key: "foul", label: "FOUL", color: "#ff1744" },
    ],
  },
  // Sports-book style binary — same primary/options pattern as the other
  // vote-anim modes. See src/modes.ts for the full entry with icon +
  // emoji + arrow metadata that the contestant buttons read.
  overunder: {
    color: "#1de9b6",
    primary: "vote-anim",
    options: [
      { key: "over", label: "OVER", color: "#00e676" },
      { key: "under", label: "UNDER", color: "#ff1744" },
    ],
  },
  biggerdeal: { color: "#ff61c7", primary: "bigger-deal" },
  // Alias of biggerdeal — same vote kind, different branding. See
  // src/modes.ts for the richer client-side entry.
  whoyagot: { color: "#7c4dff", primary: "bigger-deal" },
  // Multi-choice + freeform "other" slot. See src/modes.ts for encoding
  // helpers and docs.
  whatstheplay: { color: "#ff5252", primary: "play-pick" },
  mvp: { color: "#ffd700", primary: "mvp-pick" },
};

export const DEFAULT_BIGGER_DEAL_CHOICES: readonly [string, string] = [
  "OPTION A",
  "OPTION B",
];

export const DEFAULT_PLAY_CHOICES: readonly string[] = [
  "OPTION A",
  "OPTION B",
  "OPTION C",
];

export const PLAY_MIN_CHOICES = 2;
export const PLAY_MAX_CHOICES = 6;

export const SENTIMENT_MIN = 1;
export const SENTIMENT_MAX = 10;

export const HOST_COLOR = "#ff2e6b";
export const PRODUCER_COLOR = "#c6ff00";
