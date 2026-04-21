import { Check, Eye, EyeOff, Trophy, Undo2 } from "lucide-react";
import type { Mode } from "../../modes";
import { BIGGER_DEAL_COLORS, MODES, decodePlayVote } from "../../modes";
import { selectActiveRound, useGameStore } from "../../state/store";

interface Props {
  mode: Mode;
}

export function SubmissionsPanel({ mode }: Props) {
  const contestants = useGameStore((s) => s.contestants);
  const votes = useGameStore((s) => s.votes);
  const revealed = useGameStore((s) => s.revealed);
  const revealAnswer = useGameStore((s) => s.revealAnswer);
  const hostHideAnswer = useGameStore((s) => s.hostHideAnswer);
  const activeRound = useGameStore(selectActiveRound);
  // MVP-only: controls the "reveal winner" button at the top of the
  // panel. We only show it during MVP rounds and gate "reveal" on every
  // contestant having locked a pick (picks auto-reveal on submit, so
  // the tally is live the moment the last vote lands).
  const mvpWinnerRevealed = useGameStore((s) => s.mvpWinnerRevealed);
  const mvpWinnerReveal = useGameStore((s) => s.mvpWinnerReveal);
  const mvpWinnerHide = useGameStore((s) => s.mvpWinnerHide);

  const submitted = contestants.filter((c) => votes[c.id]);
  const pending = contestants.filter((c) => !votes[c.id]);

  // In MVP mode, winner-reveal is armed once every player has a locked
  // pick. Picks auto-reveal on lock so there's no "face-down" state to
  // track here anymore.
  const isMvp = activeRound?.mode === "mvp";
  const mvpAllVoted =
    isMvp &&
    contestants.length > 0 &&
    contestants.every((c) => votes[c.id]?.kind === "mvp-pick");

  const tallies: Record<string, number> = {};
  if (mode.primary === "vote-anim" && mode.options) {
    for (const o of mode.options) tallies[o.key] = 0;
    for (const c of submitted) {
      const v = votes[c.id];
      if (v?.kind === "vote-anim") tallies[v.value] = (tallies[v.value] ?? 0) + 1;
    }
  }

  const ModeIcon = mode.icon;

  return (
    <div
      className="p-3 space-y-2"
      style={{
        background: "#0a0a0a",
        border: `1px solid ${mode.color}44`,
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          className="text-[10px] tracking-widest flex items-center gap-1.5"
          style={{ fontFamily: "Inter, sans-serif", color: mode.color }}
        >
          <ModeIcon className="w-3 h-3" strokeWidth={2.5} />
          live submissions · {submitted.length}/{contestants.length}
        </div>
        {isMvp &&
          (mvpWinnerRevealed ? (
            <button
              onClick={mvpWinnerHide}
              className="px-2.5 py-1 text-[10px] uppercase hover:opacity-80 transition flex items-center gap-1.5"
              style={{
                background: "#0a0a0a",
                color: MODES.mvp.color,
                border: `1px solid ${MODES.mvp.color}`,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.12em",
              }}
              title="Pull the MVP celebration back off-stage so you can re-fire it"
            >
              <Undo2 className="w-3 h-3" strokeWidth={2.5} />
              hide winner
            </button>
          ) : (
            <button
              onClick={mvpWinnerReveal}
              disabled={!mvpAllVoted}
              className="px-2.5 py-1 text-[10px] uppercase hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
              style={{
                background: mvpAllVoted ? MODES.mvp.color : "#0a0a0a",
                color: mvpAllVoted ? "#000" : "#666",
                border: `1px solid ${mvpAllVoted ? MODES.mvp.color : "#333"}`,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.12em",
              }}
              title={
                mvpAllVoted
                  ? "Fire the full-screen MVP celebration + marquee lights"
                  : "Waiting for every contestant to lock in their MVP pick"
              }
            >
              <Trophy className="w-3 h-3" strokeWidth={2.5} />
              reveal winner
            </button>
          ))}
        {mode.primary === "vote-anim" && mode.options && (
          <div className="flex items-center gap-2">
            {mode.options.map((o) => (
              <div key={o.key} className="flex items-center gap-1">
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "16px",
                    color: o.color,
                  }}
                >
                  {tallies[o.key]}
                </span>
                <span
                  className="text-[9px]"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: o.color,
                    letterSpacing: "0.15em",
                  }}
                >
                  {o.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {submitted.map((c) => {
          const v = votes[c.id];
          if (!v) return null;
          const isHidden = v.kind === "hidden-answer";
          const isMvp = v.kind === "mvp-pick";
          // Only sentence (hidden-answer) uses host-driven reveal/hide.
          // MVP picks auto-reveal on submit so those rows don't need
          // reveal/hide buttons — the call is already on stage.
          const isHideable = isHidden;
          const isRevealed = !!revealed[c.id];
          const opt =
            v.kind === "vote-anim" && mode.options
              ? mode.options.find((o) => o.key === v.value)
              : null;
          const mvpTarget = isMvp
            ? (contestants.find((x) => x.id === v.value) ?? null)
            : null;

          return (
            <div
              key={c.id}
              className="flex items-center gap-2 px-2 py-1.5"
              style={{
                background: "#111",
                borderLeft: `3px solid ${c.color}`,
              }}
            >
              <span
                className="text-[11px] w-16 truncate flex-shrink-0"
                style={{
                  fontFamily: "Inter, sans-serif",
                  color: c.color,
                  letterSpacing: "0.04em",
                }}
              >
                {c.name}
              </span>

              {v.kind === "typed-buzz" && (
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    color: "#f0f0f0",
                  }}
                >
                  "{v.value}"
                </span>
              )}
              {v.kind === "vote-anim" && opt && (
                <span
                  className="flex-1 flex items-center gap-1.5"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                    color: opt.color,
                    letterSpacing: "0.08em",
                  }}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </span>
              )}
              {v.kind === "bigger-deal" && (() => {
                const idx = Number(v.value);
                const label =
                  activeRound?.choices?.[idx] ??
                  (idx === 0 ? "OPTION A" : "OPTION B");
                const color = BIGGER_DEAL_COLORS[idx === 1 ? 1 : 0];
                return (
                  <span
                    className="flex-1 flex items-center"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    <span
                      className="px-1.5 py-0.5 truncate"
                      style={{
                        background: color,
                        color: "#000",
                        fontSize: "12px",
                        letterSpacing: "0.04em",
                        maxWidth: "100%",
                      }}
                    >
                      {label}
                    </span>
                  </span>
                );
              })()}
              {v.kind === "play-pick" && (() => {
                const sel = decodePlayVote(v.value);
                const color = MODES.whatstheplay.color;
                const isCustom = sel.kind === "custom";
                const label = isCustom
                  ? sel.text
                  : (activeRound?.choices?.[sel.index] ??
                    `OPTION ${String.fromCharCode(65 + sel.index)}`);
                return (
                  <span
                    className="flex-1 flex items-center gap-1.5 min-w-0"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {isCustom && (
                      <span
                        className="text-[9px] px-1 py-0.5"
                        style={{
                          background: color,
                          color: "#000",
                          letterSpacing: "0.15em",
                        }}
                      >
                        MY CALL
                      </span>
                    )}
                    <span
                      className="px-1.5 py-0.5 truncate min-w-0"
                      style={{
                        background: isCustom ? "#0a0a0a" : color,
                        color: isCustom ? color : "#000",
                        border: isCustom ? `1px solid ${color}` : "none",
                        fontSize: "12px",
                        letterSpacing: "0.04em",
                        maxWidth: "100%",
                      }}
                      title={label}
                    >
                      {label}
                    </span>
                  </span>
                );
              })()}
              {v.kind === "sentiment-score" && (() => {
                const n = Number(v.value);
                const pct = (n - 1) / 9;
                const hue = pct * 120;
                return (
                  <span
                    className="flex-1 flex items-center gap-2"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    <span
                      className="px-1.5 py-0.5"
                      style={{
                        background: `hsl(${hue}, 85%, 48%)`,
                        color: "#000",
                        fontSize: "13px",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {n}/10
                    </span>
                  </span>
                );
              })()}
              {isHidden && (
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: isRevealed
                      ? "Inter, sans-serif"
                      : "Inter, sans-serif",
                    fontSize: isRevealed ? "13px" : "11px",
                    color: isRevealed ? "#f0f0f0" : "#666",
                    letterSpacing: isRevealed ? "0.02em" : "0.1em",
                  }}
                >
                  {isRevealed ? v.value : "• • • LOCKED • • •"}
                </span>
              )}
              {isMvp && (
                <span
                  className="flex-1 flex items-center gap-1.5 truncate"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: isRevealed ? "13px" : "11px",
                    color: isRevealed
                      ? (mvpTarget?.color ?? "#f0f0f0")
                      : "#666",
                    letterSpacing: isRevealed ? "0.04em" : "0.1em",
                  }}
                >
                  {isRevealed ? (
                    <>
                      <span className="opacity-60">MVP →</span>
                      <span
                        className="truncate"
                        style={{ color: mvpTarget?.color ?? "#f0f0f0" }}
                      >
                        {mvpTarget?.name ?? "?"}
                      </span>
                    </>
                  ) : (
                    "• • • MVP LOCKED • • •"
                  )}
                </span>
              )}

              {isHideable &&
                (isRevealed ? (
                  <button
                    onClick={() => hostHideAnswer(c.id)}
                    className="px-2 py-0.5 text-[9px] uppercase hover:opacity-80 transition flex items-center gap-1"
                    style={{
                      background: "#0a0a0a",
                      color: "#888",
                      border: "1px solid #333",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "0.12em",
                    }}
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                    hide
                  </button>
                ) : (
                  <button
                    onClick={() => revealAnswer(c.id)}
                    className="px-2 py-0.5 text-[9px] uppercase hover:opacity-80 transition flex items-center gap-1"
                    style={{
                      background: MODES.sentence.color,
                      color: "#000",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "0.12em",
                    }}
                  >
                    <Eye className="w-2.5 h-2.5" strokeWidth={2.5} />
                    reveal
                  </button>
                ))}

              {!isHideable && (
                <Check
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: c.color }}
                  strokeWidth={3}
                />
              )}
            </div>
          );
        })}

        {pending.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-1">
            <span
              className="text-[9px] opacity-50 mr-1"
              style={{
                fontFamily: "Inter, sans-serif",
                color: "#fff",
                letterSpacing: "0.15em",
              }}
            >
              WAITING
            </span>
            {pending.map((c) => (
              <span
                key={c.id}
                className="px-1.5 py-0.5 text-[9px]"
                style={{
                  background: "#0a0a0a",
                  border: `1px dashed ${c.color}55`,
                  color: c.color,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.06em",
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
