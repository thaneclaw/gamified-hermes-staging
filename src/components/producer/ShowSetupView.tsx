import { useState } from "react";
import {
  Film,
  ListOrdered,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Sliders,
  Trash2,
} from "lucide-react";
import { CARDS, type CardKey } from "../../cards";
import { useGameStore } from "../../state/store";
import { ChatPanel } from "../shared/ChatPanel";
import { SectionLabel } from "../shared/SectionLabel";
import { HostPanel } from "../host/HostPanel";
import { LayoutEditor } from "../overlay/LayoutEditor";
import { OverlayPreview } from "../overlay/OverlayPreview";
import { TimerControls } from "../overlay/TimerControls";
import { ProducerRoundCard } from "./ProducerRoundCard";

interface Props {
  // The page-level role is purely cosmetic: chat events go into the
  // producer or host backstage feed depending on who's driving. The
  // rundown, overlay, timer, and spotlight live on the server and are
  // shared identically across both seats.
  role: "host" | "producer";
}

export function ShowSetupView({ role }: Props) {
  const rounds = useGameStore((s) => s.rounds);
  const activeRoundId = useGameStore((s) => s.activeRoundId);

  const roundAdd = useGameStore((s) => s.roundAdd);
  const rundownClear = useGameStore((s) => s.rundownClear);
  const showRestart = useGameStore((s) => s.showRestart);
  const contestantRename = useGameStore((s) => s.contestantRename);
  // Card allotment — the producer can tune how many of each card every
  // contestant starts with. Updates propagate live (each contestant's
  // `max` is updated in place) so you can raise/lower during a show
  // without restarting.
  const cardMaxes = useGameStore((s) => s.cardMaxes);
  const cardMaxSet = useGameStore((s) => s.cardMaxSet);
  // Spotlight lives on the server so host + producer + overlay all
  // agree on which contestant is "hot". One contestant at a time;
  // calling spotlightSet with the same id again clears it, calling
  // with a different id switches (and resets the countdown clock).
  const spotlightId = useGameStore((s) => s.spotlight.id);
  const spotlightSet = useGameStore((s) => s.spotlightSet);

  // Local toggle for the overlay layout editor. Off by default so the
  // setup page isn't loud.
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  // Name-edit mode turns every name placard INSIDE the overlay preview
  // into an inline input. Click any name to rename that contestant.
  // Tile clicks no longer toggle spotlight while this is on — prevents
  // accidental swaps during a rename. Off by default so a stray tap
  // during a live show can't rename a player.
  const [editNames, setEditNames] = useState(false);
  // Rundown-edit mode gates every structural control in Show Control
  // (mode dropdowns, topic inputs, reorder, delete, add, clear). When
  // off, the rundown is locked and only trigger/reopen/close buttons
  // remain active — protects the live show from an accidental edit.
  const [editRundown, setEditRundown] = useState(false);

  const nextPendingId = rounds.find((r) => r.phase === "pending")?.id ?? null;

  const chatLabel =
    role === "host" ? "BACKSTAGE CHAT · HOST" : "BACKSTAGE CHAT · PRODUCER";
  const chatSub = role === "host" ? "as host" : "as producer";

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-4 space-y-6">
      {/* LIVE PREVIEW — what OBS will render. Pinned to the top of the
          viewport so the producer can watch the overlay react as they
          edit the rundown, roster, and layout scrolling underneath. */}
      <section
        className="sticky top-0 z-20 py-3"
        style={{ background: "#0a0a0a" }}
      >
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <SectionLabel
            icon={Film}
            label="OBS OVERLAY PREVIEW"
            sub={
              editNames
                ? "click a name placard to rename"
                : "browser source — 1920×1080"
            }
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEditNames((v) => !v)}
              // min-width pins the slot so the adjacent "edit layout"
              // button stays put when the label flips between "edit
              // names" and the shorter "done".
              className="px-2 py-1 flex items-center justify-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
              style={{
                fontFamily: "Inter, sans-serif",
                border: `1px solid ${editNames ? "#c6ff00" : "#333"}`,
                color: editNames ? "#c6ff00" : "#f0f0f0",
                letterSpacing: "0.15em",
                background: editNames ? "#c6ff0014" : "transparent",
                minWidth: "112px",
              }}
              aria-pressed={editNames}
              title={
                editNames
                  ? "Exit name-edit mode"
                  : "Click a name placard in the preview to rename the contestant"
              }
            >
              <Pencil className="w-3 h-3" strokeWidth={2.5} />
              {editNames ? "done" : "edit names"}
            </button>
            <button
              onClick={() => setShowLayoutEditor((v) => !v)}
              className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
              style={{
                fontFamily: "Inter, sans-serif",
                border: `1px solid ${showLayoutEditor ? "#ff2e6b" : "#333"}`,
                color: showLayoutEditor ? "#ff2e6b" : "#f0f0f0",
                letterSpacing: "0.15em",
              }}
              aria-pressed={showLayoutEditor}
            >
              <Sliders className="w-3 h-3" strokeWidth={2.5} />
              edit layout
            </button>
          </div>
        </div>
        {/* Cap the preview so the full 16:9 frame always fits on screen
            when the section is stuck to the top. */}
        <div
          style={{
            maxWidth: "calc((100vh - 260px) * 1654 / 936)",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <OverlayPreview
            showTopicPlaceholder={showLayoutEditor}
            spotlightId={spotlightId}
            onToggleSpotlight={spotlightSet}
            editNamesMode={editNames}
            onRename={contestantRename}
          />
        </div>
        {/* Timer controls directly beneath the preview so the start/stop
            toggle sits adjacent to the clock it drives. */}
        <div className="flex justify-end mt-2">
          <TimerControls />
        </div>
      </section>
      {showLayoutEditor && <LayoutEditor />}

      {/* SHOW CONTROL — unified rundown + live-round gear. Each round card
          carries its own trigger/close controls. The HostPanel below the
          cards (with its built-in round list hidden) surfaces the live-
          round gear: RLGL positions, submissions, buzzer, force-fire
          cards, and the cards-remaining matrix. */}
      <section className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
        <div>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <SectionLabel icon={Settings2} label="SHOW CONTROL" />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditRundown((v) => !v)}
                // min-width pins the button to the same slot width in
                // both states. Without it, "done" is narrower than
                // "edit show" and the whole button shifts right by ~35px
                // when you flip modes, making the paired "restart show"
                // button look like it also moved.
                className="px-2 py-1 flex items-center justify-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
                style={{
                  fontFamily: "Inter, sans-serif",
                  border: `1px solid ${editRundown ? "#c6ff00" : "#333"}`,
                  color: editRundown ? "#c6ff00" : "#f0f0f0",
                  letterSpacing: "0.15em",
                  background: editRundown ? "#c6ff0014" : "transparent",
                  minWidth: "105px",
                }}
                aria-pressed={editRundown}
                title={
                  editRundown
                    ? "Lock the rundown again"
                    : "Unlock to edit, reorder, add, or delete rounds"
                }
              >
                <Pencil className="w-3 h-3" strokeWidth={2.5} />
                {editRundown ? "done" : "edit show"}
              </button>
              {/* "Restart show" rewinds every round to pending, clears all
                  transient game state (votes, reveals, buzzer, positions,
                  effects, spotlight, timer), and refreshes each contestant's
                  card charges. Rundown + roster are preserved so the
                  producer can re-run the same show from the top without
                  rebuilding anything. Confirm guard stops an accidental
                  nuke mid-show. */}
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Restart the show from the beginning? All rounds go back to pending and every submission/reveal is cleared. Rundown + contestants are preserved.",
                    )
                  ) {
                    showRestart();
                  }
                }}
                className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase hover:opacity-80 transition"
                style={{
                  fontFamily: "Inter, sans-serif",
                  border: "1px solid #333",
                  color: "#ffd700",
                  letterSpacing: "0.15em",
                  background: "transparent",
                }}
                title="Rewind every round to pending and clear all submissions. Rundown + contestants are kept."
              >
                <RotateCcw className="w-3 h-3" strokeWidth={2.5} />
                restart show
              </button>
            </div>
          </div>
          <div
            className="p-3 flex flex-col gap-3"
            style={{ background: "#111", border: "1px solid #222" }}
          >
            <div
              className="flex items-center justify-between gap-2 flex-wrap"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <div
                className="text-[10px] opacity-60 uppercase flex items-center gap-1.5"
                style={{ color: "#fff" }}
              >
                <ListOrdered className="w-3 h-3" strokeWidth={2.5} />
                rundown · {rounds.length} round{rounds.length === 1 ? "" : "s"}
              </div>
              {editRundown && (
                <div className="flex gap-2">
                  <button
                    onClick={roundAdd}
                    className="px-2.5 py-1 flex items-center gap-1 text-[11px] uppercase hover:-translate-y-0.5 transition-transform"
                    style={{
                      background: "#c6ff00",
                      color: "#000",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "0.08em",
                      boxShadow: "2px 2px 0 #c6ff00",
                    }}
                  >
                    <Plus className="w-3 h-3" strokeWidth={3} />
                    add round
                  </button>
                  <button
                    onClick={rundownClear}
                    disabled={rounds.length === 0}
                    className="px-2.5 py-1 flex items-center gap-1 text-[11px] uppercase hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: "#0a0a0a",
                      color: "#ff2e6b",
                      border: "1px solid #ff2e6b",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "0.08em",
                    }}
                    title={
                      activeRoundId
                        ? "Close the live round before clearing"
                        : "Remove every round from the rundown"
                    }
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={2.5} />
                    clear rundown
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {rounds.map((r, i) => (
                <ProducerRoundCard
                  key={r.id}
                  round={r}
                  index={i}
                  total={rounds.length}
                  isLive={r.id === activeRoundId}
                  isNextPending={r.id === nextPendingId}
                  anyLive={activeRoundId !== null}
                  canEdit={editRundown}
                />
              ))}
              {rounds.length === 0 && (
                <div
                  className="p-8 text-center"
                  style={{
                    background: "#0a0a0a",
                    border: "1px dashed #333",
                    color: "#666",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  no rounds yet — hit "add round" to start
                </div>
              )}
            </div>

            {/* Card allotment — how many of each card every contestant
                starts with. Changes apply immediately to all six tiles;
                if someone has already burned a charge, their "remaining"
                count flexes (we clamp `used` to the new max). Keeping
                this above the live submissions panel (via HostPanel
                below) so it reads as a show-setup knob, not a per-round
                tool. */}
            <div
              className="p-3 space-y-2"
              style={{ background: "#0a0a0a", border: "1px solid #222" }}
            >
              <div
                className="text-[10px] opacity-60 uppercase flex items-center gap-1.5"
                style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
              >
                <Sliders className="w-3 h-3" strokeWidth={2.5} />
                cards per player
              </div>
              {/* Stacked layout: full-width name row on top, counter row
                  beneath. Names like "SHUT THE !@#$ UP!!" need the full
                  tile width to fit — a side-by-side row forced them to
                  truncate. We shrink the label font a touch so even the
                  long name fits in the narrowest column on small screens. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.entries(CARDS) as Array<[CardKey, typeof CARDS[CardKey]]>)
                  .map(([key, card]) => {
                    const Icon = card.icon;
                    const value = cardMaxes[key] ?? card.maxUses;
                    const atMin = value <= 0;
                    const atMax = value >= 9;
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-1.5 px-2 py-1.5"
                        style={{
                          background: "#0a0a0a",
                          border: `1px solid ${card.color}44`,
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon
                            className="w-3 h-3 flex-shrink-0"
                            style={{ color: card.color }}
                            strokeWidth={2.5}
                          />
                          <span
                            className="text-[9px] leading-tight"
                            style={{
                              fontFamily: "Inter, sans-serif",
                              color: card.color,
                              letterSpacing: "0.04em",
                              whiteSpace: "nowrap",
                            }}
                            title={card.name}
                          >
                            {card.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => cardMaxSet(key, value - 1)}
                            disabled={atMin}
                            className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              background: "#111",
                              border: `1px solid ${card.color}66`,
                              color: card.color,
                            }}
                            aria-label={`Decrease ${card.name} per player`}
                          >
                            <Minus className="w-3 h-3" strokeWidth={3} />
                          </button>
                          <span
                            className="w-6 text-center text-[13px]"
                            style={{
                              fontFamily: "Inter, sans-serif",
                              color: card.color,
                              letterSpacing: "0.02em",
                            }}
                          >
                            {value}
                          </span>
                          <button
                            onClick={() => cardMaxSet(key, value + 1)}
                            disabled={atMax}
                            className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              background: "#111",
                              border: `1px solid ${card.color}66`,
                              color: card.color,
                            }}
                            aria-label={`Increase ${card.name} per player`}
                          >
                            <Plus className="w-3 h-3" strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <HostPanel
              showRoundsPanel={false}
              showCardAdmin={false}
              showSubmissions={false}
              showBuzzer={false}
            />
          </div>
        </div>

        <div>
          <SectionLabel
            icon={MessageSquare}
            label="BACKSTAGE CHAT"
            sub={chatSub}
          />
          <ChatPanel role={role} height={500} label={chatLabel} />
        </div>
      </section>
    </main>
  );
}
