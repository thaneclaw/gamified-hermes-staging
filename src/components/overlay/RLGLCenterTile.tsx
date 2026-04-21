import type { Contestant } from "../../state/types";
import type { SlotRect } from "../../slots";

export const POS_GREEN = "#00e676";
export const POS_RED = "#ff1744";

interface Props {
  contestants: Contestant[];
  positions: Record<string, "green" | "red" | null | undefined>;
  debateActive: boolean;
  centerSlot: SlotRect;
}

export function RLGLCenterTile({
  contestants,
  positions,
  debateActive,
  centerSlot,
}: Props) {
  const greens = contestants.filter((c) => positions[c.id] === "green");
  const reds = contestants.filter((c) => positions[c.id] === "red");

  const side = (label: "GREEN" | "RED", color: string, list: Contestant[]) => (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-1 relative px-2"
      style={{
        background: `linear-gradient(${label === "GREEN" ? "135deg" : "225deg"}, ${color}22 0%, transparent 80%)`,
      }}
    >
      <div
        className="text-[9px] tracking-[0.25em]"
        style={{ fontFamily: "Inter, sans-serif", color }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
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
              fontFamily: "Inter, sans-serif",
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
        left: centerSlot.left,
        top: centerSlot.top,
        width: centerSlot.width,
        height: centerSlot.height,
        outline: debateActive
          ? "3px solid #ffab00"
          : "1px solid rgba(255,255,255,0.2)",
        boxShadow: debateActive
          ? "0 0 40px #ffab0080"
          : "0 8px 24px rgba(0,0,0,0.6)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #050505 70%)",
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

      <div
        className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] opacity-70 tracking-[0.25em]"
        style={{ fontFamily: "Inter, sans-serif", color: "#f0f0f0" }}
      >
        WHERE DO YOU STAND?
      </div>
    </div>
  );
}
