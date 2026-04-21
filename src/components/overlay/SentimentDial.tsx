import { useLayoutEffect, useState } from "react";
import { SENTIMENT_MAX, SENTIMENT_MIN } from "../../modes";

interface Props {
  value: number;
  // When true, the needle starts at the low end (red) and swings to the
  // value on mount. When false, it renders directly at the value with no
  // animation — used for the live preview on the contestant phone where
  // the slider drives the needle continuously.
  animate: boolean;
  // Forces the animation to re-fire when it changes (the store bumps
  // voteAnimSeq on each submission). Use it as the React key on the
  // component so each submission re-mounts and re-plays the swing.
  animKey?: number | string;
  // Used for the needle + number colour. Typically the contestant's
  // colour on the overlay; neutral orange elsewhere.
  color?: string;
  // Controls how large the SVG renders. Defaults fill the parent.
  className?: string;
  // Show the big numeric readout at the centre of the dial.
  showValue?: boolean;
}

// Map a value in [SENTIMENT_MIN, SENTIMENT_MAX] onto the -90°..+90° arc
// (0° is straight up), counting clockwise. 1 → -90° (left / red),
// 10 → +90° (right / green).
function valueToDeg(v: number): number {
  const clamped = Math.max(SENTIMENT_MIN, Math.min(SENTIMENT_MAX, v));
  const pct = (clamped - SENTIMENT_MIN) / (SENTIMENT_MAX - SENTIMENT_MIN);
  return -90 + pct * 180;
}

export function SentimentDial({
  value,
  animate,
  animKey,
  color = "#ff9500",
  className,
  showValue = true,
}: Props) {
  // Inline-styled rotation so we can animate smoothly with a CSS
  // transition. We start at -90° (full red) then flip to the real target
  // one frame later — that's what gives the needle its "swing in" feel.
  const target = valueToDeg(value);
  const [current, setCurrent] = useState<number>(animate ? -90 : target);

  useLayoutEffect(() => {
    if (!animate) {
      setCurrent(target);
      return;
    }
    setCurrent(-90);
    const raf = requestAnimationFrame(() => {
      setCurrent(target);
    });
    return () => cancelAnimationFrame(raf);
    // animKey forces a re-swing on resubmission even if the final value
    // happens to be the same number.
  }, [animate, target, animKey]);

  useLayoutEffect(() => {
    if (!animate) setCurrent(target);
  }, [target, animate]);

  // Dial geometry — the SVG viewBox is 100×60 so the arc sits above the
  // needle pivot and there's room for the number readout underneath.
  const cx = 50;
  const cy = 50;
  const radius = 38;

  return (
    <svg
      viewBox="0 0 100 60"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Sentiment score ${value} out of ${SENTIMENT_MAX}`}
    >
      <defs>
        <linearGradient id="sentimentArc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff1744" />
          <stop offset="50%" stopColor="#ffab00" />
          <stop offset="100%" stopColor="#00e676" />
        </linearGradient>
      </defs>

      {/* Outer arc, red → yellow → green. */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        stroke="url(#sentimentArc)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* Tick marks for 1…10, scaled so start/end line up with the arc. */}
      {Array.from({ length: SENTIMENT_MAX - SENTIMENT_MIN + 1 }).map((_, i) => {
        const deg = -90 + (i / (SENTIMENT_MAX - SENTIMENT_MIN)) * 180;
        const rad = (deg * Math.PI) / 180;
        const r1 = radius + 2;
        const r2 = radius + 7;
        const x1 = cx + r1 * Math.sin(rad);
        const y1 = cy - r1 * Math.cos(rad);
        const x2 = cx + r2 * Math.sin(rad);
        const y2 = cy - r2 * Math.cos(rad);
        const isMajor = i === 0 || i === SENTIMENT_MAX - SENTIMENT_MIN;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#f0f0f0"
            strokeWidth={isMajor ? 1.2 : 0.7}
            opacity={isMajor ? 0.9 : 0.55}
          />
        );
      })}

      {/* Needle — a single triangle rotated around the pivot. */}
      <g
        style={{
          transform: `rotate(${current}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: animate
            ? "transform 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "none",
        }}
      >
        <polygon
          points={`${cx - 2.5},${cy + 2} ${cx + 2.5},${cy + 2} ${cx},${cy - radius + 4}`}
          fill={color}
          stroke="#000"
          strokeWidth="0.6"
          style={{ filter: `drop-shadow(0 0 2px ${color})` }}
        />
        <circle cx={cx} cy={cy} r={3.2} fill={color} stroke="#000" strokeWidth="0.6" />
      </g>

      {/* Value readout. */}
      {showValue && (
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize="10"
          fill={color}
          style={{ filter: `drop-shadow(0 0 2px ${color}88)` }}
        >
          {Math.round(value)}
        </text>
      )}
    </svg>
  );
}
