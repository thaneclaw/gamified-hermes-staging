import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Gauge,
  Lightbulb,
  MessageSquare,
  Scale,
  Siren,
  Star,
  TrendingDown,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react";
import { MODES, type ModeKey } from "../../modes";

interface RoundIntroProps {
  mode: ModeKey;
  // Timestamp from the server — used as a React `key` on the wrapper by
  // the caller so this component re-mounts (and replays) on every
  // trigger/retrigger. Accepted here so it's obvious the caller must key
  // us; not otherwise read.
  t: number;
}

// Animation timings shared across every intro (must match the CSS
// keyframes in index.css). The overlay keeps the RoundIntro mounted for
// DURATION_MS, then hides it via opacity-0 via the keyframe end state.
const DURATION_MS = 1500;

// Visual skeleton common to every intro: a tinted fullscreen backdrop,
// the mode's concept-art piece in the upper-middle, the big title, and
// a subtext. The one piece that varies per mode is the `art` node —
// everything else is shared so the intros feel like a set.
//
// The art box defaults to ~38% wide × 30% tall, which is the right size
// for single-icon intros (BUZZ, FINISH THE SENTENCE, MVP, etc.). Intros
// that need a larger block — like market's paired arrows or overunder's
// stacked arrows — pass in an `artBox` override; `titleTop` can also be
// pushed down so the title never collides with the bigger art.
function IntroShell({
  color,
  title,
  art,
  artBox = { top: "18%", width: "38%", height: "30%" },
  titleTop = "54%",
}: {
  color: string;
  title: ReactNode;
  art: ReactNode;
  artBox?: { top: string; width: string; height: string };
  titleTop?: string;
}) {
  return (
    <>
      {/* Backdrop vignette — darkens the stage behind the intro so the
          producer's video tiles recede while the animation plays. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${color}22 0%, #000000ee 55%, #000000f6 100%)`,
          animation: `introBackdrop ${DURATION_MS}ms ease-in-out forwards`,
        }}
      />
      {/* Thin scan-line wash tinted by the mode colour for extra flavour. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(0deg, ${color}14 0 2px, transparent 2px 6px)`,
          animation: `introBackdrop ${DURATION_MS}ms ease-in-out forwards`,
          mixBlendMode: "screen",
        }}
      />

      {/* Art column — the mode-specific iconography, sized relative to
          the overlay aspect so it looks the same at any preview width. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none"
        style={{
          top: artBox.top,
          width: artBox.width,
          height: artBox.height,
        }}
      >
        {/* Halo ring behind the art — expanding, fading. */}
        <div
          className="absolute rounded-full"
          style={{
            width: "60%",
            aspectRatio: "1",
            background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
            boxShadow: `0 0 60px ${color}`,
            animation: `introHalo ${DURATION_MS}ms ease-out forwards`,
          }}
        />
        <div
          className="relative flex items-center justify-center"
          style={{
            width: "100%",
            height: "100%",
            color,
            filter: `drop-shadow(0 0 22px ${color})`,
          }}
        >
          {art}
        </div>
      </div>

      {/* Title — giant, slamming in at ~22% then holding. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
        style={{
          top: titleTop,
          width: "90%",
          fontFamily: "Inter, sans-serif",
          fontSize: "clamp(32px, 7vw, 88px)",
          color: "#f0f0f0",
          letterSpacing: "0.04em",
          lineHeight: 0.95,
          textShadow: `0 0 24px ${color}, 6px 6px 0 #000`,
          animation: `introTitle ${DURATION_MS}ms cubic-bezier(0.2, 1.6, 0.4, 1) forwards`,
          transformOrigin: "center",
        }}
      >
        {title}
      </div>

    </>
  );
}

// Per-mode art. Each art block is pointer-events-none and positioned
// to fill the shell's art column.
const ART_SIZE = "min(18vw, 200px)";

function iconSize() {
  return { width: ART_SIZE, height: ART_SIZE, strokeWidth: 1.6 as const };
}

export function RoundIntro({ mode, t: _t }: RoundIntroProps) {
  const cfg = MODES[mode];
  const color = cfg.color;

  switch (mode) {
    case "buzz":
      return (
        <IntroShell
          color={color}
          title="BUZZ IN"
          art={<Zap {...iconSize()} />}
        />
      );

    case "redlight": {
      // RLGL intro: the two strobe sirens are the hero. They fly in from
      // opposite edges, land with a bounce, then emit pulsing halos of
      // their respective colors. The dark backdrop vignette (same pattern
      // as every other mode intro) sits underneath so the stage recedes
      // and the sirens pop — no full-screen floods or side panels
      // competing with them.
      const sirenSize = "20.7%";
      const renderSiren = (
        side: "left" | "right",
        tone: "#ff1744" | "#00e676",
      ) => {
        const isLeft = side === "left";
        return (
          // Outer div handles horizontal centering (translate -50%) so
          // the inner animated div can own `transform` exclusively —
          // otherwise the keyframe transforms would overwrite the
          // centering offset.
          <div
            className="absolute pointer-events-none"
            style={{
              left: isLeft ? "33%" : "67%",
              top: "30%",
              width: sirenSize,
              height: sirenSize,
              transform: "translate(-50%, 0)",
            }}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{
                animation: `${
                  isLeft ? "introRlglRedEnter" : "introRlglGreenEnter"
                } ${DURATION_MS}ms cubic-bezier(0.2, 1.4, 0.3, 1) forwards`,
              }}
            >
              {/* Halo emitted by the siren — starts invisible and pulses
                  outward after the siren lands. Two staggered rings give
                  the strobing feel without a real particle system. */}
              <div
                className="absolute rounded-full"
                style={{
                  width: "170%",
                  height: "170%",
                  background: `radial-gradient(circle, ${tone}cc 0%, ${tone}55 40%, transparent 70%)`,
                  animation: `introRlglEmit ${DURATION_MS}ms ease-out forwards`,
                  mixBlendMode: "screen",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: "240%",
                  height: "240%",
                  border: `3px solid ${tone}`,
                  boxShadow: `0 0 40px ${tone}`,
                  animation: `introRlglEmit ${DURATION_MS}ms ease-out 80ms forwards`,
                  opacity: 0,
                }}
              />
              <Siren
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  color: tone,
                  fill: tone,
                  filter: `drop-shadow(0 0 30px ${tone}) drop-shadow(0 0 60px ${tone}99)`,
                }}
                strokeWidth={1.6}
              />
            </div>
          </div>
        );
      };
      return (
        <>
          {/* Backdrop vignette — same pattern as IntroShell, using a
              red-to-green radial so the stage still reads as stoplight-y
              without drowning the sirens. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 25% 40%, #ff174422 0%, transparent 40%), radial-gradient(circle at 75% 40%, #00e67622 0%, transparent 40%), radial-gradient(circle at 50% 50%, #00000066 0%, #000000ee 60%, #000000f6 100%)",
              animation: `introBackdrop ${DURATION_MS}ms ease-in-out forwards`,
            }}
          />
          {/* Subtle scan lines (neutral) — keeps the broadcast-y flavor
              without tinting the whole screen. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(0deg, #ffffff0c 0 2px, transparent 2px 6px)",
              animation: `introBackdrop ${DURATION_MS}ms ease-in-out forwards`,
              mixBlendMode: "screen",
            }}
          />

          {renderSiren("left", "#ff1744")}
          {renderSiren("right", "#00e676")}

          {/* Title — "RED LIGHT" over "GREEN LIGHT", stacked on two lines. */}
          <div
            className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
            style={{
              top: "55%",
              width: "92%",
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(32px, 7vw, 88px)",
              color: "#fff",
              letterSpacing: "0.04em",
              lineHeight: 1.05,
              textShadow: "0 0 24px #000, 6px 6px 0 #000",
              animation: `introTitle ${DURATION_MS}ms cubic-bezier(0.2, 1.6, 0.4, 1) forwards`,
              transformOrigin: "center",
            }}
          >
            <div>RED LIGHT</div>
            <div>GREEN LIGHT</div>
          </div>
        </>
      );
    }

    case "word":
      // "WHAT'S THE" reads normally, then "WORD" has each letter
      // underlined individually (border-bottom per letter, with a flex
      // gap between them) so the underlines sit under each character
      // separately instead of as one continuous line.
      return (
        <IntroShell
          color={color}
          title={
            <span
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: "0.3em",
              }}
            >
              <span>WHAT'S THE</span>
              <span style={{ display: "inline-flex", gap: "0.18em" }}>
                {"WORD".split("").map((ch, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      borderBottom: `0.08em solid ${color}`,
                      paddingBottom: "0.08em",
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            </span>
          }
          art={<Type {...iconSize()} />}
        />
      );

    case "bullish":
      return (
        <IntroShell
          color={color}
          title="BULLISH · OR · BULL💩"
          art={
            <div
              className="flex items-center gap-[4%] text-[14vw]"
              style={{ lineHeight: 1 }}
            >
              <span
                style={{
                  animation: `introLeftWeigh ${DURATION_MS}ms ease-in-out forwards`,
                  filter: "drop-shadow(0 0 20px #00e676)",
                }}
              >
                🐂
              </span>
              <span style={{ color, fontSize: "0.5em", letterSpacing: "0.1em" }}>
                ·
              </span>
              <span
                style={{
                  animation: `introRightWeigh ${DURATION_MS}ms ease-in-out forwards`,
                  filter: "drop-shadow(0 0 20px #ff1744)",
                }}
              >
                💩
              </span>
            </div>
          }
        />
      );

    case "market":
      // BUY / SELL: paired arrows sit side-by-side on the same horizontal
      // plane. Originally used `introArrowUp`/`introArrowDown`, which
      // split the icons vertically during the hold frame — one drifting
      // up, the other down — so they read as stacked. Swapped to the
      // scale-only `introLeftWeigh`/`introRightWeigh` pulses so the
      // icons alternate pumping bigger in place without leaving their
      // row. Art box widened so each arrow renders roughly 3× its
      // former display size; title pushed down to make room.
      return (
        <IntroShell
          color={color}
          title="BUY · OR · SELL"
          artBox={{ top: "10%", width: "85%", height: "42%" }}
          titleTop="62%"
          art={
            <div className="flex items-center justify-center gap-[6%] w-full h-full">
              <TrendingUp
                style={{
                  height: "100%",
                  width: "auto",
                  color: "#00e676",
                  animation: `introLeftWeigh ${DURATION_MS}ms ease-in-out forwards`,
                  filter: "drop-shadow(0 0 28px #00e676)",
                }}
                strokeWidth={2.2}
              />
              <TrendingDown
                style={{
                  height: "100%",
                  width: "auto",
                  color: "#ff1744",
                  animation: `introRightWeigh ${DURATION_MS}ms ease-in-out forwards`,
                  filter: "drop-shadow(0 0 28px #ff1744)",
                }}
                strokeWidth={2.2}
              />
            </div>
          }
        />
      );

    case "overunder":
      // OVER / UNDER: arrows stacked vertically — the divergent
      // `introArrowUp` / `introArrowDown` animations semantically
      // reinforce the concept (OVER flies further up, UNDER further
      // down). Art box made tall + ~half the overlay height so each
      // arrow renders roughly 3× its former size; title pushed near
      // the bottom so the enlarged art doesn't collide.
      return (
        <IntroShell
          color={color}
          title="OVER · OR · UNDER"
          artBox={{ top: "4%", width: "50%", height: "58%" }}
          titleTop="70%"
          art={
            <div className="flex flex-col items-center justify-center gap-[2%] w-full h-full">
              <ArrowUp
                style={{
                  height: "48%",
                  width: "auto",
                  color: "#00e676",
                  animation: `introArrowUp ${DURATION_MS}ms ease-out forwards`,
                  filter: "drop-shadow(0 0 28px #00e676)",
                }}
                strokeWidth={2.2}
              />
              <ArrowDown
                style={{
                  height: "48%",
                  width: "auto",
                  color: "#ff1744",
                  animation: `introArrowDown ${DURATION_MS}ms ease-out forwards`,
                  filter: "drop-shadow(0 0 28px #ff1744)",
                }}
                strokeWidth={2.2}
              />
            </div>
          }
        />
      );

    case "sentence":
      return (
        <IntroShell
          color={color}
          title="FINISH THE SENTENCE"
          art={<MessageSquare {...iconSize()} />}
        />
      );

    case "sentiment":
      // Custom art: a small gauge with an animated needle sweeping
      // red → green. Built from an SVG arc so the colour gradient is
      // accurate without relying on an icon.
      return (
        <IntroShell
          color={color}
          title="SENTIMENT SCORE"
          art={
            <div
              className="relative flex items-end justify-center"
              style={{ width: ART_SIZE, height: ART_SIZE }}
            >
              <svg
                viewBox="-50 -50 100 60"
                className="absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="#ff1744" />
                    <stop offset="0.5" stopColor="#ffab00" />
                    <stop offset="1" stopColor="#00e676" />
                  </linearGradient>
                </defs>
                <path
                  d="M -42 0 A 42 42 0 0 1 42 0"
                  fill="none"
                  stroke="url(#gauge-grad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="0" r="3" fill={color} />
                <g
                  style={{
                    animation: `introSweep ${DURATION_MS}ms cubic-bezier(0.3, 1.3, 0.6, 1) forwards`,
                    transformOrigin: "0 0",
                  }}
                >
                  <Gauge style={{ display: "none" }} />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-38"
                    stroke="#f0f0f0"
                    strokeWidth="3"
                    strokeLinecap="round"
                    style={{
                      filter: `drop-shadow(0 0 8px ${color})`,
                    }}
                  />
                </g>
              </svg>
            </div>
          }
        />
      );

    case "fairfoul":
      return (
        <IntroShell
          color={color}
          title="FAIR · OR · FOUL"
          art={
            <Scale
              style={{
                ...iconSize(),
                animation: `introTip ${DURATION_MS}ms ease-in-out forwards`,
                transformOrigin: "center",
              }}
            />
          }
        />
      );

    case "mvp":
      return (
        <IntroShell
          color={color}
          title="WHO'S YOUR MVP?"
          art={
            <Star
              style={{
                ...iconSize(),
                fill: color,
                animation: `introHalo ${DURATION_MS}ms ease-out forwards, pulseGlow 1.2s ease-in-out infinite`,
              }}
            />
          }
        />
      );

    case "whatstheplay":
      // Multi-choice producer-seeded plays plus a "type your own" slot.
      // The intro uses a big Lightbulb as the hero — same idiom as
      // "got an idea" — pulsing once as it lands so the bulb reads as
      // "flicking on" when the round kicks off.
      return (
        <IntroShell
          color={color}
          title="WHAT'S THE PLAY?"
          art={
            <Lightbulb
              style={{
                ...iconSize(),
                fill: color,
                animation: `introHalo ${DURATION_MS}ms ease-out forwards, pulseGlow 1.2s ease-in-out infinite`,
              }}
            />
          }
        />
      );

    case "biggerdeal":
    case "whoyagot": {
      // Both modes share the same art + animation — just swap the
      // intro title so the branding matches whichever the producer
      // picked (biggerdeal → "WHICH IS THE BIGGER DEAL?",
      // whoyagot → "WHO YA GOT?").
      const title =
        mode === "whoyagot" ? "WHO YA GOT?" : "WHICH IS THE BIGGER DEAL?";
      return (
        <IntroShell
          color={color}
          title={title}
          art={
            <div className="flex items-center gap-[8%] w-full h-full">
              <div
                className="flex-1 flex items-center justify-center"
                style={{
                  animation: `introLeftWeigh ${DURATION_MS}ms ease-in-out forwards`,
                }}
              >
                <ArrowUp
                  style={{
                    width: "70%",
                    height: "auto",
                    color: "#00e5ff",
                    filter: "drop-shadow(0 0 20px #00e5ff)",
                  }}
                  strokeWidth={2.2}
                />
              </div>
              <div
                style={{
                  color,
                  fontFamily: "Inter, sans-serif",
                  fontSize: "clamp(24px, 4vw, 48px)",
                  letterSpacing: "0.1em",
                  textShadow: `0 0 16px ${color}`,
                }}
              >
                VS
              </div>
              <div
                className="flex-1 flex items-center justify-center"
                style={{
                  animation: `introRightWeigh ${DURATION_MS}ms ease-in-out forwards`,
                }}
              >
                <ArrowDown
                  style={{
                    width: "70%",
                    height: "auto",
                    color: "#ff2e6b",
                    filter: "drop-shadow(0 0 20px #ff2e6b)",
                  }}
                  strokeWidth={2.2}
                />
              </div>
            </div>
          }
        />
      );
    }
  }
}
