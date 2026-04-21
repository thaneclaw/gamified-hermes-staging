import { Fragment, useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CARDS } from "../../cards";
import { MODES, decodePlayVote } from "../../modes";
import type { ContestantSlotKey } from "../../slots";
import { BACKDROP_SRC, computeLayoutRects } from "../../slots";
import {
  selectEffectBy,
  selectEffectTarget,
  selectGameMode,
  selectWinner,
  useGameStore,
} from "../../state/store";
import { POS_GREEN, POS_RED, RLGLCenterTile } from "./RLGLCenterTile";
import { RoundIntro } from "./RoundIntro";
import { SentimentDial } from "./SentimentDial";
import { CountdownTimer } from "./CountdownTimer";
import { FitText } from "../shared/FitText";

// Must match RoundIntro's internal DURATION_MS. The wrapper stops
// rendering the intro after this window so it stops occluding the
// tiles — the CSS keyframes already fade to 0 at 100% but we unmount
// for correctness.
const ROUND_INTRO_DURATION_MS = 1500;

// Total length of the sentiment-score fly animation. Kept in lockstep
// with the `sentimentNumberFly` keyframe in index.css — when this
// elapses we let the tile's placard swap to the sentiment banner,
// giving the illusion of the digit "landing" in the name bar.
const SENTIMENT_FLY_MS = 2000;

// How long the MVP winner celebration plays before the full-screen
// overlay fades out. Chasing marquee lights around the winner's tile
// stay on for the rest of the round — they only disappear when the
// round closes (tally flips back to incomplete).
const MVP_CELEBRATION_MS = 6000;

// Gold used everywhere MVP mode needs to reach for a "winner" color —
// the marquee bulbs, the celebration title, the star shower. Matches
// MODES.mvp.color so the mode's palette carries through.
const MVP_GOLD = "#ffd700";

interface OverlayPreviewProps {
  // When true, render a dummy topic bar even with no live round so the
  // layout editor can show what's being positioned.
  showTopicPlaceholder?: boolean;
  // Single spotlit contestant id (or null). Lives on the server so the
  // host, producer, and real OBS overlay all agree on who's on the hot
  // seat. Passing `undefined` leaves spotlighting disabled for that
  // consumer — callers that want to drive it should supply both this
  // and `onToggleSpotlight`.
  spotlightId?: string | null;
  // Supplying this opts-in to clickable tiles. Calling with the current
  // spotlight id clears it; calling with a different id switches and
  // resets the countdown. Not passing it keeps the overlay inert (what
  // the real /overlay route wants).
  onToggleSpotlight?: (id: string) => void;
  // When true (and `onRename` is supplied), each name placard becomes an
  // inline input — click a name to rename that contestant. Tile clicks no
  // longer toggle spotlight while this is on, so the producer can edit
  // without accidentally stealing the hot seat.
  editNamesMode?: boolean;
  onRename?: (id: string, name: string) => void;
}

