import { useState } from "react";
import { Check, Gauge, Lock } from "lucide-react";
import { SENTIMENT_MAX, SENTIMENT_MIN } from "../../modes";
import type { VoteRecord } from "../../state/types";
import { SentimentDial } from "../overlay/SentimentDial";

interface Props {
  color: string;
  vote: VoteRecord | null;
  onSubmit: (score: number) => void;
}

/**
 * 1-10 slider with a live red-to-green dial preview. Dragging the slider
 * swings the needle in real time; "LOCK IN" sends the score to the
 * server, which broadcasts the vote and fires the overlay swing on every
 * contestant tile.
 */
export function SentimentScoreInput({ color, vote, onSubmit }: Props) {
  const locked = !!vote && vote.kind === "sentiment-score";
  const lockedScore = locked ? Number(vote.value) : null;
  const [pending, setPending] = useState<number>(
    lockedScore ?? Math.round((SENTIMENT_MIN + SENTIMENT_MAX) / 2),
  );

  if (locked && lockedScore != null) {
    return (
      <div
        className="relative w-full p-3 flex items-center gap-3"
        style={{
          background: "#000",
          border: `3px solid ${color}`,
          color,
          boxShadow: `4px 4px 0 ${color}`,
        }}
      >
        <div style={{ width: 80, height: 48 }}>
          <SentimentDial
            value={lockedScore}
            animate={false}
            color={color}
            className="w-full h-full"
            showValue={false}
          />
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          <span
            className="text-[9px] tracking-[0.25em] opacity-70"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            LOCKED IN
          </span>
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "24px",
              lineHeight: 1,
              color,
            }}
          >
            {lockedScore}
            <span style={{ fontSize: "12px", opacity: 0.5 }}> / {SENTIMENT_MAX}</span>
          </span>
        </div>
        <button
          onClick={() => onSubmit(pending)}
          className="px-2 py-1 text-[9px] uppercase hover:opacity-80 transition flex items-center gap-1"
          style={{
            background: "#0a0a0a",
            color,
            border: `1px solid ${color}55`,
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.12em",
          }}
          title="Change your score"
        >
          <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
          change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full p-2 flex items-center gap-3"
        style={{
          background: "#000",
          border: `2px solid ${color}60`,
        }}
      >
        <div style={{ width: 90, height: 56 }} className="flex-shrink-0">
          <SentimentDial
            value={pending}
            animate={false}
            color={color}
            className="w-full h-full"
            showValue={false}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "40px",
                lineHeight: 1,
                color,
              }}
            >
              {pending}
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                opacity: 0.5,
                color,
              }}
            >
              / {SENTIMENT_MAX}
            </span>
          </div>
          <span
            className="text-[9px] tracking-[0.2em] opacity-60"
            style={{ fontFamily: "Inter, sans-serif", color: "#ccc" }}
          >
            <Gauge className="w-2.5 h-2.5 inline-block mr-1" strokeWidth={2.5} />
            DRAG TO SET
          </span>
        </div>
      </div>

      <input
        type="range"
        min={SENTIMENT_MIN}
        max={SENTIMENT_MAX}
        step={1}
        value={pending}
        onChange={(e) => setPending(Number(e.target.value))}
        className="w-full"
        style={{
          accentColor: color,
        }}
      />

      <button
        onClick={() => onSubmit(pending)}
        className="w-full py-3 flex items-center justify-center gap-1.5 active:translate-y-0.5 transition"
        style={{
          background: color,
          color: "#000",
          border: `3px solid ${color}`,
          fontFamily: "Inter, sans-serif",
          fontSize: "18px",
          letterSpacing: "0.1em",
          boxShadow: `4px 4px 0 ${color}`,
        }}
      >
        <Lock className="w-4 h-4" strokeWidth={2.5} />
        LOCK IN {pending}
      </button>
    </div>
  );
}
