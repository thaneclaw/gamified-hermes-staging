import { BIGGER_DEAL_COLORS, DEFAULT_BIGGER_DEAL_CHOICES } from "../../modes";
import type { VoteRecord } from "../../state/types";

interface Props {
  // Accepts the widened Round.choices (string[]) since whatstheplay now
  // shares the field; biggerdeal/whoyagot always fill exactly two slots.
  choices?: string[];
  vote: VoteRecord | null;
  onCast: (choiceIndex: number) => void;
}

/**
 * Two producer-supplied choices — contestants tap the one they think is
 * the bigger deal. Mirrors the VoteAnimButtons pattern (tap = submit, the
 * picked side stays lit, the other dims) but pulls the button labels
 * from `round.choices` at render time so each round can define its own.
 */
export function BiggerDealButtons({ choices, vote, onCast }: Props) {
  const labelA = choices?.[0] ?? DEFAULT_BIGGER_DEAL_CHOICES[0];
  const labelB = choices?.[1] ?? DEFAULT_BIGGER_DEAL_CHOICES[1];
  const [colorA, colorB] = BIGGER_DEAL_COLORS;
  const current =
    vote?.kind === "bigger-deal" ? Number(vote.value) : null;

  const pair: Array<{ idx: 0 | 1; label: string; color: string }> = [
    { idx: 0, label: labelA, color: colorA },
    { idx: 1, label: labelB, color: colorB },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {pair.map(({ idx, label, color }) => {
        const picked = current === idx;
        const dimmed = current !== null && !picked;
        return (
          <button
            key={idx}
            onClick={() => onCast(idx)}
            className="relative py-4 px-2 active:translate-y-0.5 transition flex items-center justify-center text-center"
            style={{
              background: picked ? color : "#000",
              border: `3px solid ${color}`,
              color: picked ? "#000" : color,
              opacity: dimmed ? 0.35 : 1,
              fontFamily: "Inter, sans-serif",
              boxShadow: picked
                ? `inset 0 0 20px ${color}80, 0 0 20px ${color}80`
                : `4px 4px 0 ${color}`,
              minHeight: "72px",
            }}
          >
            <span
              className="leading-tight"
              style={{
                fontSize: "clamp(14px, 3.2vw, 18px)",
                letterSpacing: "0.04em",
                wordBreak: "break-word",
              }}
            >
              {label || (idx === 0 ? "OPTION A" : "OPTION B")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
