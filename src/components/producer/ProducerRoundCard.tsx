import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Minus,
  Play,
  Plus,
  Square,
  Trash2,
  Trophy,
  Undo2,
} from "lucide-react";
import {
  BIGGER_DEAL_COLORS,
  DEFAULT_BIGGER_DEAL_CHOICES,
  DEFAULT_PLAY_CHOICES,
  MODES,
  PLAY_MAX_CHOICES,
  PLAY_MIN_CHOICES,
  type ModeKey,
} from "../../modes";
import type { Round } from "../../state/types";
import { useGameStore } from "../../state/store";

interface Props {
  round: Round;
  index: number;
  total: number;
  isLive: boolean;
  // True when this card is the next pending round — used to highlight
  // the trigger button so the host knows which round fires next.
  isNextPending: boolean;
  // True when any round is currently live (not just this one). Trigger
  // on another pending round is still allowed — the server auto-closes
  // the live round when a new one fires — but we tweak the title/tone
  // so the producer knows what's about to happen.
  anyLive: boolean;
  // When false, all editing affordances (mode dropdown, topic input,
  // biggerdeal choices, move/delete buttons) are locked. Only the
  // trigger/reopen/close buttons remain active. Toggled by the
  // producer via the "edit show" button on the Show Control header.
  canEdit: boolean;
}

