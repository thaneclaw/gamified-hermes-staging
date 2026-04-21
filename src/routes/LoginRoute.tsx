import { ClipboardList, Monitor, Radio, Smartphone, Tv } from "lucide-react";
import { Link } from "react-router-dom";
import { useGameStore } from "../state/store";

// The landing page everyone sees first. Pick a role → get routed to the
// matching surface. Host + Producer are crew seats; each contestant tile
// is keyed off the authoritative contestant roster so renames made in
// Show Setup show up here immediately.
export function LoginRoute() {
  const contestants = useGameStore((s) => s.contestants);
  const connected = useGameStore((s) => s.connected);

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-10 space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-sm"
            style={{ background: "#ff2e6b" }}
          >
            <Radio className="w-5 h-5 text-black" strokeWidth={3} />
          </div>
          <div
            className="text-2xl leading-none tracking-tight"
            style={{
              fontFamily: "Inter, sans-serif",
              color: "#f0f0f0",
              letterSpacing: "0.02em",
            }}
          >
            GAME SHOW CONTROL DECK
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] uppercase"
          style={{
            fontFamily: "Inter, sans-serif",
            color: connected ? "#00e676" : "#ff1744",
            letterSpacing: "0.2em",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{
              background: connected ? "#00e676" : "#ff1744",
              boxShadow: connected
                ? "0 0 6px #00e676"
                : "0 0 6px #ff1744",
            }}
          />
          {connected ? "live" : "offline"}
        </div>
      </header>

      {/* CONTESTANTS — names are driven by the producer-authored roster
          so this list stays in sync with whatever was typed in the
          overlay placards. Rendered first so the most common action
          (a contestant tapping their own name) is at the top. */}
      <section>
        <div
          className="text-[10px] uppercase opacity-60 mb-2"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#f0f0f0",
            letterSpacing: "0.2em",
          }}
        >
          contestants
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {contestants.map((c) => (
            <Link
              key={c.id}
              to={`/contestant?id=${c.id}`}
              className="px-4 py-5 flex items-center justify-between hover:-translate-y-0.5 transition-transform min-w-0"
              style={{
                background: "#0a0a0a",
                border: `2px solid ${c.color}`,
                boxShadow: `3px 3px 0 ${c.color}`,
                color: c.color,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.06em",
                fontSize: "20px",
              }}
            >
              <span className="flex items-center gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                <Smartphone className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
                <span className="truncate">{c.name}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CREW — Host + Producer share the same Show Setup surface under
          the hood; we just route through two different URLs so the page
          title + chat role differ. OVERLAY is the OBS browser-source view
          of the composited stage — producers pop it open to eyeball what
          the broadcast looks like without booting up OBS. Always
          three-across on every width so the crew row reads as a set. */}
      <section>
        <div
          className="text-[10px] uppercase opacity-60 mb-2"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#f0f0f0",
            letterSpacing: "0.2em",
          }}
        >
          crew
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CrewTile to="/host" label="HOST" icon={Tv} />
          <CrewTile to="/producer" label="PRODUCER" icon={ClipboardList} />
          <CrewTile to="/overlay" label="OVERLAY" icon={Monitor} />
        </div>
      </section>
    </main>
  );
}

function CrewTile({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Tv;
}) {
  return (
    <Link
      to={to}
      className="px-5 py-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform min-w-0"
      style={{
        background: "#111",
        border: "1px solid #333",
        color: "#f0f0f0",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="flex items-center gap-3 min-w-0 whitespace-nowrap overflow-hidden">
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: "#ff2e6b" }} strokeWidth={2.5} />
        <span
          className="truncate"
          style={{
            fontSize: "22px",
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
    </Link>
  );
}
