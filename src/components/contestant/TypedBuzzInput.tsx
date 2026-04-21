import { useState } from "react";
import type { Mode } from "../../modes";
import type { VoteRecord } from "../../state/types";

interface Props {
  color: string;
  mode: Mode;
  vote: VoteRecord | null;
  anyBuzzed: boolean;
  isBuzzed: boolean;
  onSubmit: (text: string) => void;
}

export function TypedBuzzInput({
  color,
  mode,
  vote,
  anyBuzzed,
  isBuzzed,
  onSubmit,
}: Props) {
  const [text, setText] = useState("");
  const locked = !!vote;

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onSubmit(v);
  };

  if (locked && vote) {
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
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {isBuzzed ? "✓ FIRST IN" : "SUBMITTED"}
        </span>
        <span
          className="text-center"
          style={{
            fontFamily: "Inter, sans-serif",
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
          fontFamily: "Inter, sans-serif",
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
          fontFamily: "Inter, sans-serif",
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
