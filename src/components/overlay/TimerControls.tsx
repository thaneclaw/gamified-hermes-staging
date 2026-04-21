import { Play, Square, Timer } from "lucide-react";
import { useGameStore } from "../../state/store";

// Duration picker + run controls for the bottom-center countdown clock.
// Exposed on both the producer's Show Setup and the host's Live Show
// surfaces so either role can change the length — or start/stop the
// clock — on the fly.
//
// `timerDurationSet` re-anchors `timer.startedAt` server-side when the
// clock is already running, so the new budget takes effect immediately.
// `timerStart` / `timerStop` are explicit — spotlight no longer auto-
// runs the countdown. When stopped the overlay hides the clock entirely.
const PRESETS_SEC = [15, 30, 45, 60, 90] as const;

export function TimerControls() {
  const durationMs = useGameStore((s) => s.timerDurationMs);
  const timerDurationSet = useGameStore((s) => s.timerDurationSet);
  const isRunning = useGameStore((s) => s.timer.startedAt !== null);
  const timerStart = useGameStore((s) => s.timerStart);
  const timerStop = useGameStore((s) => s.timerStop);

  const currentSec = Math.round(durationMs / 1000);

  return (
    <div
      className="flex items-center gap-1"
      style={{ fontFamily: "Inter, sans-serif" }}
      title="Bottom-center countdown clock"
    >
      <Timer className="w-3 h-3 opacity-70" strokeWidth={2.5} />
      <span
        className="text-[10px] uppercase opacity-60 mr-1"
        style={{ letterSpacing: "0.15em" }}
      >
        timer
      </span>
      {PRESETS_SEC.map((sec) => {
        const active = sec === currentSec;
        return (
          <button
            key={sec}
            onClick={() => timerDurationSet(sec * 1000)}
            className="px-1.5 py-0.5 text-[10px] uppercase hover:opacity-80 transition"
            style={{
              border: `1px solid ${active ? "#ffb300" : "#333"}`,
              color: active ? "#ffb300" : "#f0f0f0",
              background: active ? "#ffb30014" : "transparent",
              letterSpacing: "0.08em",
            }}
            aria-pressed={active}
          >
            {sec}s
          </button>
        );
      })}
      {/* Stop swaps in when the clock is running; start takes its place
          when the timer is off. Stopping also hides the clock from the
          overlay entirely (CountdownTimer returns null). */}
      {isRunning ? (
        <button
          onClick={timerStop}
          className="ml-1 px-2 py-0.5 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
          style={{
            background: "#0a0a0a",
            color: "#ff2e6b",
            border: "1px solid #ff2e6b",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.12em",
          }}
          title="Stop the countdown and hide it from the overlay"
        >
          <Square className="w-2.5 h-2.5" strokeWidth={2.5} fill="#ff2e6b" />
          stop
        </button>
      ) : (
        <button
          onClick={timerStart}
          className="ml-1 px-2 py-0.5 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
          style={{
            background: "#ffb300",
            color: "#000",
            border: "1px solid #ffb300",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.12em",
          }}
          title="Start the countdown on the overlay"
        >
          <Play className="w-2.5 h-2.5" strokeWidth={2.5} fill="#000" />
          start
        </button>
      )}
    </div>
  );
}
