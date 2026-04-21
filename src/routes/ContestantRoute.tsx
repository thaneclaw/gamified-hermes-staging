import { useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BackButton } from "../components/shared/BackButton";
import { ContestantPhone } from "../components/contestant/ContestantPhone";
import { useGameStore } from "../state/store";
import type { Contestant } from "../state/types";

export function ContestantRoute() {
  const [params] = useSearchParams();
  const requestedId = params.get("id");
  const contestants = useGameStore((s) => s.contestants);
  const match = requestedId
    ? contestants.find((c) => c.id === requestedId)
    : null;

  if (!match) {
    return (
      <>
        <BackButton />
        <main className="max-w-[640px] mx-auto px-6 py-10 space-y-4">
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "28px",
            letterSpacing: "0.04em",
            color: "#f0f0f0",
          }}
        >
          PICK A CONTESTANT
        </div>
        <div
          className="text-xs opacity-60"
          style={{ fontFamily: "Inter, sans-serif", color: "#f0f0f0" }}
        >
          each phone loads <code>/contestant?id=&lt;a|b|c|d|e|f&gt;</code>.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {contestants.map((c) => (
            <Link
              key={c.id}
              to={`/contestant?id=${c.id}`}
              className="px-3 py-3 flex items-center justify-between hover:opacity-80 transition"
              style={{
                background: "#0a0a0a",
                border: `2px solid ${c.color}`,
                color: c.color,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.06em",
                fontSize: "18px",
              }}
            >
              <span>{c.name}</span>
              <span
                className="text-[10px] opacity-60"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                /?id={c.id}
              </span>
            </Link>
          ))}
        </div>
        </main>
      </>
    );
  }

  return (
    <>
      <BackButton />
      <ResponsivePhone contestant={match} />
    </>
  );
}

// Wraps the fixed-layout ContestantPhone in a scale transform so the UI
// grows/shrinks with the viewport while keeping its internal px-accurate
// proportions. The phone renders at a fixed nominal width (420px), then
// a useLayoutEffect measures the viewport and scales via transform. The
// wrapper's height is reserved to match the scaled height so the page
// doesn't reflow unexpectedly.
function ResponsivePhone({ contestant }: { contestant: Contestant }) {
  const NOMINAL_WIDTH = 420;
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(0);

  useLayoutEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Available width after a 16px gutter on each side.
      const availW = Math.max(320, w - 32);
      // Cap the vertical scale by viewport height too so the phone never
      // grows taller than the window (the inner content height is what
      // ultimately drives the reserved space).
      const byWidth = availW / NOMINAL_WIDTH;
      const availH = Math.max(480, h - 16);
      const nominalH = innerRef.current?.offsetHeight ?? 900;
      const byHeight = nominalH > 0 ? availH / nominalH : byWidth;
      const s = Math.max(0.7, Math.min(2.4, Math.min(byWidth, byHeight)));
      setScale(s);
      if (nominalH > 0) setInnerHeight(nominalH * s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("resize", compute);
      ro.disconnect();
    };
  }, [contestant.id]);

  return (
    <main className="min-h-screen w-full flex items-start justify-center py-2">
      <div
        style={{
          width: NOMINAL_WIDTH * scale,
          height: innerHeight || undefined,
          position: "relative",
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: NOMINAL_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <ContestantPhone contestant={contestant} />
        </div>
      </div>
    </main>
  );
}
