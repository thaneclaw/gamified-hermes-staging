import { useState, useEffect, useRef, useCallback } from "react";
import {
  Hand,
  Swords,
  Sparkles,
  Trophy,
  Zap,
  RotateCcw,
  Radio,
  Film,
  Smartphone,
  Settings2,
  ArrowRight,
  X,
  Flag,
  Megaphone,
  ListOrdered,
  Tv,
  ClipboardList,
  Play,
  Square,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Type,
  Users,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Eye,
  EyeOff,
  Lock,
  Check,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════
//  CARD DEFINITIONS — add a new card by adding an entry here.
//  Each card has: name, icon, color, maxUses, needsTarget, and an
//  effect object that drives the OBS-overlay animation.
// ════════════════════════════════════════════════════════════════════
const CARDS = {
  interrupt: {
    name: "SHUT THE !@#$ UP!!",
    short: "STFU",
    icon: Hand,
    color: "#ff2e6b",
    maxUses: 2,
    needsTarget: true,
    description: "Cut off the current speaker. Their feed dims, yours jumps.",
    duration: 2200,
  },
  quickdebate: {
    name: "QUICK DEBATE",
    short: "QD",
    icon: Swords,
    color: "#ffab00",
    maxUses: 1,
    needsTarget: true,
    description: "30-second rapid-fire back-and-forth with a chosen rival.",
    duration: 4000,
  },
  doublepoints: {
    name: "2X POINTS",
    short: "2X",
    icon: Trophy,
    color: "#ffd700",
    maxUses: 1,
    needsTarget: false,
    description: "Your next correct answer is worth double.",
    duration: 2400,
  },
  wildcard: {
    name: "WILDCARD",
    short: "WC",
    icon: Sparkles,
    color: "#c239ff",
    maxUses: 1,
    needsTarget: false,
    description: "Mystery effect. Host decides what happens.",
    duration: 2800,
  },
};

// Six contestants — one per side slot in the studio layout.
// The `slot` field maps each contestant to a position on the background.
// ════════════════════════════════════════════════════════════════════
//  MODES — game mode definitions. Adding a new mode is a one-object change.
//  `primary` names what the contestant UI shows as its main input.
// ════════════════════════════════════════════════════════════════════
const MODES = {
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
};

// Seed queue of rounds. A round is a topic + a mode.
// phase: "pending" | "live" | "closed"
const INITIAL_ROUNDS = [
  {
    id: "r1",
    title: "Opening Shot",
    topic: "Describe yourself in three words — GO.",
    mode: "buzz",
    phase: "pending",
  },
  {
    id: "r2",
    title: "Hot Take #1",
    topic: "Pineapple belongs on pizza.",
    mode: "redlight",
    phase: "pending",
  },
  {
    id: "r3",
    title: "Lightning Round",
    topic: "Name a film that's better than the book.",
    mode: "buzz",
    phase: "pending",
  },
  {
    id: "r4",
    title: "Hot Take #2",
    topic: "Remote work has been a net negative for culture.",
    mode: "redlight",
    phase: "pending",
  },
  {
    id: "r5",
    title: "What's the Word?",
    topic: "One word that describes this week in tech.",
    mode: "word",
    phase: "pending",
  },
  {
    id: "r6",
    title: "Bullish or Bullshit?",
    topic: "AI will replace 50% of knowledge work by 2030.",
    mode: "bullish",
    phase: "pending",
  },
  {
    id: "r7",
    title: "Buy or Sell",
    topic: "Nvidia at current valuation.",
    mode: "market",
    phase: "pending",
  },
  {
    id: "r8",
    title: "Finish the Sentence",
    topic: "The most overrated startup of the last decade was…",
    mode: "sentence",
    phase: "pending",
  },
];

const INITIAL_CONTESTANTS = [
  { id: "a", name: "ALEX",   color: "#00e5ff", slot: "L1" },
  { id: "b", name: "SAM",    color: "#ff2e6b", slot: "L2" },
  { id: "c", name: "JORDAN", color: "#c6ff00", slot: "L3" },
  { id: "d", name: "RILEY",  color: "#ffd700", slot: "R1" },
  { id: "e", name: "TAYLOR", color: "#c239ff", slot: "R2" },
  { id: "f", name: "CASEY",  color: "#ff6b00", slot: "R3" },
];

// Pixel-measured slot positions on the studio backdrop (as percentages).
// L1/L2/L3 = left column top→bottom, R1/R2/R3 = right column top→bottom,
// CENTER = the big featured-speaker rectangle in the upper middle.
const SLOTS = {
  L1:     { left: "5.3%",  top: "5.7%",  width: "14.4%", height: "25.0%" },
  L2:     { left: "5.3%",  top: "36.2%", width: "14.4%", height: "24.8%" },
  L3:     { left: "5.3%",  top: "66.7%", width: "14.4%", height: "24.8%" },
  R1:     { left: "80.4%", top: "5.7%",  width: "14.5%", height: "25.0%" },
  R2:     { left: "80.6%", top: "36.2%", width: "14.3%", height: "24.9%" },
  R3:     { left: "80.5%", top: "66.7%", width: "14.4%", height: "24.9%" },
  CENTER: { left: "27.8%", top: "14.3%", width: "44.6%", height: "44.3%" },
};

// Studio backdrop — embedded as a data URL so this file is fully self-contained.
const BG_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAkGBwg

const EMOJIS = ["🔥", "💀", "😂", "🤯", "👀", "🎯", "❓", "💯"];

// Build starting card state for every contestant from the CARDS map
const freshCards = () =>
  Object.fromEntries(
    Object.entries(CARDS).map(([key, c]) => [key, { used: 0, max: c.maxUses }]),
  );

// ════════════════════════════════════════════════════════════════════

export default function GameShowDemo() {
  const [contestants, setContestants] = useState(() =>
    INITIAL_CONTESTANTS.map((c) => ({ ...c, cards: freshCards() })),
  );
  const [buzzer, setBuzzer] = useState(null); // { contestantId, t }
  const [reactions, setReactions] = useState([]); // [{id, emoji, contestantId, t}]
  const [activeEffect, setActiveEffect] = useState(null); // {type, by, target?, t, duration}
  const [eventLog, setEventLog] = useState([]);
  const [targetPicker, setTargetPicker] = useState(null); // {byId, cardKey}
  const [debateTick, setDebateTick] = useState(0); // drives the QD ping-pong
  const [positions, setPositions] = useState({}); // { [contestantId]: "green" | "red" }
  const [debateActive, setDebateActive] = useState(false);
  const [rounds, setRounds] = useState(INITIAL_ROUNDS);
  const [activeRoundId, setActiveRoundId] = useState(null); // id of "live" round
  const [view, setView] = useState("show"); // "show" | "producer"
  // ── Per-round "submissions" ─────────────────────────────────
  // votes: { [contestantId]: { kind, value, t } } where kind corresponds
  //        to the mode's primary; value is mode-specific:
  //  kind "typed-buzz"    → value: string (the typed word, also acts as buzz)
  //  kind "vote-anim"     → value: option key (e.g. "bullish" or "sell")
  //  kind "hidden-answer" → value: string (the sentence completion)
  const [votes, setVotes] = useState({});
  const [revealed, setRevealed] = useState({}); // contestantId → true
  // tile animation fires when a vote is first cast (drives one-shot effects)
  const [voteAnimSeq, setVoteAnimSeq] = useState({}); // contestantId → tick#
  const reactionSeq = useRef(0);

  // Derive active round + current mode from rounds state
  const activeRound = rounds.find((r) => r.id === activeRoundId) || null;
  const gameMode = activeRound?.mode || "buzz";

  // ── log helper ──────────────────────────────────────────────────
  const log = useCallback((text, color = "#f0f0f0") => {
    setEventLog((prev) =>
      [{ id: Date.now() + Math.random(), text, color, time: new Date() }, ...prev].slice(
        0,
        20,
      ),
    );
  }, []);

  // ── actions ─────────────────────────────────────────────────────
  const buzzIn = (contestantId) => {
    if (gameMode !== "buzz") return; // buzz is disabled in RLGL mode
    if (buzzer) return; // first-to-buzz wins until reset
    setBuzzer({ contestantId, t: Date.now() });
    const c = contestants.find((x) => x.id === contestantId);
    log(`${c.name} BUZZED IN`, c.color);
  };

  const resetBuzzer = () => {
    setBuzzer(null);
    log("buzzer reset", "#888");
  };

  // ── Red Light / Green Light actions ───────────────────────────
  const takePosition = (contestantId, color) => {
    if (gameMode !== "redlight") return;
    setPositions((p) => ({
      ...p,
      // tap same color to clear, otherwise set/flip
      [contestantId]: p[contestantId] === color ? null : color,
    }));
    const c = contestants.find((x) => x.id === contestantId);
    const already = positions[contestantId] === color;
    log(
      `${c.name} ${already ? "cleared position" : "went " + color.toUpperCase()}`,
      color === "green" ? "#00e676" : "#ff1744",
    );
  };

  const resetPositions = () => {
    setPositions({});
    setDebateActive(false);
    log("positions cleared", "#888");
  };

  const toggleDebate = () => {
    setDebateActive((d) => {
      log(d ? "debate ended" : "DEBATE STARTED", "#ffab00");
      return !d;
    });
  };

  // ── Mode-specific submissions ─────────────────────────────────
  // Typed buzz (What's the Word?) — doubles as "first to submit buzzes in"
  const submitTypedBuzz = (contestantId, text) => {
    if (!activeRound || gameMode !== "word") return;
    const value = (text || "").trim();
    if (!value) return;
    setVotes((v) => ({
      ...v,
      [contestantId]: { kind: "typed-buzz", value, t: Date.now() },
    }));
    // first submission also wins the buzz
    if (!buzzer) setBuzzer({ contestantId, t: Date.now() });
    const c = contestants.find((x) => x.id === contestantId);
    log(`${c.name} submitted "${value}"`, c.color);
  };

  // Two-option vote with animation (Bullish/BS, Buy/Sell)
  const castVote = (contestantId, optionKey) => {
    if (!activeRound) return;
    setVotes((v) => ({
      ...v,
      [contestantId]: { kind: "vote-anim", value: optionKey, t: Date.now() },
    }));
    setVoteAnimSeq((s) => ({ ...s, [contestantId]: (s[contestantId] || 0) + 1 }));
    const c = contestants.find((x) => x.id === contestantId);
    const mode = MODES[gameMode];
    const opt = mode.options?.find((o) => o.key === optionKey);
    log(`${c.name} → ${opt?.label || optionKey}`, opt?.color || c.color);
  };

  // Hidden answer (Finish the Sentence) — locked in privately, revealed later
  const submitHiddenAnswer = (contestantId, text) => {
    if (!activeRound || gameMode !== "sentence") return;
    const value = (text || "").trim();
    if (!value) return;
    setVotes((v) => ({
      ...v,
      [contestantId]: { kind: "hidden-answer", value, t: Date.now() },
    }));
    const c = contestants.find((x) => x.id === contestantId);
    log(`${c.name} locked in answer`, c.color);
  };

  const revealAnswer = (contestantId) => {
    if (!activeRound || gameMode !== "sentence") return;
    const vote = votes[contestantId];
    if (!vote || vote.kind !== "hidden-answer") return;
    setRevealed((r) => ({ ...r, [contestantId]: true }));
    const c = contestants.find((x) => x.id === contestantId);
    log(`${c.name} REVEALED: "${vote.value}"`, c.color);
  };

  const hostRevealAnswer = (contestantId) => revealAnswer(contestantId);
  const hostHideAnswer = (contestantId) => {
    setRevealed((r) => {
      const next = { ...r };
      delete next[contestantId];
      return next;
    });
  };

  // ── Round actions (host) ──────────────────────────────────────
  const triggerRound = (roundId) => {
    const r = rounds.find((x) => x.id === roundId);
    if (!r) return;
    // Clear transient state from previous round
    setBuzzer(null);
    setPositions({});
    setDebateActive(false);
    setVotes({});
    setRevealed({});
    setVoteAnimSeq({});
    // Close any other live round, then open this one
    setRounds((rs) =>
      rs.map((x) =>
        x.id === roundId
          ? { ...x, phase: "live" }
          : x.phase === "live"
            ? { ...x, phase: "closed" }
            : x,
      ),
    );
    setActiveRoundId(roundId);
    log(`ROUND LIVE — "${r.title}"`, MODES[r.mode].color);
  };

  const closeRound = () => {
    if (!activeRoundId) return;
    const r = rounds.find((x) => x.id === activeRoundId);
    setRounds((rs) =>
      rs.map((x) => (x.id === activeRoundId ? { ...x, phase: "closed" } : x)),
    );
    setActiveRoundId(null);
    setBuzzer(null);
    setPositions({});
    setDebateActive(false);
    setVotes({});
    setRevealed({});
    setVoteAnimSeq({});
    log(`round closed — "${r?.title}"`, "#888");
  };

  // ── Round actions (producer) ──────────────────────────────────
  const addRound = () => {
    const id = "r" + Date.now();
    setRounds((rs) => [
      ...rs,
      { id, title: "New Round", topic: "", mode: "buzz", phase: "pending" },
    ]);
  };

  const updateRound = (id, patch) => {
    setRounds((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteRound = (id) => {
    if (id === activeRoundId) return; // don't delete a live round
    setRounds((rs) => rs.filter((r) => r.id !== id));
  };

  const moveRound = (id, dir) => {
    setRounds((rs) => {
      const idx = rs.findIndex((r) => r.id === id);
      if (idx < 0) return rs;
      const swap = idx + dir;
      if (swap < 0 || swap >= rs.length) return rs;
      const next = [...rs];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const resetAllRounds = () => {
    setRounds((rs) => rs.map((r) => ({ ...r, phase: "pending" })));
    setActiveRoundId(null);
    setBuzzer(null);
    setPositions({});
    setDebateActive(false);
    log("all rounds reset to pending", "#888");
  };

  const sendReaction = (contestantId, emoji) => {
    const id = ++reactionSeq.current;
    setReactions((r) => [...r, { id, emoji, contestantId, t: Date.now() }]);
    // auto-cleanup after 2.2s
    setTimeout(() => {
      setReactions((r) => r.filter((x) => x.id !== id));
    }, 2200);
  };

  const tryPlayCard = (byId, cardKey) => {
    const card = CARDS[cardKey];
    const c = contestants.find((x) => x.id === byId);
    if (!c) return;
    if (c.cards[cardKey].used >= c.cards[cardKey].max) return;
    if (card.needsTarget) {
      setTargetPicker({ byId, cardKey });
      return;
    }
    fireCard(byId, cardKey, null);
  };

  const fireCard = (byId, cardKey, targetId) => {
    const card = CARDS[cardKey];
    setContestants((cs) =>
      cs.map((c) =>
        c.id === byId
          ? {
              ...c,
              cards: {
                ...c.cards,
                [cardKey]: { ...c.cards[cardKey], used: c.cards[cardKey].used + 1 },
              },
            }
          : c,
      ),
    );
    setActiveEffect({
      type: cardKey,
      by: byId,
      target: targetId,
      t: Date.now(),
      duration: card.duration,
    });
    const byName = contestants.find((x) => x.id === byId)?.name;
    const tName = targetId && contestants.find((x) => x.id === targetId)?.name;
    log(
      `${byName} played ${card.name}${tName ? " → " + tName : ""}`,
      card.color,
    );
    // buzzer interrupts clear it
    if (cardKey === "interrupt") setBuzzer(null);
    setTargetPicker(null);
    setTimeout(() => {
      setActiveEffect((ae) => (ae && ae.t === Date.now() ? null : ae));
    }, card.duration);
  };

  // auto-clear effect after its duration (using a separate tracker since
  // the setTimeout above compares Date.now() mismatched)
  useEffect(() => {
    if (!activeEffect) return;
    const handle = setTimeout(() => setActiveEffect(null), activeEffect.duration);
    return () => clearTimeout(handle);
  }, [activeEffect]);

  // quickdebate ping-pong indicator
  useEffect(() => {
    if (activeEffect?.type !== "quickdebate") return;
    const iv = setInterval(() => setDebateTick((t) => t + 1), 500);
    return () => clearInterval(iv);
  }, [activeEffect]);

  const updateContestantName = (id, name) => {
    setContestants((cs) =>
      cs.map((c) => (c.id === id ? { ...c, name: (name || "").toUpperCase() } : c)),
    );
  };

  const resetAll = () => {
    setContestants(INITIAL_CONTESTANTS.map((c) => ({ ...c, cards: freshCards() })));
    setBuzzer(null);
    setReactions([]);
    setActiveEffect(null);
    setEventLog([]);
    setRounds(INITIAL_ROUNDS);
    setActiveRoundId(null);
    setPositions({});
    setDebateActive(false);
    setVotes({});
    setRevealed({});
    setVoteAnimSeq({});
    log("full game reset", "#888");
  };

  const winner = buzzer && contestants.find((c) => c.id === buzzer.contestantId);
  const effectBy = activeEffect && contestants.find((c) => c.id === activeEffect.by);
  const effectTarget =
    activeEffect && contestants.find((c) => c.id === activeEffect.target);

  return (
    <div className="min-h-screen w-full" style={{ background: "#0a0a0a" }}>
      <StyleBlock />

      {/* ═══════════ HEADER ═══════════ */}
      <header className="border-b px-6 py-4" style={{ borderColor: "#1f1f1f" }}>
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center rounded-sm"
              style={{ background: "#ff2e6b" }}
            >
              <Radio className="w-5 h-5 text-black" strokeWidth={3} />
            </div>
            <div>
              <div
                className="text-2xl leading-none tracking-tight"
                style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.02em" }}
              >
                GAME SHOW CONTROL DECK
              </div>
              <div
                className="text-[11px] opacity-60 mt-1"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                OBS + VDO NINJA — INTERACTION LAYER DEMO
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider hover:opacity-80 transition"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              border: "1px solid #333",
              color: "#f0f0f0",
            }}
          >
            <RotateCcw className="w-3 h-3" /> reset all
          </button>
        </div>
      </header>

      {/* ═══════════ TAB BAR ═══════════ */}
      <div
        className="border-b px-6"
        style={{ borderColor: "#1f1f1f", background: "#0d0d0d" }}
      >
        <div className="max-w-[1400px] mx-auto flex items-center gap-1">
          {[
            { key: "show", label: "LIVE SHOW", icon: Tv, hint: "host + stream" },
            {
              key: "producer",
              label: "PRODUCER",
              icon: ClipboardList,
              hint: "pre-show · author rounds",
            },
          ].map((t) => {
            const active = view === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className="px-4 py-3 flex items-center gap-2 transition relative"
                style={{
                  background: active ? "#0a0a0a" : "transparent",
                  color: active ? "#f0f0f0" : "#888",
                  borderBottom: active ? "2px solid #ff2e6b" : "2px solid transparent",
                  marginBottom: "-1px",
                  fontFamily: "Anton, sans-serif",
                  letterSpacing: "0.08em",
                  fontSize: "13px",
                }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                {t.label}
                <span
                  className="text-[9px] opacity-50 ml-1"
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.15em",
                  }}
                >
                  · {t.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ MAIN ═══════════ */}
      {view === "producer" ? (
        <ProducerView
          rounds={rounds}
          activeRoundId={activeRoundId}
          addRound={addRound}
          updateRound={updateRound}
          deleteRound={deleteRound}
          moveRound={moveRound}
          resetAllRounds={resetAllRounds}
          contestants={contestants}
          updateContestantName={updateContestantName}
        />
      ) : (
        <LiveShowView
          contestants={contestants}
          buzzer={buzzer}
          winner={winner}
          reactions={reactions}
          activeEffect={activeEffect}
          effectBy={effectBy}
          effectTarget={effectTarget}
          debateTick={debateTick}
          gameMode={gameMode}
          positions={positions}
          debateActive={debateActive}
          activeRound={activeRound}
          rounds={rounds}
          buzzIn={buzzIn}
          sendReaction={sendReaction}
          tryPlayCard={tryPlayCard}
          fireCard={fireCard}
          targetPicker={targetPicker}
          setTargetPicker={setTargetPicker}
          takePosition={takePosition}
          resetBuzzer={resetBuzzer}
          triggerRound={triggerRound}
          closeRound={closeRound}
          resetPositions={resetPositions}
          toggleDebate={toggleDebate}
          eventLog={eventLog}
          votes={votes}
          revealed={revealed}
          voteAnimSeq={voteAnimSeq}
          submitTypedBuzz={submitTypedBuzz}
          castVote={castVote}
          submitHiddenAnswer={submitHiddenAnswer}
          revealAnswer={revealAnswer}
          hostRevealAnswer={hostRevealAnswer}
          hostHideAnswer={hostHideAnswer}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  LIVE SHOW VIEW — host's view during a running show
// ═══════════════════════════════════════════════════════════════════
function LiveShowView({
  contestants,
  buzzer,
  winner,
  reactions,
  activeEffect,
  effectBy,
  effectTarget,
  debateTick,
  gameMode,
  positions,
  debateActive,
  activeRound,
  rounds,
  buzzIn,
  sendReaction,
  tryPlayCard,
  fireCard,
  targetPicker,
  setTargetPicker,
  takePosition,
  resetBuzzer,
  triggerRound,
  closeRound,
  resetPositions,
  toggleDebate,
  eventLog,
  votes,
  revealed,
  voteAnimSeq,
  submitTypedBuzz,
  castVote,
  submitHiddenAnswer,
  revealAnswer,
  hostRevealAnswer,
  hostHideAnswer,
}) {
  return (
    <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* ── OBS overlay preview ───────────────────────────── */}
        <section>
          <SectionLabel icon={Film} label="OBS OVERLAY PREVIEW" sub="browser source — 1920×1080" />
          <OverlayPreview
            contestants={contestants}
            buzzer={buzzer}
            winner={winner}
            reactions={reactions}
            activeEffect={activeEffect}
            effectBy={effectBy}
            effectTarget={effectTarget}
            debateTick={debateTick}
            gameMode={gameMode}
            positions={positions}
            debateActive={debateActive}
            activeRound={activeRound}
            votes={votes}
            revealed={revealed}
            voteAnimSeq={voteAnimSeq}
          />
        </section>

        {/* ── Host panel + event log ───────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
          <div>
            <SectionLabel icon={Settings2} label="HOST CONTROL" sub="moderator panel" />
            <HostPanel
              buzzer={buzzer}
              winner={winner}
              resetBuzzer={resetBuzzer}
              contestants={contestants}
              onForceCard={(byId, cardKey) => {
                tryPlayCard(byId, cardKey);
              }}
              gameMode={gameMode}
              positions={positions}
              resetPositions={resetPositions}
              debateActive={debateActive}
              toggleDebate={toggleDebate}
              rounds={rounds}
              activeRound={activeRound}
              triggerRound={triggerRound}
              closeRound={closeRound}
              votes={votes}
              revealed={revealed}
              hostRevealAnswer={hostRevealAnswer}
              hostHideAnswer={hostHideAnswer}
            />
          </div>
          <div>
            <SectionLabel icon={Zap} label="EVENT LOG" sub="live" />
            <EventLog entries={eventLog} />
          </div>
        </section>

        {/* ── Contestant phone UIs ───────────────────────────── */}
        <section>
          <SectionLabel
            icon={Smartphone}
            label="CONTESTANT INTERFACES"
            sub="one per phone"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contestants.map((c) => (
              <ContestantPhone
                key={c.id}
                contestant={c}
                isBuzzed={buzzer?.contestantId === c.id}
                anyBuzzed={!!buzzer}
                onBuzz={() => buzzIn(c.id)}
                onReact={(e) => sendReaction(c.id, e)}
                onPlayCard={(k) => tryPlayCard(c.id, k)}
                targetPicker={targetPicker?.byId === c.id ? targetPicker : null}
                onChooseTarget={(tid) =>
                  fireCard(targetPicker.byId, targetPicker.cardKey, tid)
                }
                onCancelTarget={() => setTargetPicker(null)}
                otherContestants={contestants.filter((x) => x.id !== c.id)}
                gameMode={gameMode}
                position={positions[c.id] || null}
                onTakePosition={(color) => takePosition(c.id, color)}
                activeRound={activeRound}
                vote={votes[c.id] || null}
                revealed={!!revealed[c.id]}
                onSubmitTypedBuzz={(text) => submitTypedBuzz(c.id, text)}
                onCastVote={(key) => castVote(c.id, key)}
                onSubmitHiddenAnswer={(text) => submitHiddenAnswer(c.id, text)}
                onSelfReveal={() => revealAnswer(c.id)}
              />
            ))}
          </div>
        </section>

        {/* ── Deployment footer ───────────────────────── */}
        <DeploymentGuide />
      </main>
  );
}

/* ════════════════════════════════════════════════════════════════════
   OVERLAY PREVIEW — what goes into the OBS browser source
   ════════════════════════════════════════════════════════════════════ */
function OverlayPreview({
  contestants,
  buzzer,
  winner,
  reactions,
  activeEffect,
  effectBy,
  effectTarget,
  debateTick,
  gameMode,
  positions,
  debateActive,
  activeRound,
  votes,
  revealed,
  voteAnimSeq,
}) {
  const POS_GREEN = "#00e676";
  const POS_RED = "#ff1744";
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "1654/936",
        backgroundImage: `url(${BG_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid #222",
      }}
    >
      {/* Scan-line atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px)",
          mixBlendMode: "overlay",
          opacity: 0.5,
        }}
      />

      {/* Simulated video feeds, positioned absolutely over the studio backdrop slots */}
      {contestants.map((c) => {
        const slot = SLOTS[c.slot];
        const isWinner = winner?.id === c.id;
        const isTarget = effectTarget?.id === c.id;
        const isBy = effectBy?.id === c.id;
        const interrupted = activeEffect?.type === "interrupt" && isTarget;
        const debating =
          activeEffect?.type === "quickdebate" && (isBy || isTarget);
        const debateActiveQD =
          debating &&
          ((debateTick % 2 === 0 && isBy) || (debateTick % 2 === 1 && isTarget));
        // RLGL position — green or red, or null
        const position = gameMode === "redlight" ? positions[c.id] : null;
        const posColor =
          position === "green" ? POS_GREEN : position === "red" ? POS_RED : null;

        // Mode-specific per-tile data
        const vote = votes?.[c.id] || null;
        const voteTick = voteAnimSeq?.[c.id] || 0;
        const modeCfg = MODES[gameMode] || null;
        const voteOption =
          vote?.kind === "vote-anim" && modeCfg?.options
            ? modeCfg.options.find((o) => o.key === vote.value)
            : null;
        const isTyped = vote?.kind === "typed-buzz";
        const isHidden = vote?.kind === "hidden-answer";
        const isRevealed = isHidden && revealed?.[c.id];

        return (
          <div
            key={c.id}
            className="absolute flex flex-col overflow-hidden rounded-lg"
            style={{
              left: slot.left,
              top: slot.top,
              width: slot.width,
              height: slot.height,
              outline: posColor
                ? `4px solid ${posColor}`
                : isWinner
                  ? `4px solid ${c.color}`
                  : debating
                    ? `2px solid ${CARDS.quickdebate.color}`
                    : "1px solid rgba(255,255,255,0.2)",
              outlineOffset: "0",
              boxShadow: posColor
                ? `0 0 30px ${posColor}, inset 0 0 40px ${posColor}33`
                : isWinner
                  ? `0 0 35px ${c.color}, 0 0 70px ${c.color}99, inset 0 0 30px ${c.color}33`
                  : debateActiveQD
                    ? `0 0 25px ${CARDS.quickdebate.color}`
                    : "0 4px 12px rgba(0,0,0,0.5)",
              animation: isWinner ? "buzzPulse 0.7s ease-out" : undefined,
              opacity: interrupted ? 0.25 : debating && !debateActiveQD ? 0.45 : 1,
              transition: "opacity 0.3s, box-shadow 0.3s",
              background: posColor
                ? `linear-gradient(135deg, ${posColor}55 0%, #0a0a0a 85%)`
                : `linear-gradient(135deg, ${c.color}33 0%, #0a0a0a 80%)`,
            }}
          >
            {/* "Video" placeholder */}
            <div className="flex-1 flex items-center justify-center relative">
              <div
                className="opacity-50"
                style={{
                  fontFamily: "Anton, sans-serif",
                  fontSize: "clamp(32px, 5vw, 72px)",
                  color: c.color,
                  letterSpacing: "0.02em",
                }}
              >
                {c.name[0]}
              </div>
              {/* Reactions floating up from this tile */}
              {reactions
                .filter((r) => r.contestantId === c.id)
                .map((r) => (
                  <div
                    key={r.id}
                    className="absolute text-3xl"
                    style={{
                      bottom: "20%",
                      left: `${20 + ((r.id * 13) % 60)}%`,
                      animation: "floatUp 2.2s ease-out forwards",
                    }}
                  >
                    {r.emoji}
                  </div>
                ))}
            </div>

            {/* Lower third name bar */}
            <div
              className="px-2 py-1 flex items-center justify-between"
              style={{
                background: c.color,
                color: "#000",
                fontFamily: "Anton, sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              <span className="text-xs truncate">{c.name}</span>
              <span
                className="text-[8px] opacity-70 flex-shrink-0"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                LIVE
              </span>
            </div>

            {/* Per-tile effect overlays */}
            {interrupted && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: "flashRed 0.4s ease-out" }}
              >
                <div
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "clamp(18px, 3vw, 36px)",
                    color: CARDS.interrupt.color,
                    textShadow: `0 0 15px ${CARDS.interrupt.color}`,
                    transform: "rotate(-8deg)",
                  }}
                >
                  SHH!
                </div>
              </div>
            )}
            {/* BUZZED pill + ring burst — only on the winner's tile */}
            {isWinner && (
              <>
                <div
                  key={buzzer.t}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 0 2px ${c.color}`,
                    animation: "buzzRing 0.8s ease-out forwards",
                    opacity: 0,
                  }}
                />
                <div
                  className="absolute top-1 left-1 px-1.5 py-0.5 flex items-center gap-1"
                  style={{
                    background: c.color,
                    color: "#000",
                    fontFamily: "Anton, sans-serif",
                    fontSize: "10px",
                    letterSpacing: "0.12em",
                    boxShadow: `0 0 10px ${c.color}`,
                    animation: "slamIn 0.4s cubic-bezier(0.2, 1.5, 0.4, 1)",
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "#000" }}
                  />
                  BUZZED
                </div>
              </>
            )}

            {/* RLGL position badge — corner pill */}
            {posColor && (
              <div
                className="absolute top-1 left-1 px-1.5 py-0.5 flex items-center gap-1"
                style={{
                  background: posColor,
                  color: "#000",
                  fontFamily: "Anton, sans-serif",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  boxShadow: `0 0 10px ${posColor}`,
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "#000" }}
                />
                {position === "green" ? "GREEN" : "RED"}
              </div>
            )}

            {/* What's the Word? — show locked-in word as banner */}
            {isTyped && (
              <div
                className="absolute left-1 right-1 flex items-center justify-center px-2 py-1"
                style={{
                  bottom: "30%",
                  background: "#000000ee",
                  border: `2px solid ${c.color}`,
                  boxShadow: `0 0 15px ${c.color}80`,
                  animation: "slamIn 0.4s cubic-bezier(0.2, 1.5, 0.4, 1)",
                }}
              >
                <span
                  className="truncate"
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "clamp(14px, 1.8vw, 22px)",
                    color: c.color,
                    letterSpacing: "0.04em",
                    textShadow: `0 0 8px ${c.color}`,
                  }}
                >
                  "{vote.value}"
                </span>
              </div>
            )}

            {/* Bullish/BS + Buy/Sell — animated arrow + big label */}
            {voteOption && (
              <div
                key={voteTick}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                {/* whole-tile color flash */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: voteOption.color,
                    opacity: 0.3,
                    animation: "flashOnce 0.6s ease-out",
                  }}
                />
                {/* arrow travels across the tile */}
                <div
                  className="absolute"
                  style={{
                    animation:
                      voteOption.arrow === "up"
                        ? "arrowUp 1.4s cubic-bezier(0.2,1,0.3,1) forwards"
                        : "arrowDown 1.4s cubic-bezier(0.2,1,0.3,1) forwards",
                  }}
                >
                  {voteOption.arrow === "up" ? (
                    <TrendingUp
                      className="w-16 h-16"
                      style={{
                        color: voteOption.color,
                        filter: `drop-shadow(0 0 12px ${voteOption.color})`,
                      }}
                      strokeWidth={3}
                    />
                  ) : (
                    <TrendingDown
                      className="w-16 h-16"
                      style={{
                        color: voteOption.color,
                        filter: `drop-shadow(0 0 12px ${voteOption.color})`,
                      }}
                      strokeWidth={3}
                    />
                  )}
                </div>
                {/* Label slam */}
                <div
                  className="relative"
                  style={{
                    animation: "slamIn 0.35s cubic-bezier(0.2,1.5,0.4,1)",
                  }}
                >
                  <div
                    className="px-2 py-0.5"
                    style={{
                      background: voteOption.color,
                      color: "#000",
                      fontFamily: "Anton, sans-serif",
                      fontSize: "clamp(14px, 2vw, 24px)",
                      letterSpacing: "0.06em",
                      boxShadow: `4px 4px 0 #000, 0 0 25px ${voteOption.color}`,
                      transform: "rotate(-4deg)",
                    }}
                  >
                    {voteOption.label}
                  </div>
                </div>
              </div>
            )}

            {/* Finish the Sentence — locked badge or revealed answer */}
            {isHidden && !isRevealed && (
              <div
                className="absolute top-1 right-1 px-1.5 py-0.5 flex items-center gap-1"
                style={{
                  background: "#000000cc",
                  border: `1px solid ${MODES.sentence.color}`,
                  color: MODES.sentence.color,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "9px",
                  letterSpacing: "0.15em",
                }}
              >
                <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
                LOCKED
              </div>
            )}
            {isRevealed && (
              <div
                className="absolute left-1 right-1 px-2 py-1.5"
                style={{
                  bottom: "28%",
                  background: "#000000ee",
                  border: `2px solid ${MODES.sentence.color}`,
                  boxShadow: `0 0 20px ${MODES.sentence.color}80`,
                  animation: "slamIn 0.4s cubic-bezier(0.2, 1.5, 0.4, 1)",
                }}
              >
                <div
                  className="text-[9px] tracking-widest mb-0.5"
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    color: MODES.sentence.color,
                  }}
                >
                  REVEALED
                </div>
                <div
                  className="leading-tight"
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "clamp(11px, 1.3vw, 16px)",
                    color: "#f0f0f0",
                    letterSpacing: "0.02em",
                  }}
                >
                  {vote.value}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Featured/center tile — shows active speaker OR RLGL tally ───────────── */}
      {gameMode === "redlight" ? (
        <RLGLCenterTile
          contestants={contestants}
          positions={positions}
          debateActive={debateActive}
          POS_GREEN={POS_GREEN}
          POS_RED={POS_RED}
        />
      ) : (
        <div
          className="absolute flex flex-col overflow-hidden rounded-xl"
          style={{
            left: SLOTS.CENTER.left,
            top: SLOTS.CENTER.top,
            width: SLOTS.CENTER.width,
            height: SLOTS.CENTER.height,
            outline: winner
              ? `4px solid ${winner.color}`
              : "1px solid rgba(255,255,255,0.2)",
            outlineOffset: "0",
            boxShadow: winner
              ? `0 0 50px ${winner.color}80`
              : "0 8px 24px rgba(0,0,0,0.6)",
            background: winner
              ? `linear-gradient(135deg, ${winner.color}44 0%, #0a0a0a 70%)`
              : "linear-gradient(135deg, #1a1a1a 0%, #050505 70%)",
            transition: "outline-color 0.3s, box-shadow 0.3s",
          }}
        >
          <div className="flex-1 flex items-center justify-center relative">
            {winner ? (
              <div
                className="flex flex-col items-center gap-2"
                style={{ animation: "slamIn 0.4s cubic-bezier(0.2, 1.4, 0.4, 1)" }}
              >
                <div
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "clamp(48px, 8vw, 120px)",
                    color: winner.color,
                    letterSpacing: "0.02em",
                    textShadow: `0 0 30px ${winner.color}, 4px 4px 0 #000`,
                  }}
                >
                  {winner.name}
                </div>
                <div
                  className="px-3 py-0.5"
                  style={{
                    background: winner.color,
                    color: "#000",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                  }}
                >
                  ON THE HOT SEAT
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 opacity-40">
                <div
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "clamp(24px, 4vw, 48px)",
                    color: "#f0f0f0",
                    letterSpacing: "0.1em",
                  }}
                >
                  MAIN STAGE
                </div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "10px",
                    color: "#f0f0f0",
                    letterSpacing: "0.2em",
                  }}
                >
                  — WAITING FOR BUZZ —
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DEBATE banner (RLGL mode) ── */}
      {gameMode === "redlight" && debateActive && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-3 py-1"
          style={{
            top: "2%",
            background: "#ffab00",
            color: "#000",
            fontFamily: "Anton, sans-serif",
            fontSize: "clamp(12px, 1.5vw, 20px)",
            letterSpacing: "0.2em",
            boxShadow: "0 0 20px #ffab00, 4px 4px 0 #000",
            animation: "pulseGlow 1.2s ease-in-out infinite",
          }}
        >
          ⚔ DEBATE IN PROGRESS ⚔
        </div>
      )}

      {/* ── INTERRUPT full-screen effect ── */}
      {activeEffect?.type === "interrupt" && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ animation: "shake 0.4s" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, #ff2e6b44 50%, transparent 100%)",
              animation: "flashOnce 0.5s ease-out",
            }}
          />
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "88px",
              color: "#fff",
              letterSpacing: "0.02em",
              textShadow: "4px 4px 0 #ff2e6b, 8px 8px 0 #000",
              animation: "slamIn 0.3s cubic-bezier(0.2, 1.5, 0.4, 1)",
              textAlign: "center",
              lineHeight: 0.95,
            }}
          >
            SHUT THE<br />!@#$ UP!!
          </div>
        </div>
      )}

      {/* ── QUICK DEBATE overlay ── */}
      {activeEffect?.type === "quickdebate" && effectBy && effectTarget && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${effectBy.color}22 0%, transparent 40%, transparent 60%, ${effectTarget.color}22 100%)`,
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-4"
            style={{ animation: "slamIn 0.4s cubic-bezier(0.2, 1.4, 0.4, 1)" }}
          >
            <span style={{ fontFamily: "Anton, sans-serif", fontSize: "28px", color: effectBy.color }}>
              {effectBy.name}
            </span>
            <span
              style={{
                fontFamily: "Anton, sans-serif",
                fontSize: "96px",
                color: CARDS.quickdebate.color,
                textShadow: `0 0 30px ${CARDS.quickdebate.color}, 4px 4px 0 #000`,
              }}
            >
              VS
            </span>
            <span style={{ fontFamily: "Anton, sans-serif", fontSize: "28px", color: effectTarget.color }}>
              {effectTarget.name}
            </span>
          </div>
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-2 pointer-events-none"
            style={{
              background: CARDS.quickdebate.color,
              color: "#000",
              fontFamily: "Anton, sans-serif",
              letterSpacing: "0.08em",
              fontSize: "20px",
            }}
          >
            QUICK DEBATE — 30s
          </div>
        </>
      )}

      {/* ── 2X POINTS overlay ── */}
      {activeEffect?.type === "doublepoints" && effectBy && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "140px",
              color: CARDS.doublepoints.color,
              textShadow: `0 0 40px ${CARDS.doublepoints.color}, 6px 6px 0 #000`,
              animation: "slamIn 0.4s cubic-bezier(0.2, 1.5, 0.4, 1), pulseGlow 1.2s ease-in-out infinite",
            }}
          >
            2X
          </div>
          <div
            className="absolute bottom-12 px-6 py-2"
            style={{
              background: CARDS.doublepoints.color,
              color: "#000",
              fontFamily: "Anton, sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            {effectBy.name} — DOUBLE POINTS
          </div>
        </div>
      )}

      {/* ── WILDCARD overlay ── */}
      {activeEffect?.type === "wildcard" && effectBy && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "conic-gradient(from 0deg, #c239ff, #ff2e6b, #ffab00, #c6ff00, #00e5ff, #c239ff)",
              opacity: 0.25,
              animation: "spin 2.8s linear",
            }}
          />
          {["✨", "🎲", "🌀", "💫", "⚡", "🎰"].map((e, i) => (
            <div
              key={i}
              className="absolute text-5xl"
              style={{
                left: `${15 + i * 14}%`,
                top: "50%",
                animation: `floatUp 2.8s ease-out ${i * 0.08}s`,
              }}
            >
              {e}
            </div>
          ))}
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "110px",
              color: "#fff",
              textShadow: `0 0 40px ${CARDS.wildcard.color}, 6px 6px 0 ${CARDS.wildcard.color}`,
              animation: "slamIn 0.4s cubic-bezier(0.2, 1.5, 0.4, 1)",
              letterSpacing: "0.04em",
            }}
          >
            WILDCARD
          </div>
        </div>
      )}

      {/* Corner status HUD */}
      <div
        className="absolute top-3 left-3 px-2 py-1 text-[10px] flex items-center gap-1.5"
        style={{
          fontFamily: "JetBrains Mono, monospace",
          background: "#000000aa",
          color: "#f0f0f0",
          border: "1px solid #333",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: "#ff2e6b", animation: "pulseDot 1.2s infinite" }}
        />
        REC
      </div>

      {/* Topic lower-third — appears whenever a round is live */}
      {activeRound && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ bottom: "1.5%", width: "56%" }}
        >
          <div
            className="flex items-stretch shadow-lg"
            style={{
              background: "#000000dd",
              border: `1px solid ${MODES[activeRound.mode].color}`,
              boxShadow: `0 0 20px ${MODES[activeRound.mode].color}66`,
            }}
          >
            <div
              className="flex items-center px-2"
              style={{
                background: MODES[activeRound.mode].color,
                fontFamily: "Anton, sans-serif",
                fontSize: "clamp(8px, 0.9vw, 11px)",
                letterSpacing: "0.2em",
                color: "#000",
              }}
            >
              {activeRound.title.toUpperCase()}
            </div>
            <div
              className="flex-1 px-3 py-1.5 truncate"
              style={{
                fontFamily: "Anton, sans-serif",
                fontSize: "clamp(10px, 1.2vw, 16px)",
                letterSpacing: "0.02em",
                color: "#f0f0f0",
              }}
            >
              {activeRound.topic || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RLGL CENTER TILE — split green/red team view for Red Light/Green Light
   ════════════════════════════════════════════════════════════════════ */
function RLGLCenterTile({ contestants, positions, debateActive, POS_GREEN, POS_RED }) {
  const greens = contestants.filter((c) => positions[c.id] === "green");
  const reds = contestants.filter((c) => positions[c.id] === "red");

  const side = (label, color, list) => (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-1 relative px-2"
      style={{
        background: `linear-gradient(${label === "GREEN" ? "135deg" : "225deg"}, ${color}22 0%, transparent 80%)`,
      }}
    >
      <div
        className="text-[9px] tracking-[0.25em]"
        style={{ fontFamily: "JetBrains Mono, monospace", color }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Anton, sans-serif",
          fontSize: "clamp(44px, 7vw, 100px)",
          color,
          lineHeight: 1,
          textShadow: `0 0 25px ${color}, 3px 3px 0 #000`,
        }}
      >
        {list.length}
      </div>
      <div className="flex flex-wrap justify-center gap-1 max-w-full">
        {list.map((c) => (
          <span
            key={c.id}
            className="px-1.5 py-[1px]"
            style={{
              background: c.color,
              color: "#000",
              fontFamily: "Anton, sans-serif",
              fontSize: "9px",
              letterSpacing: "0.04em",
            }}
          >
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="absolute flex overflow-hidden rounded-xl"
      style={{
        left: SLOTS.CENTER.left,
        top: SLOTS.CENTER.top,
        width: SLOTS.CENTER.width,
        height: SLOTS.CENTER.height,
        outline: debateActive
          ? "3px solid #ffab00"
          : "1px solid rgba(255,255,255,0.2)",
        boxShadow: debateActive
          ? "0 0 40px #ffab0080"
          : "0 8px 24px rgba(0,0,0,0.6)",
        background:
          "linear-gradient(135deg, #1a1a1a 0%, #050505 70%)",
        transition: "outline-color 0.3s, box-shadow 0.3s",
      }}
    >
      {side("GREEN", POS_GREEN, greens)}
      <div
        className="w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
        }}
      />
      {side("RED", POS_RED, reds)}

      {/* top header */}
      <div
        className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] opacity-70 tracking-[0.25em]"
        style={{ fontFamily: "JetBrains Mono, monospace", color: "#f0f0f0" }}
      >
        WHERE DO YOU STAND?
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MODE-SPECIFIC INPUTS (used inside ContestantPhone)
   ════════════════════════════════════════════════════════════════════ */

// What's the Word?  Typed word that IS the buzz
function TypedBuzzInput({ color, mode, vote, anyBuzzed, isBuzzed, onSubmit }) {
  const [text, setText] = useState("");
  const locked = !!vote;

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onSubmit(v);
  };

  if (locked) {
    return (
      <div
        className="relative w-full py-4 px-3 flex flex-col items-center justify-center gap-1"
        style={{
          background: isBuzzed ? color : "#000",
          border: `3px solid ${color}`,
          color: isBuzzed ? "#000" : color,
          boxShadow: isBuzzed ? `inset 0 0 30px ${color}80` : `4px 4px 0 ${color}`,
        }}
      >
        <span
          className="text-[9px] tracking-[0.25em] opacity-70"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {isBuzzed ? "✓ FIRST IN" : "SUBMITTED"}
        </span>
        <span
          className="text-center"
          style={{
            fontFamily: "Anton, sans-serif",
            fontSize: "22px",
            letterSpacing: "0.04em",
          }}
        >
          "{vote.value}"
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={mode.placeholder || "type here…"}
        maxLength={mode.maxLength || 60}
        disabled={anyBuzzed && !isBuzzed}
        className="w-full px-3 py-3 outline-none"
        style={{
          background: "#000",
          border: `2px solid ${color}60`,
          fontFamily: "Anton, sans-serif",
          fontSize: "22px",
          color: "#f0f0f0",
          letterSpacing: "0.04em",
        }}
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="w-full py-3 active:translate-y-0.5 transition disabled:opacity-30"
        style={{
          background: color,
          color: "#000",
          border: `3px solid ${color}`,
          fontFamily: "Anton, sans-serif",
          fontSize: "18px",
          letterSpacing: "0.1em",
          boxShadow: `4px 4px 0 ${color}`,
        }}
      >
        BUZZ IN
      </button>
    </div>
  );
}

// Bullish/BS, Buy/Sell — two-option vote with animation trigger
function VoteAnimButtons({ mode, vote, onCast }) {
  const current = vote?.value || null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {mode.options.map((o) => {
        const picked = current === o.key;
        const dimmed = current && !picked;
        return (
          <button
            key={o.key}
            onClick={() => onCast(o.key)}
            className="relative py-4 px-2 active:translate-y-0.5 transition flex flex-col items-center justify-center gap-0.5"
            style={{
              background: picked ? o.color : "#000",
              border: `3px solid ${o.color}`,
              color: picked ? "#000" : o.color,
              opacity: dimmed ? 0.35 : 1,
              fontFamily: "Anton, sans-serif",
              boxShadow: picked
                ? `inset 0 0 20px ${o.color}80, 0 0 20px ${o.color}80`
                : `4px 4px 0 ${o.color}`,
            }}
          >
            <span style={{ fontSize: "22px", letterSpacing: "0.04em" }}>
              {o.label}
            </span>
            <span style={{ fontSize: "20px" }}>{o.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}

// Finish the Sentence — lock in privately, self-reveal later
function HiddenAnswerInput({ color, mode, vote, revealed, onSubmit, onReveal }) {
  const [text, setText] = useState(vote?.value || "");
  const locked = !!vote;

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onSubmit(v);
  };

  if (locked && revealed) {
    return (
      <div
        className="relative w-full py-3 px-3"
        style={{
          background: color,
          border: `3px solid ${color}`,
          color: "#000",
          boxShadow: `inset 0 0 20px ${color}80`,
        }}
      >
        <div
          className="text-[9px] tracking-[0.25em] mb-1 opacity-80"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          ON AIR
        </div>
        <div
          style={{
            fontFamily: "Anton, sans-serif",
            fontSize: "15px",
            letterSpacing: "0.02em",
            lineHeight: 1.2,
          }}
        >
          {vote.value}
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="relative w-full py-3 px-3 flex items-center justify-between gap-2"
          style={{
            background: "#000",
            border: `2px solid ${color}`,
            color,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
            <div
              className="truncate"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                letterSpacing: "0.05em",
                opacity: 0.5,
              }}
              title={vote.value}
            >
              {"•".repeat(Math.min(vote.value.length, 24))}
            </div>
          </div>
          <span
            className="text-[9px] tracking-widest opacity-70 flex-shrink-0"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            LOCKED
          </span>
        </div>
        <button
          onClick={onReveal}
          className="w-full py-3 flex items-center justify-center gap-1.5 active:translate-y-0.5 transition"
          style={{
            background: "#000",
            border: `3px solid ${color}`,
            color,
            fontFamily: "Anton, sans-serif",
            fontSize: "16px",
            letterSpacing: "0.1em",
            boxShadow: `4px 4px 0 ${color}`,
          }}
        >
          <Eye className="w-4 h-4" strokeWidth={2.5} />
          REVEAL
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={mode.placeholder || "finish the sentence…"}
        maxLength={mode.maxLength || 80}
        rows={2}
        className="w-full px-3 py-2 outline-none resize-none"
        style={{
          background: "#000",
          border: `2px solid ${color}60`,
          fontFamily: "Anton, sans-serif",
          fontSize: "16px",
          color: "#f0f0f0",
          letterSpacing: "0.02em",
          lineHeight: 1.3,
        }}
      />
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] opacity-50"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          {text.length}/{mode.maxLength || 80}
        </span>
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="px-4 py-2 flex items-center gap-1.5 active:translate-y-0.5 transition disabled:opacity-30"
          style={{
            background: color,
            color: "#000",
            fontFamily: "Anton, sans-serif",
            fontSize: "14px",
            letterSpacing: "0.1em",
            boxShadow: `3px 3px 0 ${color}`,
          }}
        >
          <Lock className="w-3 h-3" strokeWidth={3} />
          LOCK IN
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CONTESTANT PHONE UI
   ════════════════════════════════════════════════════════════════════ */
function ContestantPhone({
  contestant: c,
  isBuzzed,
  anyBuzzed,
  onBuzz,
  onReact,
  onPlayCard,
  targetPicker,
  onChooseTarget,
  onCancelTarget,
  otherContestants,
  gameMode,
  position,
  onTakePosition,
  activeRound,
  vote,
  revealed,
  onSubmitTypedBuzz,
  onCastVote,
  onSubmitHiddenAnswer,
  onSelfReveal,
}) {
  const POS_GREEN = "#00e676";
  const POS_RED = "#ff1744";
  const roundLive = !!activeRound;
  const primary = MODES[gameMode]?.primary;
  return (
    <div
      className="relative rounded-2xl overflow-hidden p-4 flex flex-col gap-3"
      style={{
        background: "#111",
        border: position
          ? `2px solid ${position === "green" ? POS_GREEN : POS_RED}`
          : `2px solid ${c.color}40`,
        boxShadow: position
          ? `0 0 30px ${position === "green" ? POS_GREEN : POS_RED}80`
          : isBuzzed
            ? `0 0 30px ${c.color}80`
            : "none",
        transition: "box-shadow 0.3s, border-color 0.3s",
      }}
    >
      {/* name bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{
              background: c.color,
              color: "#000",
              fontFamily: "Anton, sans-serif",
            }}
          >
            {c.name[0]}
          </div>
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "18px",
              letterSpacing: "0.04em",
              color: c.color,
            }}
          >
            {c.name}
          </div>
        </div>
        <div
          className="text-[9px] opacity-50 uppercase"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          contestant
        </div>
      </div>

      {/* Topic card — visible whenever a round is live */}
      {roundLive && (
        <div
          className="px-2.5 py-2"
          style={{
            background: "#0a0a0a",
            border: `1px solid ${MODES[activeRound.mode].color}55`,
            borderLeft: `3px solid ${MODES[activeRound.mode].color}`,
          }}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span
              className="text-[9px] tracking-widest"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                color: MODES[activeRound.mode].color,
              }}
            >
              {activeRound.title.toUpperCase()}
            </span>
            <span
              className="text-[8px] opacity-60"
              style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
            >
              {MODES[activeRound.mode].name}
            </span>
          </div>
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "14px",
              color: "#f0f0f0",
              letterSpacing: "0.02em",
              lineHeight: 1.2,
            }}
          >
            {activeRound.topic || "—"}
          </div>
        </div>
      )}

      {/* Primary action — dispatches on the live round's mode */}
      {!roundLive ? (
        <div
          className="relative w-full py-6 flex flex-col items-center justify-center gap-1"
          style={{
            background: "#0a0a0a",
            border: "2px dashed #333",
            fontFamily: "JetBrains Mono, monospace",
            color: "#555",
          }}
        >
          <span className="text-[10px] tracking-[0.25em]">STANDBY</span>
          <span className="text-[9px] opacity-60">waiting for host to open round</span>
        </div>
      ) : primary === "buzz" ? (
        <button
          onClick={onBuzz}
          disabled={anyBuzzed}
          className="relative w-full py-6 active:translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isBuzzed ? c.color : "#000",
            border: `3px solid ${c.color}`,
            fontFamily: "Anton, sans-serif",
            fontSize: "36px",
            color: isBuzzed ? "#000" : c.color,
            letterSpacing: "0.06em",
            boxShadow: isBuzzed ? `inset 0 0 30px ${c.color}80` : `4px 4px 0 ${c.color}`,
          }}
        >
          {isBuzzed ? "✓ IN" : "BUZZ"}
        </button>
      ) : primary === "position" ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "green", label: "GREEN", color: POS_GREEN },
            { key: "red", label: "RED", color: POS_RED },
          ].map((b) => {
            const picked = position === b.key;
            const dimmed = position && !picked;
            return (
              <button
                key={b.key}
                onClick={() => onTakePosition(b.key)}
                className="relative py-5 active:translate-y-0.5 transition"
                style={{
                  background: picked ? b.color : "#000",
                  border: `3px solid ${b.color}`,
                  fontFamily: "Anton, sans-serif",
                  fontSize: "24px",
                  color: picked ? "#000" : b.color,
                  letterSpacing: "0.06em",
                  opacity: dimmed ? 0.35 : 1,
                  boxShadow: picked
                    ? `inset 0 0 20px ${b.color}80, 0 0 20px ${b.color}80`
                    : `4px 4px 0 ${b.color}`,
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      ) : primary === "typed-buzz" ? (
        <TypedBuzzInput
          color={c.color}
          mode={MODES[gameMode]}
          vote={vote}
          anyBuzzed={anyBuzzed}
          isBuzzed={isBuzzed}
          onSubmit={onSubmitTypedBuzz}
        />
      ) : primary === "vote-anim" ? (
        <VoteAnimButtons
          mode={MODES[gameMode]}
          vote={vote}
          onCast={onCastVote}
        />
      ) : primary === "hidden-answer" ? (
        <HiddenAnswerInput
          color={c.color}
          mode={MODES[gameMode]}
          vote={vote}
          revealed={revealed}
          onSubmit={onSubmitHiddenAnswer}
          onReveal={onSelfReveal}
        />
      ) : null}

      {/* Emoji row */}
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="aspect-square text-lg hover:bg-white/10 transition rounded"
            style={{ background: "#1a1a1a" }}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(CARDS).map(([key, card]) => {
          const state = c.cards[key];
          const out = state.used >= state.max;
          const Icon = card.icon;
          return (
            <button
              key={key}
              onClick={() => onPlayCard(key)}
              disabled={out}
              className="relative px-2 py-2 text-left flex flex-col gap-1 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-transform"
              style={{
                background: "#0a0a0a",
                border: `1.5px solid ${card.color}`,
                boxShadow: out ? "none" : `3px 3px 0 ${card.color}`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3 h-3" style={{ color: card.color }} strokeWidth={2.5} />
                <span
                  className="text-[10px]"
                  style={{
                    fontFamily: "Anton, sans-serif",
                    color: card.color,
                    letterSpacing: "0.04em",
                  }}
                >
                  {card.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-[8px] opacity-60 leading-tight"
                  style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
                >
                  {card.description.slice(0, 26)}…
                </span>
                <span
                  className="text-[9px] ml-1 flex-shrink-0"
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    color: card.color,
                  }}
                >
                  {state.max - state.used}/{state.max}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Target picker overlay */}
      {targetPicker && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4"
          style={{ background: "#000000ee" }}
        >
          <button
            onClick={onCancelTarget}
            className="absolute top-2 right-2 opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div
            className="text-xs"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              color: CARDS[targetPicker.cardKey].color,
              letterSpacing: "0.1em",
            }}
          >
            PICK TARGET
          </div>
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "22px",
              color: CARDS[targetPicker.cardKey].color,
            }}
          >
            {CARDS[targetPicker.cardKey].name}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {otherContestants.map((o) => (
              <button
                key={o.id}
                onClick={() => onChooseTarget(o.id)}
                className="px-3 py-2 hover:opacity-80 transition"
                style={{
                  background: o.color,
                  color: "#000",
                  fontFamily: "Anton, sans-serif",
                  letterSpacing: "0.04em",
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HOST CONTROL PANEL
   ════════════════════════════════════════════════════════════════════ */
function HostPanel({
  buzzer,
  winner,
  resetBuzzer,
  contestants,
  onForceCard,
  gameMode,
  positions,
  resetPositions,
  debateActive,
  toggleDebate,
  rounds,
  activeRound,
  triggerRound,
  closeRound,
  votes,
  revealed,
  hostRevealAnswer,
  hostHideAnswer,
}) {
  const POS_GREEN = "#00e676";
  const POS_RED = "#ff1744";
  const greenCount = contestants.filter((c) => positions[c.id] === "green").length;
  const redCount = contestants.filter((c) => positions[c.id] === "red").length;
  return (
    <div
      className="p-4 flex flex-col gap-4"
      style={{ background: "#111", border: "1px solid #222" }}
    >
      {/* Rounds — trigger topics, close rounds */}
      <RoundsPanel
        rounds={rounds}
        activeRound={activeRound}
        triggerRound={triggerRound}
        closeRound={closeRound}
      />

      {/* RLGL controls — only visible in redlight mode */}
      {gameMode === "redlight" && (
        <div
          className="p-3 space-y-2"
          style={{ background: "#0a0a0a", border: "1px solid #222" }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: POS_GREEN, boxShadow: `0 0 8px ${POS_GREEN}` }}
                />
                <span
                  style={{
                    fontFamily: "Anton, sans-serif",
                    color: POS_GREEN,
                    fontSize: "18px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {greenCount}
                </span>
              </div>
              <span
                className="opacity-40 text-xs"
                style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
              >
                vs
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    fontFamily: "Anton, sans-serif",
                    color: POS_RED,
                    fontSize: "18px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {redCount}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: POS_RED, boxShadow: `0 0 8px ${POS_RED}` }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleDebate}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs uppercase hover:opacity-80 transition"
                style={{
                  background: debateActive ? "#ffab00" : "#0a0a0a",
                  color: debateActive ? "#000" : "#ffab00",
                  border: "1.5px solid #ffab00",
                  fontFamily: "Anton, sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                <Megaphone className="w-3 h-3" strokeWidth={2.5} />
                {debateActive ? "END DEBATE" : "START DEBATE"}
              </button>
              <button
                onClick={resetPositions}
                disabled={greenCount + redCount === 0 && !debateActive}
                className="px-3 py-1.5 text-xs uppercase hover:opacity-80 transition disabled:opacity-30"
                style={{
                  background: "#0a0a0a",
                  color: "#fff",
                  border: "1.5px solid #333",
                  fontFamily: "Anton, sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live submissions — visible for modes that collect votes */}
      {activeRound &&
        MODES[gameMode].primary !== "buzz" &&
        MODES[gameMode].primary !== "position" && (
          <SubmissionsPanel
            mode={MODES[gameMode]}
            contestants={contestants}
            votes={votes}
            revealed={revealed}
            hostRevealAnswer={hostRevealAnswer}
            hostHideAnswer={hostHideAnswer}
          />
        )}

      {/* Buzzer state */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div
            className="text-[10px] opacity-60 uppercase mb-1"
            style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
          >
            buzzer state
          </div>
          {winner ? (
            <div
              className="px-3 py-2 flex items-center justify-between"
              style={{
                background: winner.color,
                color: "#000",
                fontFamily: "Anton, sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              <span>{winner.name} IN</span>
              <span
                className="text-[10px] opacity-70"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                +{((Date.now() - buzzer.t) / 1000).toFixed(1)}s
              </span>
            </div>
          ) : (
            <div
              className="px-3 py-2"
              style={{
                background: "#0a0a0a",
                border: "1px dashed #333",
                color: "#666",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "12px",
              }}
            >
              — waiting —
            </div>
          )}
        </div>
        <button
          onClick={resetBuzzer}
          disabled={!buzzer}
          className="px-4 py-2 disabled:opacity-30 hover:opacity-80 transition text-xs uppercase"
          style={{
            background: "#ff2e6b",
            color: "#000",
            fontFamily: "Anton, sans-serif",
            letterSpacing: "0.08em",
          }}
        >
          RESET BUZZER
        </button>
      </div>

      {/* Force-fire cards (demo only — for testing overlay effects) */}
      <div>
        <div
          className="text-[10px] opacity-60 uppercase mb-2"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          force-fire card (for testing the overlay)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(CARDS).map(([key, card]) => {
            const Icon = card.icon;
            // pick first contestant with uses remaining as the caster
            const caster = contestants.find((c) => c.cards[key].used < c.cards[key].max);
            return (
              <button
                key={key}
                disabled={!caster}
                onClick={() => caster && onForceCard(caster.id, key)}
                className="px-3 py-2 text-left disabled:opacity-30 hover:-translate-y-0.5 transition-transform"
                style={{
                  background: "#0a0a0a",
                  border: `1.5px solid ${card.color}`,
                  boxShadow: `3px 3px 0 ${card.color}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className="w-3 h-3" style={{ color: card.color }} strokeWidth={2.5} />
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: "Anton, sans-serif",
                      color: card.color,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {card.name}
                  </span>
                </div>
                <div
                  className="text-[9px] opacity-60"
                  style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
                >
                  as {caster?.name || "—"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card remaining matrix */}
      <div>
        <div
          className="text-[10px] opacity-60 uppercase mb-2"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          cards remaining
        </div>
        <div className="space-y-1">
          {contestants.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span
                className="text-xs w-20"
                style={{
                  fontFamily: "Anton, sans-serif",
                  color: c.color,
                  letterSpacing: "0.04em",
                }}
              >
                {c.name}
              </span>
              <div className="flex-1 grid grid-cols-4 gap-1">
                {Object.entries(CARDS).map(([key, card]) => {
                  const state = c.cards[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between px-1.5 py-0.5"
                      style={{
                        background: "#0a0a0a",
                        border: `1px solid ${card.color}44`,
                      }}
                    >
                      <span
                        className="text-[9px]"
                        style={{
                          fontFamily: "Anton, sans-serif",
                          color: card.color,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {card.short}
                      </span>
                      <span
                        className="text-[9px]"
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          color: card.color,
                        }}
                      >
                        {state.max - state.used}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EVENT LOG
   ════════════════════════════════════════════════════════════════════ */
function EventLog({ entries }) {
  return (
    <div
      className="p-3 overflow-y-auto"
      style={{
        background: "#111",
        border: "1px solid #222",
        height: "100%",
        minHeight: "260px",
        maxHeight: "420px",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {entries.length === 0 ? (
        <div className="text-xs opacity-40" style={{ color: "#fff" }}>
          — no events yet —
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div key={e.id} className="text-[10px] flex items-start gap-2">
              <span className="opacity-40 flex-shrink-0" style={{ color: "#fff" }}>
                {e.time.toTimeString().slice(0, 8)}
              </span>
              <span style={{ color: e.color }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUBMISSIONS PANEL — shows host the live votes/typed entries/hidden answers
   ════════════════════════════════════════════════════════════════════ */
function SubmissionsPanel({
  mode,
  contestants,
  votes,
  revealed,
  hostRevealAnswer,
  hostHideAnswer,
}) {
  const submitted = contestants.filter((c) => votes[c.id]);
  const pending = contestants.filter((c) => !votes[c.id]);

  // Aggregate tallies for vote-anim modes
  const tallies = {};
  if (mode.primary === "vote-anim") {
    for (const o of mode.options) tallies[o.key] = 0;
    for (const c of submitted) {
      const v = votes[c.id];
      if (v?.kind === "vote-anim") tallies[v.value] = (tallies[v.value] || 0) + 1;
    }
  }

  return (
    <div
      className="p-3 space-y-2"
      style={{
        background: "#0a0a0a",
        border: `1px solid ${mode.color}44`,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] tracking-widest flex items-center gap-1.5"
          style={{ fontFamily: "JetBrains Mono, monospace", color: mode.color }}
        >
          <mode.icon className="w-3 h-3" strokeWidth={2.5} />
          live submissions · {submitted.length}/{contestants.length}
        </div>
        {mode.primary === "vote-anim" && (
          <div className="flex items-center gap-2">
            {mode.options.map((o) => (
              <div key={o.key} className="flex items-center gap-1">
                <span
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "16px",
                    color: o.color,
                  }}
                >
                  {tallies[o.key]}
                </span>
                <span
                  className="text-[9px]"
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    color: o.color,
                    letterSpacing: "0.15em",
                  }}
                >
                  {o.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submission rows */}
      <div className="space-y-1">
        {submitted.map((c) => {
          const v = votes[c.id];
          const isHidden = v.kind === "hidden-answer";
          const isRevealed = !!revealed[c.id];
          const opt =
            v.kind === "vote-anim"
              ? mode.options.find((o) => o.key === v.value)
              : null;

          return (
            <div
              key={c.id}
              className="flex items-center gap-2 px-2 py-1.5"
              style={{
                background: "#111",
                borderLeft: `3px solid ${c.color}`,
              }}
            >
              <span
                className="text-[11px] w-16 truncate flex-shrink-0"
                style={{
                  fontFamily: "Anton, sans-serif",
                  color: c.color,
                  letterSpacing: "0.04em",
                }}
              >
                {c.name}
              </span>

              {/* Value rendering */}
              {v.kind === "typed-buzz" && (
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "13px",
                    color: "#f0f0f0",
                  }}
                >
                  "{v.value}"
                </span>
              )}
              {v.kind === "vote-anim" && opt && (
                <span
                  className="flex-1 flex items-center gap-1.5"
                  style={{
                    fontFamily: "Anton, sans-serif",
                    fontSize: "12px",
                    color: opt.color,
                    letterSpacing: "0.08em",
                  }}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </span>
              )}
              {isHidden && (
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: isRevealed
                      ? "Anton, sans-serif"
                      : "JetBrains Mono, monospace",
                    fontSize: isRevealed ? "13px" : "11px",
                    color: isRevealed ? "#f0f0f0" : "#666",
                    letterSpacing: isRevealed ? "0.02em" : "0.1em",
                  }}
                >
                  {isRevealed ? v.value : "• • • LOCKED • • •"}
                </span>
              )}

              {/* Host controls for hidden answers */}
              {isHidden &&
                (isRevealed ? (
                  <button
                    onClick={() => hostHideAnswer(c.id)}
                    className="px-2 py-0.5 text-[9px] uppercase hover:opacity-80 transition flex items-center gap-1"
                    style={{
                      background: "#0a0a0a",
                      color: "#888",
                      border: "1px solid #333",
                      fontFamily: "JetBrains Mono, monospace",
                      letterSpacing: "0.12em",
                    }}
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                    hide
                  </button>
                ) : (
                  <button
                    onClick={() => hostRevealAnswer(c.id)}
                    className="px-2 py-0.5 text-[9px] uppercase hover:opacity-80 transition flex items-center gap-1"
                    style={{
                      background: MODES.sentence.color,
                      color: "#000",
                      fontFamily: "Anton, sans-serif",
                      letterSpacing: "0.12em",
                    }}
                  >
                    <Eye className="w-2.5 h-2.5" strokeWidth={2.5} />
                    reveal
                  </button>
                ))}

              {/* Check pill for locked-in non-hidden */}
              {!isHidden && (
                <Check
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: c.color }}
                  strokeWidth={3}
                />
              )}
            </div>
          );
        })}

        {/* Pending list */}
        {pending.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-1">
            <span
              className="text-[9px] opacity-50 mr-1"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                color: "#fff",
                letterSpacing: "0.15em",
              }}
            >
              WAITING
            </span>
            {pending.map((c) => (
              <span
                key={c.id}
                className="px-1.5 py-0.5 text-[9px]"
                style={{
                  background: "#0a0a0a",
                  border: `1px dashed ${c.color}55`,
                  color: c.color,
                  fontFamily: "Anton, sans-serif",
                  letterSpacing: "0.06em",
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ROUNDS PANEL — host-side, shows queue + trigger/close buttons
   ════════════════════════════════════════════════════════════════════ */
function RoundsPanel({ rounds, activeRound, triggerRound, closeRound }) {
  const nextPending = rounds.find((r) => r.phase === "pending");

  return (
    <div>
      <div
        className="text-[10px] opacity-60 uppercase mb-2 flex items-center gap-1.5"
        style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
      >
        <ListOrdered className="w-3 h-3" strokeWidth={2.5} />
        round queue
      </div>

      {/* Active round block */}
      {activeRound ? (
        <div
          className="p-3 mb-2 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "#0a0a0a",
            border: `1.5px solid ${MODES[activeRound.mode].color}`,
            boxShadow: `0 0 20px ${MODES[activeRound.mode].color}44`,
          }}
        >
          <div className="flex-1 min-w-[180px]">
            <div
              className="text-[9px] tracking-widest mb-1"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                color: MODES[activeRound.mode].color,
              }}
            >
              ● LIVE · {MODES[activeRound.mode].name}
            </div>
            <div
              style={{
                fontFamily: "Anton, sans-serif",
                fontSize: "18px",
                color: "#f0f0f0",
                letterSpacing: "0.04em",
              }}
            >
              {activeRound.title}
            </div>
            <div
              className="text-xs opacity-70 mt-0.5"
              style={{ fontFamily: "JetBrains Mono, monospace", color: "#f0f0f0" }}
            >
              {activeRound.topic || "—"}
            </div>
          </div>
          <button
            onClick={closeRound}
            className="px-3 py-2 flex items-center gap-1.5 text-xs uppercase hover:opacity-80 transition"
            style={{
              background: "#0a0a0a",
              color: "#ff2e6b",
              border: "1.5px solid #ff2e6b",
              fontFamily: "Anton, sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            <Square className="w-3 h-3" strokeWidth={2.5} fill="#ff2e6b" />
            close round
          </button>
        </div>
      ) : (
        <div
          className="p-3 mb-2 text-xs"
          style={{
            background: "#0a0a0a",
            border: "1px dashed #333",
            color: "#666",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          — no live round · contestants see STANDBY —
        </div>
      )}

      {/* Queue list */}
      <div className="space-y-1">
        {rounds.map((r, i) => {
          const isNext = r.id === nextPending?.id;
          const ModeIcon = MODES[r.mode].icon;
          return (
            <div
              key={r.id}
              className="px-2.5 py-1.5 flex items-center gap-2"
              style={{
                background: r.phase === "live" ? "#1a1a1a" : "#0a0a0a",
                border: `1px solid ${
                  r.phase === "live"
                    ? MODES[r.mode].color
                    : r.phase === "closed"
                      ? "#222"
                      : isNext
                        ? "#444"
                        : "#1f1f1f"
                }`,
                opacity: r.phase === "closed" ? 0.4 : 1,
              }}
            >
              <span
                className="text-[10px] opacity-50 w-5"
                style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <ModeIcon
                className="w-3 h-3 flex-shrink-0"
                style={{ color: MODES[r.mode].color }}
                strokeWidth={2.5}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs truncate"
                  style={{
                    fontFamily: "Anton, sans-serif",
                    color: "#f0f0f0",
                    letterSpacing: "0.03em",
                  }}
                >
                  {r.title}
                </div>
                <div
                  className="text-[9px] opacity-60 truncate"
                  style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
                >
                  {r.topic || "—"}
                </div>
              </div>
              {r.phase === "pending" && (
                <button
                  onClick={() => triggerRound(r.id)}
                  className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
                  style={{
                    background: isNext ? MODES[r.mode].color : "#0a0a0a",
                    color: isNext ? "#000" : MODES[r.mode].color,
                    border: `1px solid ${MODES[r.mode].color}`,
                    fontFamily: "Anton, sans-serif",
                    letterSpacing: "0.08em",
                  }}
                >
                  <Play className="w-2.5 h-2.5" strokeWidth={2.5} fill={isNext ? "#000" : "none"} />
                  trigger
                </button>
              )}
              {r.phase === "live" && (
                <span
                  className="text-[9px] px-1.5 py-0.5"
                  style={{
                    background: MODES[r.mode].color,
                    color: "#000",
                    fontFamily: "Anton, sans-serif",
                    letterSpacing: "0.1em",
                  }}
                >
                  LIVE
                </span>
              )}
              {r.phase === "closed" && (
                <span
                  className="text-[9px]"
                  style={{
                    color: "#666",
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.15em",
                  }}
                >
                  DONE
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PRODUCER VIEW — pre-show round authoring
   ════════════════════════════════════════════════════════════════════ */
function ProducerView({
  rounds,
  activeRoundId,
  addRound,
  updateRound,
  deleteRound,
  moveRound,
  resetAllRounds,
  contestants,
  updateContestantName,
}) {
  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">
      {/* Intro header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "32px",
              color: "#f0f0f0",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            RUNDOWN
          </div>
          <div
            className="text-xs opacity-60 mt-1.5"
            style={{ fontFamily: "JetBrains Mono, monospace", color: "#f0f0f0" }}
          >
            build the show · each round is a topic + a game mode · host triggers them live
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addRound}
            className="px-3 py-2 flex items-center gap-1.5 text-xs uppercase hover:-translate-y-0.5 transition-transform"
            style={{
              background: "#c6ff00",
              color: "#000",
              fontFamily: "Anton, sans-serif",
              letterSpacing: "0.08em",
              boxShadow: "3px 3px 0 #c6ff00",
            }}
          >
            <Plus className="w-3 h-3" strokeWidth={3} />
            add round
          </button>
          <button
            onClick={resetAllRounds}
            className="px-3 py-2 flex items-center gap-1.5 text-xs uppercase hover:opacity-80 transition"
            style={{
              background: "#0a0a0a",
              color: "#f0f0f0",
              border: "1px solid #333",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.08em",
            }}
          >
            reset statuses
          </button>
        </div>
      </div>

      {/* Contestants roster — editable names */}
      <div>
        <div
          className="text-[10px] opacity-60 uppercase mb-2 flex items-center gap-1.5"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          <Users className="w-3 h-3" strokeWidth={2.5} />
          contestants · {contestants.length}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {contestants.map((c) => (
            <ContestantEditor
              key={c.id}
              contestant={c}
              onRename={(name) => updateContestantName(c.id, name)}
            />
          ))}
        </div>
      </div>

      {/* Rundown label + round list */}
      <div>
        <div
          className="text-[10px] opacity-60 uppercase mb-2 flex items-center gap-1.5"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          <ListOrdered className="w-3 h-3" strokeWidth={2.5} />
          rundown · {rounds.length} round{rounds.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Round list */}
      <div className="space-y-3">
        {rounds.map((r, i) => (
          <ProducerRoundCard
            key={r.id}
            round={r}
            index={i}
            total={rounds.length}
            isLive={r.id === activeRoundId}
            updateRound={updateRound}
            deleteRound={deleteRound}
            moveRound={moveRound}
          />
        ))}

        {rounds.length === 0 && (
          <div
            className="p-8 text-center"
            style={{
              background: "#0a0a0a",
              border: "1px dashed #333",
              color: "#666",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            no rounds yet — hit "add round" to start
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="p-4 text-xs opacity-70 leading-relaxed"
        style={{
          background: "#0a0a0a",
          border: "1px dashed #333",
          fontFamily: "JetBrains Mono, monospace",
          color: "#ccc",
        }}
      >
        <span style={{ color: "#c6ff00" }}># how it flows</span>
        <br />
        producer builds the rundown here before the show · host switches to{" "}
        <span style={{ color: "#f0f0f0" }}>LIVE SHOW</span> tab and triggers each
        round in order · the moment a round goes live, contestants' phones swap
        from STANDBY to the correct controls (BUZZ, or GREEN/RED) and the topic
        appears on their screen AND on the OBS lower-third
      </div>
    </main>
  );
}

function ContestantEditor({ contestant: c, onRename }) {
  const [text, setText] = useState(c.name);
  // keep local state in sync if something external mutates it
  useEffect(() => {
    setText(c.name);
  }, [c.name]);

  const commit = () => {
    const v = text.trim();
    if (!v) {
      setText(c.name); // revert
      return;
    }
    if (v.toUpperCase() !== c.name) onRename(v);
  };

  return (
    <div
      className="flex items-center gap-2 px-2 py-2"
      style={{
        background: "#0a0a0a",
        border: `1px solid ${c.color}44`,
        borderLeft: `3px solid ${c.color}`,
      }}
    >
      {/* Slot + color swatch */}
      <div
        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
        style={{
          background: c.color,
          color: "#000",
          fontFamily: "Anton, sans-serif",
          fontSize: "13px",
          letterSpacing: "0.04em",
        }}
        title={`Slot ${c.slot}`}
      >
        {c.slot}
      </div>

      {/* Editable name */}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setText(c.name);
            e.currentTarget.blur();
          }
        }}
        maxLength={16}
        placeholder="NAME"
        className="flex-1 min-w-0 px-1 py-1 bg-transparent outline-none uppercase"
        style={{
          fontFamily: "Anton, sans-serif",
          fontSize: "16px",
          color: c.color,
          letterSpacing: "0.04em",
          borderBottom: "1px solid #222",
        }}
      />
    </div>
  );
}

function ProducerRoundCard({
  round: r,
  index,
  total,
  isLive,
  updateRound,
  deleteRound,
  moveRound,
}) {
  const modeColor = MODES[r.mode].color;
  const ModeIcon = MODES[r.mode].icon;

  return (
    <div
      className="flex gap-3 p-4"
      style={{
        background: "#111",
        border: isLive ? `2px solid ${modeColor}` : "1px solid #222",
        boxShadow: isLive ? `0 0 20px ${modeColor}66` : "none",
      }}
    >
      {/* Order controls */}
      <div className="flex flex-col items-center gap-1">
        <GripVertical className="w-4 h-4 opacity-30" />
        <div
          className="text-lg"
          style={{
            fontFamily: "Anton, sans-serif",
            color: "#f0f0f0",
            letterSpacing: "0.04em",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
        <button
          onClick={() => moveRound(r.id, -1)}
          disabled={index === 0}
          className="w-6 h-6 flex items-center justify-center disabled:opacity-20 hover:bg-white/10"
          title="Move up"
        >
          <ChevronRight className="w-3 h-3 -rotate-90" />
        </button>
        <button
          onClick={() => moveRound(r.id, 1)}
          disabled={index === total - 1}
          className="w-6 h-6 flex items-center justify-center disabled:opacity-20 hover:bg-white/10"
          title="Move down"
        >
          <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
      </div>

      {/* Editable fields */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isLive && (
            <span
              className="text-[9px] px-1.5 py-0.5"
              style={{
                background: modeColor,
                color: "#000",
                fontFamily: "Anton, sans-serif",
                letterSpacing: "0.15em",
              }}
            >
              ● LIVE
            </span>
          )}
          {!isLive && r.phase === "closed" && (
            <span
              className="text-[9px] px-1.5 py-0.5"
              style={{
                background: "#0a0a0a",
                color: "#666",
                border: "1px solid #333",
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: "0.15em",
              }}
            >
              DONE
            </span>
          )}
          <input
            value={r.title}
            onChange={(e) => updateRound(r.id, { title: e.target.value })}
            placeholder="Round title"
            className="flex-1 min-w-[200px] px-2 py-1.5 bg-transparent outline-none"
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "20px",
              color: "#f0f0f0",
              letterSpacing: "0.03em",
              borderBottom: "1px solid #222",
            }}
          />
        </div>

        <textarea
          value={r.topic}
          onChange={(e) => updateRound(r.id, { topic: e.target.value })}
          placeholder="Topic or question that contestants will see…"
          rows={2}
          className="w-full px-3 py-2 outline-none resize-none"
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            color: "#f0f0f0",
            lineHeight: 1.5,
          }}
        />

        {/* Mode picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] tracking-widest opacity-60"
            style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
          >
            MODE
          </span>
          {Object.entries(MODES).map(([key, m]) => {
            const Icon = m.icon;
            const picked = r.mode === key;
            return (
              <button
                key={key}
                onClick={() => updateRound(r.id, { mode: key })}
                className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase transition hover:-translate-y-0.5"
                style={{
                  background: picked ? m.color : "#0a0a0a",
                  color: picked ? "#000" : m.color,
                  border: `1px solid ${m.color}`,
                  fontFamily: "Anton, sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                {m.name}
              </button>
            );
          })}
          <span
            className="text-[9px] opacity-50 ml-2"
            style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
          >
            {MODES[r.mode].description}
          </span>
        </div>
      </div>

      {/* Delete */}
      <div className="flex flex-col items-end">
        <button
          onClick={() => deleteRound(r.id)}
          disabled={isLive}
          className="w-7 h-7 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
          title={isLive ? "Can't delete a live round" : "Delete round"}
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: "#ff2e6b" }} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DEPLOYMENT GUIDE
   ════════════════════════════════════════════════════════════════════ */
function DeploymentGuide() {
  return (
    <section
      className="p-5 mt-2"
      style={{
        background: "#0d0d0d",
        border: "1px dashed #333",
      }}
    >
      <div
        className="text-lg mb-3"
        style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.04em", color: "#00e5ff" }}
      >
        FROM DEMO → REAL SETUP
      </div>
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed"
        style={{ fontFamily: "JetBrains Mono, monospace", color: "#ccc" }}
      >
        <div>
          <div className="mb-1" style={{ color: "#ff2e6b" }}># 1. server</div>
          Spin up a Node + Socket.IO server. It holds shared state: buzzer, card
          counts, current effect. Emit events like <code>buzz</code>,{" "}
          <code>react</code>, <code>card:play</code> and broadcast.
        </div>
        <div>
          <div className="mb-1" style={{ color: "#ffab00" }}># 2. clients</div>
          Split this file into three pages:{" "}
          <code>/contestant?id=alex</code>, <code>/host</code>, <code>/overlay</code>.
          Each subscribes to relevant events. Contestant pages get loaded on
          phones; host page on your mod monitor.
        </div>
        <div>
          <div className="mb-1" style={{ color: "#c6ff00" }}># 3. OBS</div>
          Add a <code>Browser Source</code> pointing at your{" "}
          <code>/overlay</code> URL, 1920×1080, transparent background. Layer it
          on top of the VDO Ninja video tiles. Effects draw over everything.
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   UTILITY BITS
   ════════════════════════════════════════════════════════════════════ */
function SectionLabel({ icon: Icon, label, sub }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5" style={{ color: "#666" }} />
      <span
        className="text-xs tracking-widest"
        style={{ fontFamily: "Anton, sans-serif", color: "#f0f0f0", letterSpacing: "0.15em" }}
      >
        {label}
      </span>
      {sub && (
        <span
          className="text-[10px] opacity-50"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "#fff" }}
        >
          {sub}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "#1f1f1f" }} />
    </div>
  );
}

function StyleBlock() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;600&display=swap');

      @keyframes slamIn {
        0%   { transform: scale(3) rotate(-2deg); opacity: 0; }
        60%  { transform: scale(0.92) rotate(-2deg); opacity: 1; }
        100% { transform: scale(1) rotate(-2deg); opacity: 1; }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%      { transform: translateX(-6px); }
        40%      { transform: translateX(5px); }
        60%      { transform: translateX(-4px); }
        80%      { transform: translateX(3px); }
      }
      @keyframes flashOnce {
        0% { opacity: 0; }
        40% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes flashRed {
        0% { background: transparent; }
        40% { background: rgba(255,46,107,0.6); }
        100% { background: transparent; }
      }
      @keyframes floatUp {
        0%   { transform: translateY(20px) translateX(0); opacity: 0; }
        20%  { opacity: 1; }
        100% { transform: translateY(-180px) translateX(-10px); opacity: 0; }
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.3; }
      }
      @keyframes pulseGlow {
        0%, 100% { filter: brightness(1); }
        50%      { filter: brightness(1.3); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes buzzPulse {
        0%   { filter: brightness(1.6) saturate(1.4); }
        60%  { filter: brightness(1.1) saturate(1.1); }
        100% { filter: brightness(1) saturate(1); }
      }
      @keyframes buzzRing {
        0%   { transform: scale(0.85); opacity: 1; }
        100% { transform: scale(1.08); opacity: 0; }
      }
      @keyframes arrowUp {
        0%   { transform: translateY(40px) scale(0.4); opacity: 0; }
        30%  { transform: translateY(0) scale(1.15); opacity: 1; }
        70%  { transform: translateY(-10px) scale(1); opacity: 1; }
        100% { transform: translateY(-80px) scale(0.8); opacity: 0; }
      }
      @keyframes arrowDown {
        0%   { transform: translateY(-40px) scale(0.4); opacity: 0; }
        30%  { transform: translateY(0) scale(1.15); opacity: 1; }
        70%  { transform: translateY(10px) scale(1); opacity: 1; }
        100% { transform: translateY(80px) scale(0.8); opacity: 0; }
      }

      code {
        background: #1a1a1a;
        padding: 1px 4px;
        color: #fff;
        border-radius: 2px;
      }
    `}</style>
  );
}
