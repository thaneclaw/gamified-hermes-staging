import { X } from "lucide-react";
import { CARDS } from "../../cards";
import { MODES } from "../../modes";
import { EMOJIS } from "../../slots";
import {
  selectActiveRound,
  selectGameMode,
  useGameStore,
} from "../../state/store";
import type { Contestant } from "../../state/types";
import { TypedBuzzInput } from "./TypedBuzzInput";
import { VoteAnimButtons } from "./VoteAnimButtons";
import { HiddenAnswerInput } from "./HiddenAnswerInput";
import { SentimentScoreInput } from "./SentimentScoreInput";
import { BiggerDealButtons } from "./BiggerDealButtons";
import { PlayButtons } from "./PlayButtons";
import { MvpPicker } from "./MvpPicker";
import { ChatPanel } from "../shared/ChatPanel";

const POS_GREEN = "#00e676";
const POS_RED = "#ff1744";

interface Props {
  contestant: Contestant;
}

export function ContestantPhone({ contestant: c }: Props) {
  const buzzer = useGameStore((s) => s.buzzer);
  const gameMode = useGameStore(selectGameMode);
  const activeRound = useGameStore(selectActiveRound);
  const position = useGameStore((s) => s.positions[c.id]) ?? null;
  const vote = useGameStore((s) => s.votes[c.id]) ?? null;
  const revealed = !!useGameStore((s) => s.revealed[c.id]);
  const targetPickerGlobal = useGameStore((s) => s.targetPicker);
  const contestants = useGameStore((s) => s.contestants);

  const buzz = useGameStore((s) => s.buzz);
  const reactionSend = useGameStore((s) => s.reactionSend);
  const cardTryPlay = useGameStore((s) => s.cardTryPlay);
  const cardFire = useGameStore((s) => s.cardFire);
  const cancelTarget = useGameStore((s) => s.cancelTarget);
  const positionTake = useGameStore((s) => s.positionTake);
  const submitTypedBuzz = useGameStore((s) => s.submitTypedBuzz);
  const castVote = useGameStore((s) => s.castVote);
  const submitSentimentScore = useGameStore((s) => s.submitSentimentScore);
  const submitBiggerDeal = useGameStore((s) => s.submitBiggerDeal);
  const submitPlay = useGameStore((s) => s.submitPlay);
  const submitHiddenAnswer = useGameStore((s) => s.submitHiddenAnswer);
  const submitMvpPick = useGameStore((s) => s.submitMvpPick);
  const revealAnswer = useGameStore((s) => s.revealAnswer);

  const isBuzzed = buzzer?.contestantId === c.id;
  const anyBuzzed = !!buzzer;
  const roundLive = !!activeRound;
  const primary = MODES[gameMode].primary;
  const otherContestants = contestants.filter((x) => x.id !== c.id);
  const targetPicker =
    targetPickerGlobal?.byId === c.id ? targetPickerGlobal : null;

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
              fontFamily: "Inter, sans-serif",
            }}
          >
            {c.name[0]}
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
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
          style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
        >
          contestant
        </div>
      </div>

      {/* Topic card */}
      {roundLive && activeRound && (
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
                fontFamily: "Inter, sans-serif",
                color: MODES[activeRound.mode].color,
              }}
            >
              {activeRound.title.toUpperCase()}
            </span>
            <span
              className="text-[8px] opacity-60"
              style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
            >
              {MODES[activeRound.mode].name}
            </span>
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
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

      {/* Primary action */}
      {!roundLive ? (
        <div
          className="relative w-full py-6 flex flex-col items-center justify-center gap-1"
          style={{
            background: "#0a0a0a",
            border: "2px dashed #333",
            fontFamily: "Inter, sans-serif",
            color: "#555",
          }}
        >
          <span className="text-[10px] tracking-[0.25em]">STANDBY</span>
          <span className="text-[9px] opacity-60">
            waiting for host to open round
          </span>
        </div>
      ) : primary === "buzz" ? (
        <button
          onClick={() => buzz(c.id)}
          disabled={anyBuzzed}
          className="relative w-full py-6 active:translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isBuzzed ? c.color : "#000",
            border: `3px solid ${c.color}`,
            fontFamily: "Inter, sans-serif",
            fontSize: "36px",
            color: isBuzzed ? "#000" : c.color,
            letterSpacing: "0.06em",
            boxShadow: isBuzzed
              ? `inset 0 0 30px ${c.color}80`
              : `4px 4px 0 ${c.color}`,
          }}
        >
          {isBuzzed ? "✓ IN" : "BUZZ"}
        </button>
      ) : primary === "position" ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "green" as const, label: "GREEN", color: POS_GREEN },
            { key: "red" as const, label: "RED", color: POS_RED },
          ].map((b) => {
            const picked = position === b.key;
            const dimmed = position && !picked;
            return (
              <button
                key={b.key}
                onClick={() => positionTake(c.id, b.key)}
                className="relative py-5 active:translate-y-0.5 transition"
                style={{
                  background: picked ? b.color : "#000",
                  border: `3px solid ${b.color}`,
                  fontFamily: "Inter, sans-serif",
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
          onSubmit={(text) => submitTypedBuzz(c.id, text)}
        />
      ) : primary === "vote-anim" ? (
        <VoteAnimButtons
          mode={MODES[gameMode]}
          vote={vote}
          onCast={(key) => castVote(c.id, key)}
        />
      ) : primary === "hidden-answer" ? (
        <HiddenAnswerInput
          color={c.color}
          mode={MODES[gameMode]}
          vote={vote}
          revealed={revealed}
          onSubmit={(text) => submitHiddenAnswer(c.id, text)}
          onReveal={() => revealAnswer(c.id)}
        />
      ) : primary === "sentiment-score" ? (
        <SentimentScoreInput
          color={c.color}
          vote={vote}
          onSubmit={(score) => submitSentimentScore(c.id, score)}
        />
      ) : primary === "bigger-deal" ? (
        <BiggerDealButtons
          choices={activeRound?.choices}
          vote={vote}
          onCast={(idx) => submitBiggerDeal(c.id, idx)}
        />
      ) : primary === "play-pick" ? (
        <PlayButtons
          color={MODES[gameMode].color}
          choices={activeRound?.choices ?? []}
          vote={vote}
          onCastPreset={(idx) => submitPlay(c.id, { choiceIndex: idx })}
          onCastCustom={(text) => submitPlay(c.id, { freeform: text })}
        />
      ) : primary === "mvp-pick" ? (
        <MvpPicker
          self={c}
          contestants={contestants}
          color={c.color}
          vote={vote}
          onSubmit={(targetId) => submitMvpPick(c.id, targetId)}
        />
      ) : null}

      {/* Emoji row */}
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => reactionSend(c.id, e)}
            className="aspect-square text-lg hover:bg-white/10 transition rounded"
            style={{ background: "#1a1a1a" }}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(CARDS).map(([key, card]) => {
          const state = c.cards[key as keyof typeof c.cards];
          const out = state.used >= state.max;
          const Icon = card.icon;
          return (
            <button
              key={key}
              onClick={() => cardTryPlay(c.id, key as keyof typeof CARDS)}
              disabled={out}
              className="relative px-2 py-2 text-left flex flex-col gap-1 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-transform"
              style={{
                background: "#0a0a0a",
                border: `1.5px solid ${card.color}`,
                boxShadow: out ? "none" : `3px 3px 0 ${card.color}`,
              }}
            >
              {/* Two-row card chip: icon + name on top (full cell width,
                  wraps as needed so "SHUT THE !@#$ UP!!" and friends fit
                  in the narrow 3-column phone grid without ellipsis);
                  remaining-count badge on the bottom row. Tightened
                  letter-spacing + break-words lets the longest name slot
                  into two lines instead of being clipped. */}
              <div className="flex items-start gap-1.5 w-full">
                <Icon
                  className="w-3 h-3 flex-shrink-0 mt-0.5"
                  style={{ color: card.color }}
                  strokeWidth={2.5}
                />
                <span
                  className="text-[9px] min-w-0 flex-1 leading-tight break-words"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: card.color,
                    letterSpacing: "0.02em",
                  }}
                >
                  {card.name}
                </span>
              </div>
              <div
                className="text-[9px] self-end"
                style={{
                  fontFamily: "Inter, sans-serif",
                  color: card.color,
                  letterSpacing: "0.02em",
                }}
              >
                {state.max - state.used}/{state.max}
              </div>
            </button>
          );
        })}
      </div>

      {/* Backstage chat — shared channel with host, producer, and everyone else */}
      <ChatPanel role="contestant" contestantId={c.id} height={140} />

      {/* Target picker overlay */}
      {targetPicker && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4"
          style={{ background: "#000000ee" }}
        >
          <button
            onClick={cancelTarget}
            className="absolute top-2 right-2 opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div
            className="text-xs"
            style={{
              fontFamily: "Inter, sans-serif",
              color: CARDS[targetPicker.cardKey].color,
              letterSpacing: "0.1em",
            }}
          >
            PICK TARGET
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
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
                onClick={() =>
                  cardFire(targetPicker.byId, targetPicker.cardKey, o.id)
                }
                className="px-3 py-2 hover:opacity-80 transition"
                style={{
                  background: o.color,
                  color: "#000",
                  fontFamily: "Inter, sans-serif",
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
