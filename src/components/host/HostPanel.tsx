import { Megaphone } from "lucide-react";
import { CARDS } from "../../cards";
import { MODES } from "../../modes";
import {
  selectGameMode,
  selectWinner,
  useGameStore,
} from "../../state/store";
import { POS_GREEN, POS_RED } from "../overlay/RLGLCenterTile";
import { RoundsPanel } from "./RoundsPanel";
import { SubmissionsPanel } from "./SubmissionsPanel";

interface HostPanelProps {
  // When false, skip the built-in RoundsPanel — useful on the Show Setup
  // screen where the producer's rundown cards already carry trigger/close
  // controls and we don't want two rounds lists side by side.
  showRoundsPanel?: boolean;
  // When false, hide the "cards remaining" matrix and the
  // "force-fire card" panel. The producer screen sets this off —
  // those are host debug surfaces only.
  showCardAdmin?: boolean;
  // When false, hide the "live submissions" list (SubmissionsPanel).
  // The producer doesn't need to see individual contestant answers —
  // that's the host's job.
  showSubmissions?: boolean;
  // When false, hide the "buzzer state" readout + reset button. Same
  // rationale as `showSubmissions` — the host owns moderation.
  showBuzzer?: boolean;
}

export function HostPanel({
  showRoundsPanel = true,
  showCardAdmin = true,
  showSubmissions = true,
  showBuzzer = true,
}: HostPanelProps = {}) {
  const contestants = useGameStore((s) => s.contestants);
  const buzzer = useGameStore((s) => s.buzzer);
  const winner = useGameStore(selectWinner);
  const gameMode = useGameStore(selectGameMode);
  const positions = useGameStore((s) => s.positions);
  const debateActive = useGameStore((s) => s.debateActive);
  const activeRoundId = useGameStore((s) => s.activeRoundId);

  const buzzerReset = useGameStore((s) => s.buzzerReset);
  const positionsReset = useGameStore((s) => s.positionsReset);
  const debateToggle = useGameStore((s) => s.debateToggle);
  const cardTryPlay = useGameStore((s) => s.cardTryPlay);

  const greenCount = contestants.filter((c) => positions[c.id] === "green").length;
  const redCount = contestants.filter((c) => positions[c.id] === "red").length;
  const mode = MODES[gameMode];

  return (
    <div
      className="p-4 flex flex-col gap-4"
      style={{ background: "#111", border: "1px solid #222" }}
    >
      {showRoundsPanel && <RoundsPanel />}

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
                  style={{
                    background: POS_GREEN,
                    boxShadow: `0 0 8px ${POS_GREEN}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
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
                style={{
                  fontFamily: "Inter, sans-serif",
                  color: "#fff",
                }}
              >
                vs
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: POS_RED,
                    fontSize: "18px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {redCount}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: POS_RED,
                    boxShadow: `0 0 8px ${POS_RED}`,
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={debateToggle}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs uppercase hover:opacity-80 transition"
                style={{
                  background: debateActive ? "#ffab00" : "#0a0a0a",
                  color: debateActive ? "#000" : "#ffab00",
                  border: "1.5px solid #ffab00",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                <Megaphone className="w-3 h-3" strokeWidth={2.5} />
                {debateActive ? "END DEBATE" : "START DEBATE"}
              </button>
              <button
                onClick={positionsReset}
                disabled={greenCount + redCount === 0 && !debateActive}
                className="px-3 py-1.5 text-xs uppercase hover:opacity-80 transition disabled:opacity-30"
                style={{
                  background: "#0a0a0a",
                  color: "#fff",
                  border: "1.5px solid #333",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                clear
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmissions &&
        activeRoundId &&
        mode.primary !== "buzz" &&
        mode.primary !== "position" && <SubmissionsPanel mode={mode} />}

      {showBuzzer && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div
              className="text-[10px] opacity-60 uppercase mb-1"
              style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
            >
              buzzer state
            </div>
            {winner && buzzer ? (
              <div
                className="px-3 py-2 flex items-center justify-between"
                style={{
                  background: winner.color,
                  color: "#000",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.04em",
                }}
              >
                <span>{winner.name} IN</span>
                <span
                  className="text-[10px] opacity-70"
                  style={{ fontFamily: "Inter, sans-serif" }}
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
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                }}
              >
                — waiting —
              </div>
            )}
          </div>
          <button
            onClick={buzzerReset}
            disabled={!buzzer}
            className="px-4 py-2 disabled:opacity-30 hover:opacity-80 transition text-xs uppercase"
            style={{
              background: "#ff2e6b",
              color: "#000",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            RESET BUZZER
          </button>
        </div>
      )}

      {/* Force-fire cards for testing the overlay */}
      {showCardAdmin && <div>
        <div
          className="text-[10px] opacity-60 uppercase mb-2"
          style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
        >
          force-fire card (for testing the overlay)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(CARDS).map(([key, card]) => {
            const Icon = card.icon;
            const caster = contestants.find(
              (c) =>
                c.cards[key as keyof typeof c.cards].used <
                c.cards[key as keyof typeof c.cards].max,
            );
            return (
              <button
                key={key}
                disabled={!caster}
                onClick={() =>
                  caster && cardTryPlay(caster.id, key as keyof typeof CARDS)
                }
                className="px-3 py-2 text-left disabled:opacity-30 hover:-translate-y-0.5 transition-transform"
                style={{
                  background: "#0a0a0a",
                  border: `1.5px solid ${card.color}`,
                  boxShadow: `3px 3px 0 ${card.color}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon
                    className="w-3 h-3"
                    style={{ color: card.color }}
                    strokeWidth={2.5}
                  />
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      color: card.color,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {card.name}
                  </span>
                </div>
                <div
                  className="text-[9px] opacity-60"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: "#fff",
                  }}
                >
                  as {caster?.name ?? "—"}
                </div>
              </button>
            );
          })}
        </div>
      </div>}

      {/* Cards remaining matrix */}
      {showCardAdmin && (
        <div>
          <div
            className="text-[10px] opacity-60 uppercase mb-2"
            style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
          >
            cards remaining
          </div>
          <div className="space-y-1">
            {contestants.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span
                  className="text-xs w-20"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: c.color,
                    letterSpacing: "0.04em",
                  }}
                >
                  {c.name}
                </span>
                <div className="flex-1 grid grid-cols-4 gap-1">
                  {Object.entries(CARDS).map(([key, card]) => {
                    const state = c.cards[key as keyof typeof c.cards];
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
                            fontFamily: "Inter, sans-serif",
                            color: card.color,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {card.short}
                        </span>
                        <span
                          className="text-[9px]"
                          style={{
                            fontFamily: "Inter, sans-serif",
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
      )}
    </div>
  );
}