export function ProducerRoundCard({
  round: r,
  index,
  total,
  isLive,
  isNextPending,
  anyLive,
  canEdit,
}: Props) {
  const roundUpdate = useGameStore((s) => s.roundUpdate);
  const roundDelete = useGameStore((s) => s.roundDelete);
  const roundMove = useGameStore((s) => s.roundMove);
  const roundTrigger = useGameStore((s) => s.roundTrigger);
  const roundClose = useGameStore((s) => s.roundClose);
  // MVP-only: manual winner reveal. Button only renders for the live
  // MVP round and arms once every contestant has LOCKED a pick. Picks
  // auto-reveal on lock, so once mvpAllVoted is true the tally is
  // already fully on-stage — firing the action just plays the
  // full-screen celebration + marquee lights.
  const contestants = useGameStore((s) => s.contestants);
  const votes = useGameStore((s) => s.votes);
  const mvpWinnerRevealed = useGameStore((s) => s.mvpWinnerRevealed);
  const mvpWinnerReveal = useGameStore((s) => s.mvpWinnerReveal);
  const mvpWinnerHide = useGameStore((s) => s.mvpWinnerHide);

  const modeColor = MODES[r.mode].color;

  const isLiveMvp = isLive && r.mode === "mvp";
  const mvpAllVoted =
    isLiveMvp &&
    contestants.length > 0 &&
    contestants.every((c) => votes[c.id]?.kind === "mvp-pick");

  return (
    <div
      className="p-2 flex flex-col gap-1.5"
      style={{
        background: "#111",
        border: isLive ? `2px solid ${modeColor}` : "1px solid #222",
        boxShadow: isLive ? `0 0 14px ${modeColor}55` : "none",
      }}
    >
      {/* Top row: reorder + mode + status + trigger/close + delete, all
          on a single horizontal strip so each card only needs two rows. */}
      <div className="flex items-center gap-1.5">
        <GripVertical className="w-3 h-3 opacity-30 flex-shrink-0" />
        <span
          className="text-xs w-5 flex-shrink-0"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#f0f0f0",
            letterSpacing: "0.04em",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        {canEdit && (
          <div className="flex flex-shrink-0">
            <button
              onClick={() => roundMove(r.id, -1)}
              disabled={index === 0}
              className="w-5 h-5 flex items-center justify-center disabled:opacity-20 hover:bg-white/10"
              title="Move up"
            >
              <ChevronRight className="w-3 h-3 -rotate-90" />
            </button>
            <button
              onClick={() => roundMove(r.id, 1)}
              disabled={index === total - 1}
              className="w-5 h-5 flex items-center justify-center disabled:opacity-20 hover:bg-white/10"
              title="Move down"
            >
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>
        )}

        <div
          className="relative flex-shrink-0"
          title={MODES[r.mode].description}
        >
          <select
            value={r.mode}
            onChange={(e) =>
              roundUpdate(r.id, { mode: e.target.value as ModeKey })
            }
            disabled={!canEdit}
            className="appearance-none pl-1.5 pr-5 py-1 text-[10px] uppercase outline-none cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: modeColor,
              color: "#000",
              border: `1px solid ${modeColor}`,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.08em",
              minWidth: "160px",
              opacity: canEdit ? 1 : 0.92,
            }}
          >
            {(
              Object.entries(MODES) as Array<
                [ModeKey, (typeof MODES)[ModeKey]]
              >
            ).map(([key, m]) => (
              <option
                key={key}
                value={key}
                style={{ color: "#f0f0f0", background: "#111" }}
              >
                {m.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={3}
            style={{ color: "#000" }}
          />
        </div>

        {!isLive && r.phase === "closed" && (
          <span
            className="text-[9px] px-1.5 py-0.5 flex-shrink-0"
            style={{
              background: "#0a0a0a",
              color: "#666",
              border: "1px solid #333",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.15em",
            }}
          >
            DONE
          </span>
        )}

        <div className="flex-1" />

        {/* MVP-only winner reveal. Sits to the left of close so it reads
            as a round-level control, not an admin toggle. Disabled until
            every contestant has locked AND revealed their pick — we don't
            want to fire a flourish on a partial tally. Flips to "hide
            winner" once fired so the host can re-show it. */}
        {isLiveMvp &&
          (mvpWinnerRevealed ? (
            <button
              onClick={mvpWinnerHide}
              className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition flex-shrink-0"
              style={{
                background: "#0a0a0a",
                color: MODES.mvp.color,
                border: `1.5px solid ${MODES.mvp.color}`,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.08em",
              }}
              title="Pull the MVP celebration back off-stage so you can re-fire it"
            >
              <Undo2 className="w-2.5 h-2.5" strokeWidth={2.5} />
              hide winner
            </button>
          ) : (
            <button
              onClick={mvpWinnerReveal}
              disabled={!mvpAllVoted}
              className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              style={{
                background: mvpAllVoted ? MODES.mvp.color : "#0a0a0a",
                color: mvpAllVoted ? "#000" : "#666",
                border: `1.5px solid ${mvpAllVoted ? MODES.mvp.color : "#333"}`,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.08em",
              }}
              title={
                mvpAllVoted
                  ? "Fire the full-screen MVP celebration + marquee lights"
                  : "Waiting for every contestant to lock in their MVP pick"
              }
            >
              <Trophy
                className="w-2.5 h-2.5"
                strokeWidth={2.5}
                fill={mvpAllVoted ? "#000" : "none"}
              />
              reveal winner
            </button>
          ))}

        {/* CLOSED rounds get a "reopen" button that re-triggers the round
            WITH its intro animation — producers were hitting "reopen" then
            almost always hitting a second button to replay the intro, so
            we collapsed the two into one. (The old separate "retrigger"
            button is gone; reopen is the only way back in, and it plays
            the intro every time.) Auto-closes anything currently live. */}
        {!isLive && r.phase === "closed" && (
          <button
            onClick={() => roundTrigger(r.id)}
            className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition flex-shrink-0"
            style={{
              background: "#0a0a0a",
              color: modeColor,
              border: `1.5px solid ${modeColor}`,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.08em",
            }}
            title={
              anyLive
                ? "Reopen this round and replay its intro animation (will close the current live round)"
                : "Reopen this closed round and replay its intro animation"
            }
          >
            <Play className="w-2.5 h-2.5" strokeWidth={2.5} />
            reopen
          </button>
        )}
        {isLive && (
          <button
            onClick={roundClose}
            className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition flex-shrink-0"
            style={{
              background: "#0a0a0a",
              color: "#ff2e6b",
              border: "1.5px solid #ff2e6b",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.08em",
            }}
            title="Close the live round"
          >
            <Square className="w-2.5 h-2.5" strokeWidth={2.5} fill="#ff2e6b" />
            close
          </button>
        )}
        {/* Pending round: trigger takes it live. The server auto-closes
            any other live round, so the producer can hop straight from
            one segment to the next without pressing "close" first. */}
        {!isLive && r.phase === "pending" && (
          <button
            onClick={() => roundTrigger(r.id)}
            className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition flex-shrink-0"
            style={{
              background: isNextPending && !anyLive ? modeColor : "#0a0a0a",
              color: isNextPending && !anyLive ? "#000" : modeColor,
              border: `1.5px solid ${modeColor}`,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.08em",
            }}
            title={
              anyLive
                ? "Trigger this round (will close the current live round)"
                : isNextPending
                  ? "Trigger next round"
                  : "Trigger this round"
            }
          >
            <Play
              className="w-2.5 h-2.5"
              strokeWidth={2.5}
              fill={isNextPending && !anyLive ? "#000" : "none"}
            />
            trigger
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => roundDelete(r.id)}
            disabled={isLive}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
            title={isLive ? "Can't delete a live round" : "Delete round"}
          >
            <Trash2 className="w-3 h-3" style={{ color: "#ff2e6b" }} />
          </button>
        )}
      </div>

      {/* Topic — single-line input keeps the card short; long text still
          scrolls horizontally and the overlay FitText handles display. */}
      {canEdit ? (
        <input
          value={r.topic}
          onChange={(e) => roundUpdate(r.id, { topic: e.target.value })}
          placeholder="Topic or question that contestants will see…"
          className="w-full px-2 py-1 outline-none"
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: "#f0f0f0",
          }}
        />
      ) : (
        <div
          className="w-full px-2 py-1 truncate"
          style={{
            background: "#0a0a0a",
            border: "1px solid #1a1a1a",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: r.topic ? "#f0f0f0" : "#555",
          }}
          title={r.topic || "(no topic)"}
        >
          {r.topic || "—"}
        </div>
      )}

      {(r.mode === "biggerdeal" || r.mode === "whoyagot") &&
        (() => {
          // Inputs only show for the two-choice vote modes (biggerdeal
          // and its WHO YA GOT alias — both share the same "bigger-deal"
          // vote kind). The two colours match what the contestant phone +
          // overlay render, so the producer gets a visual hint of which
          // side is which.
          const a = r.choices?.[0] ?? DEFAULT_BIGGER_DEAL_CHOICES[0];
          const b = r.choices?.[1] ?? DEFAULT_BIGGER_DEAL_CHOICES[1];
          const [colorA, colorB] = BIGGER_DEAL_COLORS;
          const setChoice = (idx: 0 | 1, val: string) => {
            const next: [string, string] = [
              idx === 0 ? val : a,
              idx === 1 ? val : b,
            ];
            roundUpdate(r.id, { choices: next });
          };
          return (
            <div className="flex gap-1.5">
              {[
                { idx: 0 as const, val: a, color: colorA },
                { idx: 1 as const, val: b, color: colorB },
              ].map(({ idx, val, color }) => (
                <div key={idx} className="flex-1 flex items-stretch">
                  <span
                    className="px-1.5 flex items-center text-[9px]"
                    style={{
                      background: color,
                      color: "#000",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "0.2em",
                    }}
                  >
                    {idx === 0 ? "A" : "B"}
                  </span>
                  {canEdit ? (
                    <input
                      value={val}
                      onChange={(e) => setChoice(idx, e.target.value)}
                      placeholder={
                        idx === 0
                          ? DEFAULT_BIGGER_DEAL_CHOICES[0]
                          : DEFAULT_BIGGER_DEAL_CHOICES[1]
                      }
                      className="flex-1 min-w-0 px-2 py-1 outline-none"
                      style={{
                        background: "#0a0a0a",
                        border: `1px solid ${color}`,
                        borderLeft: "none",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "12px",
                        color: "#f0f0f0",
                        letterSpacing: "0.04em",
                      }}
                    />
                  ) : (
                    <div
                      className="flex-1 min-w-0 px-2 py-1 truncate"
                      style={{
                        background: "#0a0a0a",
                        border: `1px solid ${color}`,
                        borderLeft: "none",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "12px",
                        color: val ? "#f0f0f0" : "#555",
                        letterSpacing: "0.04em",
                      }}
                      title={val}
                    >
                      {val || "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

      {r.mode === "whatstheplay" &&
        (() => {
          // WHAT'S THE PLAY editor — a variable-length list of text
          // inputs the producer can add to / remove from. The shown
          // presets map to contestant-side buttons; the phone also
          // always offers a freeform "your own" slot so there's no UI
          // for that here. Clamped to [PLAY_MIN_CHOICES,
          // PLAY_MAX_CHOICES] so the phone stays legible.
          const color = MODES.whatstheplay.color;
          const choices =
            r.choices && r.choices.length > 0
              ? r.choices
              : [...DEFAULT_PLAY_CHOICES];
          const setChoice = (idx: number, val: string) => {
            const next = [...choices];
            next[idx] = val;
            roundUpdate(r.id, { choices: next });
          };
          const addChoice = () => {
            if (choices.length >= PLAY_MAX_CHOICES) return;
            roundUpdate(r.id, { choices: [...choices, ""] });
          };
          const removeChoice = (idx: number) => {
            if (choices.length <= PLAY_MIN_CHOICES) return;
            const next = choices.filter((_, i) => i !== idx);
            roundUpdate(r.id, { choices: next });
          };
          return (
            <div className="flex flex-col gap-1">
              {choices.map((val, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const canRemove =
                  canEdit && choices.length > PLAY_MIN_CHOICES;
                return (
                  <div key={idx} className="flex items-stretch gap-1">
                    <span
                      className="px-1.5 flex items-center text-[9px]"
                      style={{
                        background: color,
                        color: "#000",
                        fontFamily: "Inter, sans-serif",
                        letterSpacing: "0.2em",
                        minWidth: "22px",
                        justifyContent: "center",
                      }}
                    >
                      {letter}
                    </span>
                    {canEdit ? (
                      <input
                        value={val}
                        onChange={(e) => setChoice(idx, e.target.value)}
                        placeholder={`OPTION ${letter}`}
                        className="flex-1 min-w-0 px-2 py-1 outline-none"
                        style={{
                          background: "#0a0a0a",
                          border: `1px solid ${color}`,
                          borderLeft: "none",
                          fontFamily: "Inter, sans-serif",
                          fontSize: "12px",
                          color: "#f0f0f0",
                          letterSpacing: "0.04em",
                        }}
                      />
                    ) : (
                      <div
                        className="flex-1 min-w-0 px-2 py-1 truncate"
                        style={{
                          background: "#0a0a0a",
                          border: `1px solid ${color}`,
                          borderLeft: "none",
                          fontFamily: "Inter, sans-serif",
                          fontSize: "12px",
                          color: val ? "#f0f0f0" : "#555",
                          letterSpacing: "0.04em",
                        }}
                        title={val}
                      >
                        {val || "—"}
                      </div>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => removeChoice(idx)}
                        className="w-6 flex items-center justify-center hover:bg-white/5 transition"
                        style={{
                          background: "#0a0a0a",
                          border: `1px solid ${color}55`,
                          color,
                        }}
                        title="Remove this choice"
                      >
                        <Minus className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}
              {canEdit && choices.length < PLAY_MAX_CHOICES && (
                <button
                  onClick={addChoice}
                  className="w-full py-1 flex items-center justify-center gap-1 text-[10px] uppercase hover:bg-white/5 transition"
                  style={{
                    background: "#0a0a0a",
                    border: `1px dashed ${color}80`,
                    color,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.15em",
                  }}
                  title={`Add another choice (max ${PLAY_MAX_CHOICES})`}
                >
                  <Plus className="w-3 h-3" strokeWidth={2.5} />
                  add choice
                </button>
              )}
            </div>
          );
        })()}
    </div>
  );
}
