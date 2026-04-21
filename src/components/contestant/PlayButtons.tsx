import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { decodePlayVote } from "../../modes";
import type { VoteRecord } from "../../state/types";

interface Props {
  color: string;
  choices: string[];
  vote: VoteRecord | null;
  onCastPreset: (index: number) => void;
  onCastCustom: (text: string) => void;
}

// WHAT'S THE PLAY — contestant-side picker. Producer seeds the preset
// choices (2..N); contestants can tap one OR type their own call in the
// "your own" slot at the bottom. Re-submitting is allowed so they can
// change their mind while the round is open — mirrors the bigger-deal
// buttons behaviour where a re-tap replaces the previous pick.
export function PlayButtons({
  color,
  choices,
  vote,
  onCastPreset,
  onCastCustom,
}: Props) {
  const current = vote?.kind === "play-pick" ? decodePlayVote(vote.value) : null;
  const currentIdx = current?.kind === "preset" ? current.index : null;
  const currentCustom = current?.kind === "custom" ? current.text : null;

  // Keep the freeform input in lockstep with the server-side freeform
  // vote when it changes (e.g. page reload), but let the contestant
  // edit it freely otherwise.
  const [text, setText] = useState(currentCustom ?? "");
  useEffect(() => {
    if (currentCustom != null) setText(currentCustom);
  }, [currentCustom]);

  const submitCustom = () => {
    const v = text.trim();
    if (!v) return;
    onCastCustom(v);
  };

  // Render the presets in a 2-wide grid so 2..6 slots lay out neatly on
  // a phone. Odd counts leave the last cell flexing across the row via
  // col-span-2 so a lone "OPTION E" doesn't look orphaned.
  const presetCount = choices.length;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {choices.map((label, idx) => {
          const picked = currentIdx === idx;
          const dimmed = current !== null && !picked;
          const fallback = `OPTION ${String.fromCharCode(65 + idx)}`;
          const isLast = idx === presetCount - 1;
          const spanFull = presetCount % 2 === 1 && isLast;
          return (
            <button
              key={idx}
              onClick={() => onCastPreset(idx)}
              className={`relative py-4 px-2 active:translate-y-0.5 transition flex items-center justify-center text-center ${spanFull ? "col-span-2" : ""}`}
              style={{
                background: picked ? color : "#000",
                border: `3px solid ${color}`,
                color: picked ? "#000" : color,
                opacity: dimmed ? 0.35 : 1,
                fontFamily: "Inter, sans-serif",
                boxShadow: picked
                  ? `inset 0 0 20px ${color}80, 0 0 20px ${color}80`
                  : `4px 4px 0 ${color}`,
                minHeight: "64px",
              }}
            >
              <span
                className="leading-tight"
                style={{
                  fontSize: "clamp(13px, 3vw, 17px)",
                  letterSpacing: "0.04em",
                  wordBreak: "break-word",
                }}
              >
                {label || fallback}
              </span>
            </button>
          );
        })}
      </div>

      {/* Freeform "or your own" slot. Always visible below the presets —
          when a custom answer is the active vote the input borders turn
          solid so the contestant can see their text is the locked pick.
          Re-submitting replaces the vote. */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[9px] opacity-60"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#fff",
            letterSpacing: "0.18em",
          }}
        >
          OR TYPE YOUR OWN
        </span>
        <div className="flex gap-2 items-stretch">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCustom();
            }}
            placeholder="your call…"
            maxLength={80}
            className="flex-1 min-w-0 px-3 py-2 outline-none"
            style={{
              background: "#000",
              border: `2px ${currentCustom != null ? "solid" : "dashed"} ${color}${currentCustom != null ? "" : "80"}`,
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: "#f0f0f0",
              letterSpacing: "0.02em",
              opacity: currentIdx != null ? 0.5 : 1,
            }}
          />
          <button
            onClick={submitCustom}
            disabled={!text.trim()}
            className="px-3 flex items-center gap-1 active:translate-y-0.5 transition disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background:
                currentCustom != null && currentCustom === text.trim()
                  ? color
                  : "#000",
              border: `2px solid ${color}`,
              color:
                currentCustom != null && currentCustom === text.trim()
                  ? "#000"
                  : color,
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              letterSpacing: "0.1em",
            }}
            title="Lock in your own call"
          >
            <Lock className="w-3 h-3" strokeWidth={3} />
            LOCK
          </button>
        </div>
      </div>
    </div>
  );
}
