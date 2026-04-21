import { useState } from "react";
import { Eye, Lock } from "lucide-react";
import type { Mode } from "../../modes";
import type { VoteRecord } from "../../state/types";

interface Props {
  color: string;
  mode: Mode;
  vote: VoteRecord | null;
  revealed: boolean;
  onSubmit: (text: string) => void;
  onReveal: () => void;
}

export function HiddenAnswerInput({
  color,
  mode,
  vote,
  revealed,
  onSubmit,
  onReveal,
}: Props) {
  const [text, setText] = useState(vote?.value ?? "");
  const locked = !!vote;

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onSubmit(v);
  };

  if (locked && revealed && vote) {
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
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          ON AIR
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
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

  if (locked && vote) {
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
                fontFamily: "Inter, sans-serif",
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
            style={{ fontFamily: "Inter, sans-serif" }}
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
            fontFamily: "Inter, sans-serif",
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
          fontFamily: "Inter, sans-serif",
          fontSize: "16px",
          color: "#f0f0f0",
          letterSpacing: "0.02em",
          lineHeight: 1.3,
        }}
      />
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] opacity-50"
          style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
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
            fontFamily: "Inter, sans-serif",
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
