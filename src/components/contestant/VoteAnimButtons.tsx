import type { Mode } from "../../modes";
import type { VoteRecord } from "../../state/types";

interface Props {
  mode: Mode;
  vote: VoteRecord | null;
  onCast: (key: string) => void;
}

export function VoteAnimButtons({ mode, vote, onCast }: Props) {
  const current = vote?.value ?? null;
  if (!mode.options) return null;
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
              fontFamily: "Inter, sans-serif",
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
