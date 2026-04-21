import { ListOrdered, Play, Square } from "lucide-react";
import { MODES } from "../../modes";
import { selectActiveRound, useGameStore } from "../../state/store";

export function RoundsPanel() {
  const rounds = useGameStore((s) => s.rounds);
  const activeRound = useGameStore(selectActiveRound);
  const roundTrigger = useGameStore((s) => s.roundTrigger);
  const roundClose = useGameStore((s) => s.roundClose);

  const nextPending = rounds.find((r) => r.phase === "pending");

  return (
    <div>
      <div
        className="text-[10px] opacity-60 uppercase mb-2 flex items-center gap-1.5"
        style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
      >
        <ListOrdered className="w-3 h-3" strokeWidth={2.5} />
        round queue
      </div>

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
                fontFamily: "Inter, sans-serif",
                color: MODES[activeRound.mode].color,
              }}
            >
              ● LIVE · {MODES[activeRound.mode].name}
            </div>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "18px",
                color: "#f0f0f0",
                letterSpacing: "0.04em",
              }}
            >
              {activeRound.title}
            </div>
            <div
              className="text-xs opacity-70 mt-0.5"
              style={{
                fontFamily: "Inter, sans-serif",
                color: "#f0f0f0",
              }}
            >
              {activeRound.topic || "—"}
            </div>
          </div>
          <button
            onClick={roundClose}
            className="px-3 py-2 flex items-center gap-1.5 text-xs uppercase hover:opacity-80 transition"
            style={{
              background: "#0a0a0a",
              color: "#ff2e6b",
              border: "1.5px solid #ff2e6b",
              fontFamily: "Inter, sans-serif",
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
            fontFamily: "Inter, sans-serif",
          }}
        >
          — no live round · contestants see STANDBY —
        </div>
      )}

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
                style={{
                  fontFamily: "Inter, sans-serif",
                  color: "#fff",
                }}
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
                    fontFamily: "Inter, sans-serif",
                    color: "#f0f0f0",
                    letterSpacing: "0.03em",
                  }}
                >
                  {r.title}
                </div>
                <div
                  className="text-[9px] opacity-60 truncate"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: "#fff",
                  }}
                >
                  {r.topic || "—"}
                </div>
              </div>
              {r.phase === "pending" && (
                <button
                  onClick={() => roundTrigger(r.id)}
                  className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
                  style={{
                    background: isNext ? MODES[r.mode].color : "#0a0a0a",
                    color: isNext ? "#000" : MODES[r.mode].color,
                    border: `1px solid ${MODES[r.mode].color}`,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.08em",
                  }}
                >
                  <Play
                    className="w-2.5 h-2.5"
                    strokeWidth={2.5}
                    fill={isNext ? "#000" : "none"}
                  />
                  trigger
                </button>
              )}
              {r.phase === "live" && (
                <span
                  className="text-[9px] px-1.5 py-0.5"
                  style={{
                    background: MODES[r.mode].color,
                    color: "#000",
                    fontFamily: "Inter, sans-serif",
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
                    fontFamily: "Inter, sans-serif",
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
