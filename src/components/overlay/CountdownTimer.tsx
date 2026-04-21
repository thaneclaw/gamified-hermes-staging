import { useEffect, useState } from "react";
import { useGameStore } from "../../state/store";

// Format ±ms into a whole-seconds integer string. Overtime renders with
// a leading minus. Seconds-only keeps the clock readable in a small
// circle and avoids the minutes:seconds layout drifting off-center
// when the digit count changes.
function formatSeconds(totalMs: number): string {
  const neg = totalMs < 0;
  const abs = Math.ceil(Math.abs(totalMs) / 1000);
  // Positive: use ceil so the clock reads "30" at t=0 and flips to "29"
  // one tick later. Overtime: floor the magnitude so it reads "-1" one
  // second after hitting zero (not at zero itself).
  const whole = neg
    ? Math.floor(Math.abs(totalMs) / 1000)
    : abs;
  return `${neg ? "-" : ""}${whole}`;
}

// Countdown clock. Runs only when the host/producer has explicitly hit
// "start" — otherwise the component renders nothing (revealing the
// backdrop underneath). When the countdown reaches zero the time keeps
// running into the negative and the ring + text pulse red so the host
// notices the overage.
//
// Position and size come from `layout.timer` so the producer can drag
// the clock anywhere on stage via the layout editor.
export function CountdownTimer() {
  const timer = useGameStore((s) => s.timer);
  const durationMs = useGameStore((s) => s.timerDurationMs);
  const rect = useGameStore((s) => s.layout.timer);

  // Local "now" cursor so the digits actually advance — we don't get tick
  // events from the server. 250ms keeps CPU modest and the display smooth
  // enough; the ring pulse is driven by CSS so the effective cadence is
  // 60fps regardless.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (timer.startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer.startedAt]);

  if (timer.startedAt === null) return null;

  const elapsed = now - timer.startedAt;
  const remaining = durationMs - elapsed;
  const isOvertime = remaining < 0;

  // Colors: normal = mode-agnostic amber (reads well against the studio
  // backdrop); overtime = saturated red with a pulse animation.
  const normalColor = "#ffb300";
  const overColor = "#ff1744";
  const ringColor = isOvertime ? overColor : normalColor;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        zIndex: 4,
        // containerType sits on the OUTER wrapper so children can use
        // `cqw` units against the timer's rendered width (self-referencing
        // cqw on the same element does not resolve).
        containerType: "inline-size",
        animation: isOvertime ? "timerPulse 0.9s ease-in-out infinite" : undefined,
      }}
    >
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center"
        style={{
          background: "#000",
          border: "3px solid",
          borderColor: ringColor,
          boxShadow: `0 0 18px ${ringColor}cc, inset 0 0 12px ${ringColor}55`,
        }}
      >
        <span
          style={{
            // A clean sans-serif stack avoids the slight baseline dip
            // some monospace fonts show inside a fixed-height line box —
            // which was making the digits look off-center in the circle.
            fontFamily: "Inter, system-ui, sans-serif",
            color: ringColor,
            // Scales with the timer's own width thanks to the
            // containerType on the wrapper above.
            fontSize: "clamp(14px, 42cqw, 120px)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            // Flex centers the box; text-align handles the glyph's own
            // horizontal balance when rendered.
            textAlign: "center",
            textShadow: `0 0 8px ${ringColor}`,
            // Tabular figures keep digit widths uniform so "30" → "9"
            // doesn't jump.
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatSeconds(remaining)}
        </span>
      </div>
    </div>
  );
}
