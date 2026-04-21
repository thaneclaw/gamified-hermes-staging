import { Star } from "lucide-react";
import type { Contestant, VoteRecord } from "../../state/types";

interface Props {
  // The phone's own contestant (the one picking). Excluded from the
  // selection grid — you can't MVP yourself.
  self: Contestant;
  contestants: Contestant[];
  color: string;
  vote: VoteRecord | null;
  onSubmit: (targetId: string) => void;
}

// MVP mode — contestants pick another contestant as their "MVP of the
// show." Picks auto-reveal the moment they lock in, so the overlay,
// host panel, and phone all reflect the call immediately. The host
// still fires the full-screen winner celebration manually once every
// contestant has locked.
export function MvpPicker({
  self,
  contestants,
  color,
  vote,
  onSubmit,
}: Props) {
  const locked = !!vote && vote.kind === "mvp-pick";
  const pickedId = locked ? vote.value : null;
  const picked = pickedId
    ? (contestants.find((c) => c.id === pickedId) ?? null)
    : null;

  // Locked → the pick is already on-air. Show it in full ON-AIR style
  // so the contestant can see their own call is live on the overlay.
  if (locked && picked) {
    return (
      <div
        className="relative w-full py-3 px-3 flex items-center gap-3"
        style={{
          background: color,
          border: `3px solid ${color}`,
          color: "#000",
          boxShadow: `inset 0 0 20px ${color}80`,
        }}
      >
        <Star className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} fill="#000" />
        <div className="flex flex-col min-w-0">
          <div
            className="text-[9px] tracking-[0.25em] opacity-80"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            YOUR MVP · ON AIR
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "20px",
              letterSpacing: "0.04em",
              color: "#000",
            }}
          >
            {picked.name}
          </div>
        </div>
      </div>
    );
  }

  // Unlocked — grid of other contestants to tap. Tapping submits the
  // pick immediately; server de-dupes and the store reflects it on the
  // next snapshot, flipping us into the locked state above. Since the
  // server auto-reveals on submit, this lock happens live on stage.
  const others = contestants.filter((c) => c.id !== self.id);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-[10px] tracking-[0.2em] flex items-center gap-1.5"
        style={{ fontFamily: "Inter, sans-serif", color }}
      >
        <Star className="w-3 h-3" strokeWidth={2.5} fill={color} />
        PICK YOUR MVP OF THE SHOW
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {others.map((c) => (
          <button
            key={c.id}
            onClick={() => onSubmit(c.id)}
            className="px-2 py-3 active:translate-y-0.5 transition text-left"
            style={{
              background: "#000",
              border: `2px solid ${c.color}`,
              boxShadow: `3px 3px 0 ${c.color}`,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div
              className="text-[13px] truncate"
              style={{
                color: c.color,
                letterSpacing: "0.04em",
              }}
            >
              {c.name || "—"}
            </div>
            <div
              className="text-[8px] opacity-60 uppercase"
              style={{ color: "#fff", letterSpacing: "0.12em" }}
            >
              slot {c.slot}
            </div>
          </button>
        ))}
      </div>
      <div
        className="text-[9px] opacity-50 leading-tight"
        style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
      >
        tap a name to lock in your pick — it goes on-air right away.
      </div>
    </div>
  );
}
