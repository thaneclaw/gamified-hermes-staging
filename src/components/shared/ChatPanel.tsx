import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, Zap, ZapOff } from "lucide-react";
import { useGameStore } from "../../state/store";
import type { ChatMessage, ChatRole, LogEntry } from "../../state/types";

interface Props {
  role: ChatRole;
  // Required when role === "contestant"; identifies which contestant the
  // outgoing messages belong to.
  contestantId?: string;
  // How tall the scrolling message list should be. Defaults fit the
  // host/producer control panels; contestant phones pass something smaller.
  height?: number;
  label?: string;
}

type FeedItem =
  | { kind: "chat"; id: number; time: number; msg: ChatMessage }
  | { kind: "event"; id: number; time: number; entry: LogEntry };

export function ChatPanel({
  role,
  contestantId,
  height = 220,
  label = "BACKSTAGE CHAT",
}: Props) {
  const messages = useGameStore((s) => s.chatMessages);
  const events = useGameStore((s) => s.eventLog);
  const chatSend = useGameStore((s) => s.chatSend);
  const [text, setText] = useState("");
  const [showEvents, setShowEvents] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Merge chat + events into one feed sorted newest-first so the most
  // recent item sits at the top of the scroller, right below the input
  // bar (which now lives above the list).
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = messages.map((m) => ({
      kind: "chat",
      id: m.id,
      time: m.time,
      msg: m,
    }));
    if (showEvents) {
      for (const e of events) {
        items.push({ kind: "event", id: e.id, time: e.time, entry: e });
      }
    }
    items.sort((a, b) => b.time - a.time);
    return items;
  }, [messages, events, showEvents]);

  // Jump back to the top whenever the feed grows so the newest item is
  // always the one in view right under the input bar.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [feed]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    chatSend({ role, authorId: contestantId, text: v });
    setText("");
  };

  // Mode-aware color for the "You" attribution on the input row
  const accent =
    role === "host"
      ? "#ff2e6b"
      : role === "producer"
        ? "#c6ff00"
        : (useGameStore
            .getState()
            .contestants.find((c) => c.id === contestantId)?.color ??
          "#f0f0f0");

  const roleBadge =
    role === "contestant" ? "YOU" : role === "host" ? "HOST" : "PRODUCER";

  const EventsIcon = showEvents ? Zap : ZapOff;

  return (
    <div
      className="flex flex-col"
      style={{ background: "#111", border: "1px solid #222" }}
    >
      <div
        className="px-3 py-2 flex items-center gap-1.5 border-b"
        style={{
          borderColor: "#1f1f1f",
          fontFamily: "Inter, sans-serif",
          color: "#888",
          fontSize: "10px",
          letterSpacing: "0.2em",
        }}
      >
        <MessageSquare className="w-3 h-3" strokeWidth={2.5} />
        {label}
        <span className="ml-auto opacity-50 mr-2">{feed.length}</span>
        <button
          type="button"
          onClick={() => setShowEvents((v) => !v)}
          className="px-1.5 py-0.5 flex items-center gap-1 hover:bg-white/5 transition"
          style={{
            border: `1px solid ${showEvents ? "#2a2a2a" : "#1f1f1f"}`,
            color: showEvents ? "#f0f0f0" : "#555",
            letterSpacing: "0.15em",
          }}
          title={showEvents ? "Hide event log" : "Show event log"}
          aria-pressed={showEvents}
        >
          <EventsIcon className="w-3 h-3" strokeWidth={2.5} />
          events {showEvents ? "ON" : "OFF"}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-stretch border-b"
        style={{ borderColor: "#1f1f1f" }}
      >
        <span
          className="px-2 flex items-center flex-shrink-0"
          style={{
            background: "#0a0a0a",
            color: accent,
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            letterSpacing: "0.08em",
          }}
        >
          {roleBadge}
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="say something…"
          maxLength={240}
          className="flex-1 min-w-0 px-2 py-2 bg-transparent outline-none"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: "#f0f0f0",
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-3 flex items-center justify-center disabled:opacity-30 transition"
          style={{
            background: accent,
            color: "#000",
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            letterSpacing: "0.1em",
          }}
          aria-label="Send chat message"
        >
          <Send className="w-3 h-3" strokeWidth={3} />
        </button>
      </form>

      <div
        ref={scrollerRef}
        className="overflow-y-auto p-3 space-y-1.5"
        style={{
          height,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {feed.length === 0 ? (
          <div className="text-[11px] opacity-40" style={{ color: "#fff" }}>
            — nothing yet —
          </div>
        ) : (
          feed.map((item) =>
            item.kind === "chat" ? (
              <div
                key={`c-${item.id}`}
                className="text-[11px] flex items-start gap-2"
              >
                <span
                  className="flex-shrink-0"
                  style={{
                    color: "#555",
                    fontSize: "9px",
                    lineHeight: "16px",
                  }}
                >
                  {new Date(item.time).toTimeString().slice(0, 5)}
                </span>
                <span
                  className="px-1.5 flex-shrink-0"
                  style={{
                    background: item.msg.color,
                    color: "#000",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    lineHeight: "16px",
                  }}
                  title={
                    item.msg.role === "contestant"
                      ? "Contestant"
                      : item.msg.role === "host"
                        ? "Host"
                        : "Producer"
                  }
                >
                  {item.msg.name}
                </span>
                <span
                  className="break-words"
                  style={{ color: "#f0f0f0", lineHeight: "16px" }}
                >
                  {item.msg.text}
                </span>
              </div>
            ) : (
              <div
                key={`e-${item.id}`}
                className="text-[10px] flex items-start gap-2 opacity-70"
              >
                <span
                  className="flex-shrink-0"
                  style={{
                    color: "#555",
                    fontSize: "9px",
                    lineHeight: "16px",
                  }}
                >
                  {new Date(item.time).toTimeString().slice(0, 5)}
                </span>
                <Zap
                  className="w-2.5 h-2.5 flex-shrink-0"
                  style={{ color: "#666", marginTop: "3px" }}
                  strokeWidth={2.5}
                />
                <span
                  className="break-words"
                  style={{ color: item.entry.color, lineHeight: "16px" }}
                >
                  {item.entry.text}
                </span>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