export function OverlayPreview({
  showTopicPlaceholder = false,
  spotlightId,
  onToggleSpotlight,
  editNamesMode = false,
  onRename,
}: OverlayPreviewProps = {}) {
  const contestants = useGameStore((s) => s.contestants);
  const buzzer = useGameStore((s) => s.buzzer);
  const reactions = useGameStore((s) => s.reactions);
  const activeEffect = useGameStore((s) => s.activeEffect);
  const debateTick = useGameStore((s) => s.debateTick);
  const positions = useGameStore((s) => s.positions);
  const debateActive = useGameStore((s) => s.debateActive);
  const votes = useGameStore((s) => s.votes);
  const revealed = useGameStore((s) => s.revealed);
  const voteAnimSeq = useGameStore((s) => s.voteAnimSeq);
  const rawWinner = useGameStore(selectWinner);
  const effectBy = useGameStore(selectEffectBy);
  const effectTarget = useGameStore(selectEffectTarget);
  const gameMode = useGameStore(selectGameMode);
  // In WHAT'S THE WORD mode the server still records who hit submit
  // first (so hosts/producers can see priority in the submissions panel),
  // but the overlay should stay quiet — no tile glow, no hot-seat slam on
  // the main stage. The typed answer reads through the placard's
  // bannerSwap only. Suppress the "winner" selector for word mode so all
  // downstream highlight logic (outline, box-shadow, buzzPulse, ring
  // burst, center-stage name) treats it as "no one buzzed".
  const winner = gameMode === "word" ? null : rawWinner;
  const activeRound = useGameStore((s) =>
    s.rounds.find((r) => r.id === s.activeRoundId) ?? null,
  );
  const roundIntro = useGameStore((s) => s.roundIntro);
  const layout = useGameStore((s) => s.layout);
  // Host/producer fires the MVP celebration manually — marquee lights +
  // full-screen flourish both gate on this flag so everyone stays calm
  // until the host says "reveal". See state.mvpWinnerReveal/Hide.
  const mvpWinnerRevealed = useGameStore((s) => s.mvpWinnerRevealed);

  // Unmount the intro once its animation window has elapsed. We can't
  // rely on the CSS alone because the node stays in the DOM between
  // trigger events and we don't want a ghost intro visible if the
  // animation's "fade to opacity 0" end-state is overridden by a new
  // trigger mid-stream. `introKey` flips whenever roundIntro.t changes,
  // restarting the timer.
  //
  // NOTE: the effect depends on `introKey` (a primitive) rather than the
  // `roundIntro` object. The server re-broadcasts the full state on every
  // action (buzz, card play, vote, …) and that replaces `roundIntro` with
  // a new object reference even when its contents are identical. Keying
  // the effect on the primitive `t` (or 0 for "no intro") prevents those
  // unrelated broadcasts from remounting <RoundIntro> and replaying its
  // CSS animations on top of the contestant's action animation.
  const introKey = roundIntro ? roundIntro.t : 0;
  const [introActive, setIntroActive] = useState(false);
  useEffect(() => {
    if (introKey === 0) {
      setIntroActive(false);
      return;
    }
    setIntroActive(true);
    const id = setTimeout(() => setIntroActive(false), ROUND_INTRO_DURATION_MS);
    return () => clearTimeout(id);
  }, [introKey]);

  // Per-contestant gate for the sentiment banner. We only want the
  // placard to swap to the score AFTER the flying digit has dropped
  // into the name bar — before that, the placard keeps showing the
  // default name while the dial swings and the digit flies overhead.
  // Keyed by contestant id → the `vote.t` we've already landed for.
  const [sentimentLanded, setSentimentLanded] = useState<Record<string, number>>({});
  useEffect(() => {
    const timers: number[] = [];
    contestants.forEach((c) => {
      const v = votes[c.id];
      if (v?.kind === "sentiment-score" && sentimentLanded[c.id] !== v.t) {
        const elapsed = Date.now() - v.t;
        const remaining = Math.max(0, SENTIMENT_FLY_MS - elapsed);
        const id = window.setTimeout(() => {
          setSentimentLanded((prev) =>
            prev[c.id] === v.t ? prev : { ...prev, [c.id]: v.t },
          );
        }, remaining);
        timers.push(id);
      }
    });
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
    // sentimentLanded in deps would loop forever; we intentionally read
    // it via the functional setState callback instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes, contestants]);

  const rects = useMemo(() => computeLayoutRects(layout), [layout]);
  const SLOTS = rects.slots;
  const PLACARDS = rects.placards;
  const TOPIC_BAR = rects.topicBar;

  // ── MVP tally + winner(s) ────────────────────────────────────────────
  // When every contestant has locked AND revealed their MVP pick, we
  // tally the vote targets and find whoever has the most votes. Ties
  // yield multiple winners (all shown in the celebration, all get
  // marquee lights). Everything below is gated on `mvpTallyComplete`
  // so it's inert outside MVP mode — the tile map reads `mvpWinnerIds`
  // for the marquee strips, and the full-screen overlay at the bottom
  // of the render reads `celebrationActive` + `mvpWinners`.
  const isMvpRound = activeRound?.mode === "mvp";
  const mvpTally = useMemo(() => {
    if (!isMvpRound) return null;
    const counts: Record<string, number> = {};
    for (const c of contestants) {
      const v = votes[c.id];
      if (v?.kind === "mvp-pick" && revealed[c.id]) {
        counts[v.value] = (counts[v.value] ?? 0) + 1;
      }
    }
    return counts;
  }, [isMvpRound, contestants, votes, revealed]);

  // Tally is "complete" when every contestant has both locked a pick
  // AND revealed it. Once true, we have enough to declare a winner and
  // fire the celebration.
  const mvpTallyComplete = useMemo(() => {
    if (!isMvpRound) return false;
    if (contestants.length === 0) return false;
    return contestants.every(
      (c) => votes[c.id]?.kind === "mvp-pick" && revealed[c.id],
    );
  }, [isMvpRound, contestants, votes, revealed]);

  const mvpWinners = useMemo(() => {
    if (!mvpTallyComplete || !mvpTally) return [];
    const values = Object.values(mvpTally);
    const max = values.length > 0 ? Math.max(...values) : 0;
    if (max === 0) return [];
    // Ties return every winner; slot order stabilizes the ordering so
    // the celebration reads the same across clients.
    return contestants.filter((c) => (mvpTally[c.id] ?? 0) === max);
  }, [mvpTally, mvpTallyComplete, contestants]);

  const mvpWinnerIds = useMemo(
    () => new Set(mvpWinners.map((c) => c.id)),
    [mvpWinners],
  );

  // Play the full-screen celebration once when the host/producer fires
  // "reveal winner"; hide it after MVP_CELEBRATION_MS. The marquee lights
  // stay on (they gate on `mvpWinnerRevealed` directly, not this flag)
  // until the host hides the winner or the round closes. If they toggle
  // hide → reveal mid-celebration, the effect restarts cleanly.
  const [celebrationActive, setCelebrationActive] = useState(false);
  useEffect(() => {
    if (!mvpWinnerRevealed) {
      setCelebrationActive(false);
      return;
    }
    setCelebrationActive(true);
    const id = window.setTimeout(
      () => setCelebrationActive(false),
      MVP_CELEBRATION_MS,
    );
    return () => clearTimeout(id);
  }, [mvpWinnerRevealed]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "1654/936",
        backgroundImage: `url(${BACKDROP_SRC})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid #222",
      }}
    >
      {/* Scan-line atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px)",
          mixBlendMode: "overlay",
          opacity: 0.5,
        }}
      />

      {/* Simulated video feeds, positioned absolutely over the studio backdrop slots */}
      {contestants.map((c) => {
        const slot = SLOTS[c.slot];
        const isWinner = winner?.id === c.id;
        const isSpotlit = spotlightId === c.id;
        const isTarget = effectTarget?.id === c.id;
        const isBy = effectBy?.id === c.id;
        const interrupted = activeEffect?.type === "interrupt" && isTarget;
        const debating =
          activeEffect?.type === "quickdebate" && (isBy || isTarget);
        const debateActiveQD =
          debating &&
          ((debateTick % 2 === 0 && isBy) || (debateTick % 2 === 1 && isTarget));
        const position = gameMode === "redlight" ? positions[c.id] : null;
        const posColor =
          position === "green" ? POS_GREEN : position === "red" ? POS_RED : null;

        const vote = votes[c.id] ?? null;
        const voteTick = voteAnimSeq[c.id] ?? 0;
        const modeCfg = MODES[gameMode];
        const voteOption =
          vote?.kind === "vote-anim" && modeCfg.options
            ? modeCfg.options.find((o) => o.key === vote.value)
            : null;
        const isTyped = vote?.kind === "typed-buzz";
        const isHidden = vote?.kind === "hidden-answer";
        const isMvp = vote?.kind === "mvp-pick";
        // Spotlighting a contestant in MVP mode auto-reveals their
        // pick. Manual reveal still works as an override.
        const isRevealed =
          ((isHidden || isMvp) && !!revealed[c.id]) ||
          (isMvp && isSpotlit);
        const mvpTargetContestant =
          isMvp && vote
            ? (contestants.find((x) => x.id === vote.value) ?? null)
            : null;
        const isSentiment = vote?.kind === "sentiment-score";
        const sentimentScore = isSentiment ? Number(vote.value) : null;
        // Bigger-deal: labels + colours come from activeRound.choices
        // (the producer types them in the rundown).
        const isBiggerDeal = vote?.kind === "bigger-deal";
        const biggerIdx = isBiggerDeal ? Number(vote.value) : -1;
        const biggerLabel =
          biggerIdx >= 0
            ? (activeRound?.choices?.[biggerIdx] ??
              (biggerIdx === 0 ? "OPTION A" : "OPTION B"))
            : null;
        const biggerColor =
          biggerIdx === 0 ? "#00e5ff" : biggerIdx === 1 ? "#ff2e6b" : null;
        // WHAT'S THE PLAY: decode once so the banner can read either a
        // preset label (from activeRound.choices) or a freeform call
        // the contestant typed. Freeform is tagged visually with "MY
        // CALL" so viewers can tell the two apart on air.
        const isPlay = vote?.kind === "play-pick";
        const playSel = isPlay ? decodePlayVote(vote.value) : null;
        const playLabel = playSel
          ? playSel.kind === "custom"
            ? playSel.text
            : (activeRound?.choices?.[playSel.index] ??
              `OPTION ${String.fromCharCode(65 + playSel.index)}`)
          : null;

        // Lower-third banner — swaps in for the default name bar when a
        // submission lands (buzz, position, word, vote, lock, reveal).
        // `key` is the only field that needs to change between states —
        // that's what triggers the bannerSwap slam-up animation.
        let banner: {
          bg: string;
          fg: string;
          primary: string;
          secondary: string;
          key: string;
        };
        if (isWinner && buzzer) {
          banner = {
            bg: c.color,
            fg: "#000",
            primary: isTyped && vote ? `"${vote.value}"` : "BUZZED",
            secondary: c.name,
            key: `buzzed-${c.id}-${buzzer.t}`,
          };
        } else if (position === "green") {
          banner = {
            bg: POS_GREEN,
            fg: "#000",
            primary: "GREEN",
            secondary: c.name,
            key: `pos-green-${c.id}`,
          };
        } else if (position === "red") {
          banner = {
            bg: POS_RED,
            fg: "#000",
            primary: "RED",
            secondary: c.name,
            key: `pos-red-${c.id}`,
          };
        } else if (isTyped && vote) {
          banner = {
            bg: c.color,
            fg: "#000",
            primary: `"${vote.value}"`,
            secondary: c.name,
            key: `typed-${c.id}-${vote.t}`,
          };
        } else if (voteOption && vote) {
          banner = {
            bg: voteOption.color,
            fg: "#000",
            primary: voteOption.label,
            secondary: `${voteOption.emoji} ${c.name}`,
            key: `vote-${c.id}-${vote.t}`,
          };
        } else if (isBiggerDeal && vote && biggerLabel && biggerColor) {
          banner = {
            bg: biggerColor,
            fg: "#000",
            primary: biggerLabel,
            secondary: c.name,
            key: `biggerdeal-${c.id}-${vote.t}`,
          };
        } else if (isPlay && vote && playLabel) {
          // WHAT'S THE PLAY banner. Preset picks and freeform calls read
          // identically — just the label on a solid mode-colour chip.
          // (We keep `playIsCustom` around for potential future styling,
          // but viewers don't need a "MY CALL:" tag to parse the read.)
          banner = {
            bg: MODES.whatstheplay.color,
            fg: "#000",
            primary: playLabel,
            secondary: c.name,
            key: `play-${c.id}-${vote.t}`,
          };
        } else if (
          isSentiment &&
          vote &&
          sentimentScore != null &&
          sentimentLanded[c.id] === vote.t
        ) {
          // Interpolate red → yellow → green across 1…10 so the placard
          // matches the needle's final position on the dial. Gated on
          // sentimentLanded so the banner only swaps in after the flying
          // digit has reached the name bar (see `sentimentNumberFly`).
          const pct = (sentimentScore - 1) / 9;
          const hue = pct * 120; // 0 = red, 60 = yellow, 120 = green
          const bg = `hsl(${hue}, 85%, 48%)`;
          banner = {
            bg,
            fg: "#000",
            primary: `${sentimentScore}/10`,
            secondary: c.name,
            key: `sentiment-${c.id}-${vote.t}`,
          };
        } else if (isHidden && isRevealed && vote) {
          banner = {
            bg: MODES.sentence.color,
            fg: "#000",
            primary: vote.value,
            secondary: c.name,
            key: `reveal-${c.id}-${vote.t}`,
          };
        } else if (isHidden && vote) {
          banner = {
            bg: "#1a1a1a",
            fg: MODES.sentence.color,
            primary: "LOCKED",
            secondary: c.name,
            key: `lock-${c.id}-${vote.t}`,
          };
        } else if (isMvp && isRevealed && vote && mvpTargetContestant) {
          banner = {
            bg: MODES.mvp.color,
            fg: "#000",
            primary: `MVP: ${mvpTargetContestant.name.toUpperCase()}`,
            secondary: c.name,
            key: `mvp-reveal-${c.id}-${vote.t}`,
          };
        } else if (isMvp && vote) {
          banner = {
            bg: "#1a1a1a",
            fg: MODES.mvp.color,
            primary: "MVP LOCKED",
            secondary: c.name,
            key: `mvp-lock-${c.id}-${vote.t}`,
          };
        } else {
          banner = {
            bg: c.color,
            fg: "#000",
            primary: c.name,
            secondary: "LIVE",
            key: `default-${c.id}`,
          };
        }

        // Contestants never occupy the CENTER slot (that's reserved for the
        // featured video). Safe to narrow here.
        const placard = PLACARDS[c.slot as ContestantSlotKey];

        return (
          <Fragment key={c.id}>
            {/* Tile frame — transparent so the VDO Ninja video feed shows
                through. Only the outline + glow + per-tile animations
                render here. When onSpotlight is supplied (producer's
                preview), the tile also catches clicks to toggle the
                spotlight for that contestant. */}
            <div
              className={`absolute overflow-hidden ${
                onToggleSpotlight && !editNamesMode
                  ? "cursor-pointer"
                  : "pointer-events-none"
              }`}
              onClick={
                onToggleSpotlight && !editNamesMode
                  ? () => onToggleSpotlight(c.id)
                  : undefined
              }
              style={{
                left: slot.left,
                top: slot.top,
                width: slot.width,
                height: slot.height,
                // Corner radius as a % of the tile width — tracks the
                // scaled tile size so the rounded corners keep matching
                // the backdrop's video-frame cutouts.
                borderRadius: `${layout.tileCornerRadius ?? 12}%`,
                outline: posColor
                  ? `4px solid ${posColor}`
                  : isWinner
                    ? `4px solid ${c.color}`
                    : debating
                      ? `2px solid ${CARDS.quickdebate.color}`
                      : "1px solid rgba(255,255,255,0.2)",
                outlineOffset: "0",
                boxShadow: posColor
                  ? `0 0 30px ${posColor}, inset 0 0 40px ${posColor}33`
                  : isWinner
                    ? `0 0 35px ${c.color}, 0 0 70px ${c.color}99, inset 0 0 30px ${c.color}33`
                    : debateActiveQD
                      ? `0 0 25px ${CARDS.quickdebate.color}`
                      : undefined,
                animation: isWinner ? "buzzPulse 0.7s ease-out" : undefined,
                opacity: interrupted ? 0.25 : debating && !debateActiveQD ? 0.45 : 1,
                transition: "opacity 0.3s, box-shadow 0.3s",
              }}
            >
              {/* Reactions float up from within the tile area. */}
              {reactions
                .filter((r) => r.contestantId === c.id)
                .map((r) => (
                  <div
                    key={r.id}
                    className="absolute text-3xl"
                    style={{
                      bottom: "20%",
                      left: `${20 + ((r.id * 13) % 60)}%`,
                      animation: "floatUp 2.2s ease-out forwards",
                    }}
                  >
                    {r.emoji}
                  </div>
                ))}

              {/* Per-tile effect overlays */}
              {interrupted && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: "flashRed 0.4s ease-out" }}
              >
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "clamp(18px, 3vw, 36px)",
                    color: CARDS.interrupt.color,
                    textShadow: `0 0 15px ${CARDS.interrupt.color}`,
                    transform: "rotate(-8deg)",
                  }}
                >
                  SHH!
                </div>
              </div>
            )}

            {/* Ring-burst flash on the winner's tile edge. The banner swap
                below carries the textual "BUZZED" indicator. */}
            {isWinner && buzzer && (
              <div
                key={buzzer.t}
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 0 2px ${c.color}`,
                  animation: "buzzRing 0.8s ease-out forwards",
                  opacity: 0,
                }}
              />
            )}

            {/* Bigger-deal vote: no in-tile stamp. The call slams up in
                the name bar via the bannerSwap animation — that's the
                whole reveal. Keeping the video clean helps the
                contestant's face read during the call. */}

            {/* Dial is only mounted while the flying digit hasn't landed
                in the name bar yet. `sentimentDialHide` fades it out in
                lockstep with the digit's descent (last ~25% of the
                SENTIMENT_FLY_MS window), then the parent `sentimentLanded`
                gate unmounts it entirely so the video feed reads clean
                once the placard has swapped to show the score. */}
            {isSentiment &&
              sentimentScore != null &&
              vote &&
              sentimentLanded[c.id] !== vote.t && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    padding: "10%",
                    animation: `sentimentDialHide ${SENTIMENT_FLY_MS}ms linear forwards`,
                  }}
                >
                  <SentimentDial
                    key={voteTick}
                    value={sentimentScore}
                    animate
                    animKey={voteTick}
                    color={c.color}
                    className="w-full h-full"
                    showValue={false}
                  />
                </div>
              )}

            {/* Flying digit: pops in next to the needle after the swing,
                holds for a beat, then drops into the placard below. Only
                rendered while the banner gate hasn't landed — once the
                placard swaps to the sentiment banner, this element is
                unmounted and its job is done.

                The start position tracks the needle tip for the chosen
                value (tileX derived from a -90°..+90° sweep); the end
                position rides off the bottom edge of the tile so the
                placard's `bannerSwap` animation picks up the digit as it
                slams up from the name bar beneath. */}
            {isSentiment &&
              vote &&
              sentimentScore != null &&
              sentimentLanded[c.id] !== vote.t && (() => {
                // Needle tip in SVG coords (100×60 viewBox, pivot 50,50,
                // length 34). θ = -90° at score 1, +90° at score 10.
                const theta =
                  (-90 + ((sentimentScore - 1) / 9) * 180) * (Math.PI / 180);
                const svgX = 50 + 34 * Math.sin(theta);
                const svgY = 50 - 34 * Math.cos(theta);
                // Approximate mapping from SVG coords to tile % — assumes
                // a near-square tile with the dial letterboxed into the
                // 80%-padded interior (SVG fits by width, so vertical
                // letterbox). Good enough to read as "on the needle" at
                // any realistic tile aspect; exact alignment would need
                // runtime measurement.
                const startLeft = 10 + 0.8 * svgX;
                const startTop = 26 + 0.813 * svgY;
                return (
                  <div
                    key={`sentiment-fly-${voteTick}`}
                    className="absolute pointer-events-none"
                    style={
                      {
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 900,
                        color: c.color,
                        fontSize: "clamp(16px, 4.5cqw, 64px)",
                        containerType: "inline-size",
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                        textShadow: `0 0 10px ${c.color}, 0 2px 6px rgba(0,0,0,0.8)`,
                        animation: `sentimentNumberFly ${SENTIMENT_FLY_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
                        zIndex: 3,
                        "--fly-start-top": `${startTop}%`,
                        "--fly-start-left": `${startLeft}%`,
                        "--fly-end-top": "100%",
                      } as React.CSSProperties
                    }
                  >
                    {sentimentScore}
                  </div>
                );
              })()}

            {/* Vote-anim tile effects. Only BULLISH keeps the in-tile
                arrow + rotated label stamp — the directional flourish
                reads well for that binary. Fair/Foul, Buy/Sell (market),
                and Over/Under all skip the stamp so nothing covers the
                contestant's face on the video feed; the call still slams
                up on the name-tag placard via the bannerSwap animation. */}
            {voteOption && gameMode === "bullish" && (
              <div
                key={voteTick}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: voteOption.color,
                    opacity: 0.3,
                    animation: "flashOnce 0.6s ease-out",
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    animation:
                      voteOption.arrow === "up"
                        ? "arrowUp 1.4s cubic-bezier(0.2,1,0.3,1) forwards"
                        : "arrowDown 1.4s cubic-bezier(0.2,1,0.3,1) forwards",
                  }}
                >
                  {voteOption.arrow === "up" ? (
                    <TrendingUp
                      className="w-16 h-16"
                      style={{
                        color: voteOption.color,
                        filter: `drop-shadow(0 0 12px ${voteOption.color})`,
                      }}
                      strokeWidth={3}
                    />
                  ) : (
                    <TrendingDown
                      className="w-16 h-16"
                      style={{
                        color: voteOption.color,
                        filter: `drop-shadow(0 0 12px ${voteOption.color})`,
                      }}
                      strokeWidth={3}
                    />
                  )}
                </div>
                <div
                  className="relative"
                  style={{
                    animation: "slamIn 0.35s cubic-bezier(0.2,1.5,0.4,1)",
                  }}
                >
                  <div
                    className="px-2 py-0.5"
                    style={{
                      background: voteOption.color,
                      color: "#000",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "clamp(14px, 2vw, 24px)",
                      letterSpacing: "0.06em",
                      boxShadow: `4px 4px 0 #000, 0 0 25px ${voteOption.color}`,
                      transform: "rotate(-4deg)",
                    }}
                  >
                    {voteOption.label}
                  </div>
                </div>
              </div>
            )}

            </div>

            {/* MVP winner marquee lights. Four edge bands of chasing
                gold bulbs wrap the winner's tile after the tally is in;
                they stay on for the rest of the round so everyone knows
                who took MVP. Each band tiles a radial-gradient bulb and
                animates background-position — alternating direction top
                vs. bottom (and left vs. right) so the chase walks around
                the tile instead of all drifting the same way.

                Bands live outside the tile frame's border-radius by a
                few pixels so they read as a proscenium around the video
                rather than painted onto it. */}
            {mvpWinnerRevealed && mvpTallyComplete && mvpWinnerIds.has(c.id) && (() => {
              const bulbH =
                `radial-gradient(circle, ${MVP_GOLD} 40%, transparent 45%)`;
              const stripShared = {
                position: "absolute" as const,
                filter: `drop-shadow(0 0 6px ${MVP_GOLD}) drop-shadow(0 0 12px ${MVP_GOLD}99)`,
              };
              return (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: slot.left,
                    top: slot.top,
                    width: slot.width,
                    height: slot.height,
                    zIndex: 3,
                  }}
                >
                  {/* Top strip — bulbs drift left → right. Bands extend
                      a few px past each horizontal edge so the
                      perpendicular strips kiss them at the corners
                      for a continuous proscenium halo. Bulbs are
                      half-size (7px strip, 11px tile) so the chase
                      reads as fine marquee dots rather than blobs. */}
                  <div
                    style={{
                      ...stripShared,
                      left: -3,
                      right: -3,
                      top: -5,
                      height: 7,
                      backgroundImage: bulbH,
                      backgroundSize: "11px 7px",
                      backgroundRepeat: "repeat-x",
                      backgroundPosition: "0 center",
                      animation: "marqueeChaseH 0.6s linear infinite",
                    }}
                  />
                  {/* Bottom strip — reverse direction (right → left) so
                      the chase reads as circling the frame. */}
                  <div
                    style={{
                      ...stripShared,
                      left: -3,
                      right: -3,
                      bottom: -5,
                      height: 7,
                      backgroundImage: bulbH,
                      backgroundSize: "11px 7px",
                      backgroundRepeat: "repeat-x",
                      backgroundPosition: "0 center",
                      animation:
                        "marqueeChaseH 0.6s linear infinite reverse",
                    }}
                  />
                  {/* Left strip — bulbs drift top → bottom. */}
                  <div
                    style={{
                      ...stripShared,
                      top: -3,
                      bottom: -3,
                      left: -5,
                      width: 7,
                      backgroundImage: bulbH,
                      backgroundSize: "7px 11px",
                      backgroundRepeat: "repeat-y",
                      backgroundPosition: "center 0",
                      animation: "marqueeChaseV 0.6s linear infinite",
                    }}
                  />
                  {/* Right strip — reverse so the chase circles. */}
                  <div
                    style={{
                      ...stripShared,
                      top: -3,
                      bottom: -3,
                      right: -5,
                      width: 7,
                      backgroundImage: bulbH,
                      backgroundSize: "7px 11px",
                      backgroundRepeat: "repeat-y",
                      backgroundPosition: "center 0",
                      animation:
                        "marqueeChaseV 0.6s linear infinite reverse",
                    }}
                  />
                </div>
              );
            })()}

            {/* Spotlight ring — producer-side helper. Pulses in the
                contestant's colour so the host can eyeball which player
                is being pointed at during setup. Rendered as a separate
                overlay with pointer-events-none so clicks still hit the
                tile frame underneath and can toggle the spotlight off. */}
            {isSpotlit && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: slot.left,
                  top: slot.top,
                  width: slot.width,
                  height: slot.height,
                  borderRadius: `${layout.tileCornerRadius ?? 12}%`,
                  outline: `3px solid ${c.color}`,
                  outlineOffset: "0",
                  boxShadow: `0 0 28px ${c.color}cc, inset 0 0 20px ${c.color}44`,
                  animation: "pulseGlow 1.4s ease-in-out infinite",
                }}
              />
            )}

            {/* Name placard — sits in the small nameplate tab baked into
                the backdrop under each tile. Remounting on banner.key
                re-fires the slam-up animation whenever the semantic state
                changes (buzz, position, word, vote, lock, reveal). In
                edit-names mode it swaps into an inline input bound to the
                contestant's name; clicks here never bubble to the tile's
                spotlight handler. */}
            <div
              key={editNamesMode ? `edit-${c.id}` : banner.key}
              className="absolute overflow-hidden"
              style={{
                left: placard.left,
                top: placard.top,
                width: placard.width,
                height: placard.height,
                // Sits above the MVP marquee lights (zIndex:3) so the
                // nameplate tab never disappears behind the chase
                // bulbs on the winner's tile.
                zIndex: 6,
                background: editNamesMode ? c.color : banner.bg,
                color: editNamesMode ? "#000" : banner.fg,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.04em",
                borderRadius: "6px",
                boxShadow: editNamesMode
                  ? `0 0 10px ${c.color}aa, 0 2px 8px rgba(0,0,0,0.6)`
                  : `0 2px 8px rgba(0,0,0,0.6)`,
                pointerEvents: editNamesMode && onRename ? "auto" : "none",
                animation: editNamesMode
                  ? undefined
                  : "bannerSwap 0.4s cubic-bezier(0.2, 1.5, 0.4, 1)",
              }}
            >
              {editNamesMode && onRename ? (
                <PlacardNameInput
                  name={c.name}
                  onCommit={(next) => onRename(c.id, next)}
                />
              ) : (
                <FitText
                  maxPx={18}
                  minPx={7}
                  horizontalPad={0.1}
                  className="w-full h-full px-1"
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                  }}
                >
                  {banner.primary}
                </FitText>
              )}
            </div>
          </Fragment>
        );
      })}

      {/* ── Featured/center tile ───────────── */}
      {gameMode === "redlight" ? (
        <RLGLCenterTile
          contestants={contestants}
          positions={positions}
          debateActive={debateActive}
          centerSlot={SLOTS.CENTER}
        />
      ) : (
        // Main stage — transparent so the featured VDO Ninja video shows
        // through. Only the winner outline + box-shadow glow + the winner
        // name slam render on top. No idle placeholder.
        <div
          className="absolute overflow-hidden rounded-xl pointer-events-none"
          style={{
            left: SLOTS.CENTER.left,
            top: SLOTS.CENTER.top,
            width: SLOTS.CENTER.width,
            height: SLOTS.CENTER.height,
            outline: winner ? `4px solid ${winner.color}` : undefined,
            outlineOffset: "0",
            boxShadow: winner ? `0 0 50px ${winner.color}80` : undefined,
            transition: "outline-color 0.3s, box-shadow 0.3s",
          }}
        >
          {winner && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="flex flex-col items-center gap-2"
                style={{
                  animation: "slamIn 0.4s cubic-bezier(0.2, 1.4, 0.4, 1)",
                }}
              >
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "clamp(48px, 8vw, 120px)",
                    color: winner.color,
                    letterSpacing: "0.02em",
                    textShadow: `0 0 30px ${winner.color}, 4px 4px 0 #000`,
                  }}
                >
                  {winner.name}
                </div>
                <div
                  className="px-3 py-0.5"
                  style={{
                    background: winner.color,
                    color: "#000",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                  }}
                >
                  ON THE HOT SEAT
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DEBATE banner (RLGL mode) ── */}
      {gameMode === "redlight" && debateActive && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-3 py-1"
          style={{
            top: "2%",
            background: "#ffab00",
            color: "#000",
            fontFamily: "Inter, sans-serif",
            fontSize: "clamp(12px, 1.5vw, 20px)",
            letterSpacing: "0.2em",
            boxShadow: "0 0 20px #ffab00, 4px 4px 0 #000",
            animation: "pulseGlow 1.2s ease-in-out infinite",
          }}
        >
          ⚔ DEBATE IN PROGRESS ⚔
        </div>
      )}

      {/* ── INTERRUPT full-screen effect ── */}
      {activeEffect?.type === "interrupt" && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ animation: "shake 0.4s" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, #ff2e6b44 50%, transparent 100%)",
              animation: "flashOnce 0.5s ease-out",
            }}
          />
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "88px",
              color: "#fff",
              letterSpacing: "0.02em",
              textShadow: "4px 4px 0 #ff2e6b, 8px 8px 0 #000",
              animation: "slamIn 0.3s cubic-bezier(0.2, 1.5, 0.4, 1)",
              textAlign: "center",
              lineHeight: 0.95,
            }}
          >
            SHUT THE
            <br />
            !@#$ UP!!
          </div>
        </div>
      )}

      {/* ── QUICK DEBATE overlay ── */}
      {activeEffect?.type === "quickdebate" && effectBy && effectTarget && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${effectBy.color}22 0%, transparent 40%, transparent 60%, ${effectTarget.color}22 100%)`,
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-4"
            style={{ animation: "slamIn 0.4s cubic-bezier(0.2, 1.4, 0.4, 1)" }}
          >
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "28px",
                color: effectBy.color,
              }}
            >
              {effectBy.name}
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "96px",
                color: CARDS.quickdebate.color,
                textShadow: `0 0 30px ${CARDS.quickdebate.color}, 4px 4px 0 #000`,
              }}
            >
              VS
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "28px",
                color: effectTarget.color,
              }}
            >
              {effectTarget.name}
            </span>
          </div>
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-2 pointer-events-none"
            style={{
              background: CARDS.quickdebate.color,
              color: "#000",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.08em",
              fontSize: "20px",
            }}
          >
            QUICK DEBATE — 30s
          </div>
        </>
      )}

      {/* ── YES AND overlay ── */}
      {activeEffect?.type === "yesand" && effectBy && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "conic-gradient(from 0deg, #c239ff, #ff2e6b, #ffab00, #c6ff00, #00e5ff, #c239ff)",
              opacity: 0.25,
              animation: "spin 2.8s linear",
            }}
          />
          {["💬", "➕", "🎤", "💡", "✨", "🔁"].map((e, i) => (
            <div
              key={i}
              className="absolute text-5xl"
              style={{
                left: `${15 + i * 14}%`,
                top: "50%",
                animation: `floatUp 2.8s ease-out ${i * 0.08}s`,
              }}
            >
              {e}
            </div>
          ))}
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "110px",
              color: "#fff",
              textShadow: `0 0 40px ${CARDS.yesand.color}, 6px 6px 0 ${CARDS.yesand.color}`,
              animation: "slamIn 0.4s cubic-bezier(0.2, 1.5, 0.4, 1)",
              letterSpacing: "0.04em",
            }}
          >
            YES, AND…
          </div>
        </div>
      )}

      {/* Round-intro overlay — re-mounts on every (re)trigger (keyed by
          the server-assigned timestamp) so the animation restarts cleanly.
          Rendered above tiles + stage so the flourish reads through, but
          below the REC badge + topic bar so it doesn't cover the show
          chrome permanently. */}
      {roundIntro && introActive && (
        <div
          key={introKey}
          className="absolute inset-0 pointer-events-none"
          // zIndex:7 so the intro animation renders above the name
          // placards (which sit at zIndex:6 so they clear the MVP
          // marquee lights). The whole flourish is pointer-events-none
          // so the placards underneath still remain clickable in edit-
          // names mode once the intro fades out.
          style={{ zIndex: 7 }}
        >
          <RoundIntro mode={roundIntro.mode} t={roundIntro.t} />
        </div>
      )}

      {/* MVP winner celebration — full-screen flourish that plays once
          every contestant has locked AND revealed their MVP pick. Stays
          visible for MVP_CELEBRATION_MS then fades out; the marquee
          lights around the winner's tile persist for the rest of the
          round so the crown stays on stage.

          Tie handling: every tied contestant is rendered, stacked
          vertically. The gold title stays the same; each winner shows
          their own name in their own color with their vote count beside
          it. Slot-ordered so the layout is stable across clients. */}
      {celebrationActive && mvpWinners.length > 0 && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{
            zIndex: 6,
            animation: `mvpCelebrationBackdrop ${MVP_CELEBRATION_MS}ms ease-in-out forwards`,
          }}
        >
          {/* Gold radial vignette darkens the stage behind the winner. */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${MVP_GOLD}33 0%, #000000cc 55%, #000000f0 100%)`,
            }}
          />
          {/* Scan-line wash tinted gold for broadcast flavor. */}
          <div
            className="absolute inset-0"
            style={{
              background: `repeating-linear-gradient(0deg, ${MVP_GOLD}14 0 2px, transparent 2px 6px)`,
              mixBlendMode: "screen",
            }}
          />
          {/* Star shower rising up the stage. Offset columns give the
              shower body without needing a real particle system; each
              star has a staggered start so the field reads as random. */}
          {Array.from({ length: 14 }).map((_, i) => {
            const leftPct = 4 + ((i * 163) % 92);
            const delay = (i * 0.18) % 2.2;
            const duration = 2.6 + ((i * 7) % 11) * 0.1;
            return (
              <span
                key={i}
                className="absolute"
                style={{
                  left: `${leftPct}%`,
                  bottom: "-4%",
                  fontSize: "clamp(18px, 2.4vw, 36px)",
                  filter: `drop-shadow(0 0 8px ${MVP_GOLD})`,
                  animation: `floatUp ${duration}s ease-out ${delay}s infinite`,
                }}
              >
                ⭐
              </span>
            );
          })}

          {/* Title + winner stack. The wrapper pops in with
              mvpWinnerPop; the stack holds while the backdrop fades
              out at the end of the window. */}
          <div
            className="relative flex flex-col items-center gap-3 text-center"
            style={{
              animation: "mvpWinnerPop 0.9s cubic-bezier(0.2, 1.6, 0.4, 1) forwards",
            }}
          >
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "clamp(18px, 2.6vw, 40px)",
                color: MVP_GOLD,
                letterSpacing: "0.28em",
                textShadow: `0 0 18px ${MVP_GOLD}, 3px 3px 0 #000`,
              }}
            >
              MVP OF THE SHOW
            </div>
            <div className="flex flex-col gap-2 items-center">
              {mvpWinners.map((w) => {
                const count = mvpTally?.[w.id] ?? 0;
                return (
                  <div
                    key={w.id}
                    className="flex items-baseline gap-4 justify-center"
                  >
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "clamp(48px, 9vw, 140px)",
                        color: w.color,
                        letterSpacing: "0.02em",
                        lineHeight: 0.95,
                        textShadow: `0 0 34px ${w.color}, 5px 5px 0 #000`,
                      }}
                    >
                      {w.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "clamp(16px, 2.2vw, 36px)",
                        color: MVP_GOLD,
                        letterSpacing: "0.14em",
                        textShadow: `0 0 12px ${MVP_GOLD}`,
                      }}
                    >
                      {count} {count === 1 ? "VOTE" : "VOTES"}
                    </span>
                  </div>
                );
              })}
            </div>
            {mvpWinners.length > 1 && (
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "clamp(11px, 1.5vw, 18px)",
                  color: "#f0f0f0",
                  letterSpacing: "0.22em",
                  opacity: 0.8,
                }}
              >
                TIE — CO-MVPs
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topic bar — sits in the wooden ceiling band directly above the
          main stage, where the TOPIC_BAR rect lines up with the backdrop
          graphics. When the layout editor is open and no round is live,
          we render a placeholder so the producer can see the rect they
          are moving around. */}
      {(activeRound || showTopicPlaceholder) && (() => {
        const color = activeRound
          ? MODES[activeRound.mode].color
          : "#ff2e6b";
        const label = activeRound
          ? MODES[activeRound.mode].name.toUpperCase()
          : "TOPIC";
        const topic = activeRound
          ? activeRound.topic || "—"
          : "— layout preview — topic appears here when a round is live —";
        return (
          <div
            className="absolute flex items-stretch shadow-lg overflow-hidden rounded-md"
            style={{
              left: TOPIC_BAR.left,
              top: TOPIC_BAR.top,
              width: TOPIC_BAR.width,
              height: TOPIC_BAR.height,
              background: "#000000dd",
              border: `1px solid ${color}`,
              boxShadow: `0 0 20px ${color}66`,
              opacity: activeRound ? 1 : 0.7,
            }}
          >
            <div
              className="px-3 flex-shrink-0 min-w-0"
              style={{
                background: color,
                color: "#000",
                minWidth: "22%",
                maxWidth: "40%",
              }}
            >
              <FitText
                maxPx={14}
                minPx={5}
                horizontalPad={0.02}
                className="w-full h-full"
                style={{
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                {label}
              </FitText>
            </div>
            <div
              className="flex-1 px-3 min-w-0"
              style={{
                color: "#f0f0f0",
              }}
            >
              <FitText
                maxPx={20}
                minPx={4}
                horizontalPad={0}
                className="w-full h-full"
                style={{
                  letterSpacing: "0",
                  fontWeight: 700,
                }}
              >
                {topic}
              </FitText>
            </div>
          </div>
        );
      })()}

      {/* Bottom-center countdown clock — overlays the backdrop's baked-in
          circle. Silent until a contestant is spotlit; then counts down
          from the producer-configured duration, runs into the negative
          with a red pulse when time's up. */}
      <CountdownTimer />
    </div>
  );
}

// Inline name-edit input rendered inside a contestant's name placard.
// Kept local so it can read the parent's edit flag + border color directly
// and because it's only ever used by OverlayPreview.
interface PlacardNameInputProps {
  name: string;
  onCommit: (next: string) => void;
}

function PlacardNameInput({ name, onCommit }: PlacardNameInputProps) {
  // Local draft so typing is instant. `name` is the authoritative server
  // value — sync to it whenever it changes underneath us (e.g. another
  // client renames). On commit we only emit if the value actually
  // differs so backspace-enter doesn't round-trip.
  const [draft, setDraft] = useState(name);
  useEffect(() => {
    setDraft(name);
  }, [name]);

  const commit = () => {
    const v = draft.trim();
    if (!v) {
      setDraft(name);
      return;
    }
    if (v.toUpperCase() !== name) onCommit(v);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(name);
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      maxLength={16}
      placeholder="NAME"
      className="w-full h-full text-center bg-transparent outline-none uppercase"
      style={{
        fontFamily: "Inter, sans-serif",
        color: "#000",
        letterSpacing: "0.08em",
        fontWeight: 700,
        fontSize: "clamp(9px, 1.1cqw, 18px)",
        containerType: "inline-size",
        border: "none",
      }}
    />
  );
}
