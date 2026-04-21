import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { useGameStore } from "../../state/store";
import type { Layout, Rect } from "../../state/types";

/**
 * Producer-facing layout editor.
 *
 * The Layout shape in state holds a single set of dimensions shared by
 * all six contestant tiles (plus the topic bar and main stage). Editing
 * any one value here propagates to every mirrored tile automatically —
 * the overlay always derives its rects from these numbers.
 *
 * Sliders fire `layoutUpdate` on every change. The server applies +
 * broadcasts + debounces the disk write, so rapid dragging stays
 * smooth and the result persists across restarts + devices.
 */
export function LayoutEditor() {
  const layout = useGameStore((s) => s.layout);
  const layoutUpdate = useGameStore((s) => s.layoutUpdate);
  const layoutReset = useGameStore((s) => s.layoutReset);

  const set = <K extends keyof Layout>(key: K, value: Layout[K]) =>
    layoutUpdate({ [key]: value } as Partial<Layout>);

  const setTopicBar = (patch: Partial<Rect>) =>
    layoutUpdate({ topicBar: { ...layout.topicBar, ...patch } });

  const setCenter = (patch: Partial<Rect>) =>
    layoutUpdate({ centerSlot: { ...layout.centerSlot, ...patch } });

  const setTimer = (patch: Partial<Rect>) =>
    layoutUpdate({ timer: { ...layout.timer, ...patch } });

  const setRowTop = (idx: 0 | 1 | 2, value: number) => {
    const next = [...layout.rowTops] as [number, number, number];
    next[idx] = value;
    set("rowTops", next);
  };

  return (
    <div
      className="p-4 flex flex-col gap-4"
      style={{
        background: "#111",
        border: "1px solid #222",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-widest" style={{ color: "#888" }}>
          OVERLAY LAYOUT · edits sync to every client
        </div>
        <button
          onClick={layoutReset}
          className="px-2 py-1 text-[10px] uppercase flex items-center gap-1 hover:opacity-80 transition"
          style={{
            color: "#f0f0f0",
            border: "1px solid #333",
            letterSpacing: "0.15em",
          }}
          title="Restore default layout values"
        >
          <RotateCcw className="w-3 h-3" /> reset
        </button>
      </div>

      <Section title="CONTESTANT TILE · applies to all six">
        <Slider
          label="scale · all tiles"
          value={layout.tileScale ?? 1}
          min={0.5}
          max={2}
          step={0.01}
          onChange={(v) => set("tileScale", v)}
          unit="x"
        />
        <Slider
          label="corner radius"
          value={layout.tileCornerRadius ?? 12}
          min={0}
          max={50}
          step={0.5}
          onChange={(v) => set("tileCornerRadius", v)}
        />
        <Slider
          label="width"
          value={layout.tileWidth}
          min={6}
          max={25}
          step={0.1}
          onChange={(v) => set("tileWidth", v)}
        />
        <Slider
          label="height"
          value={layout.tileHeight}
          min={8}
          max={40}
          step={0.1}
          onChange={(v) => set("tileHeight", v)}
        />
        <Slider
          label="left column x"
          value={layout.columnLeftL}
          min={0}
          max={40}
          step={0.1}
          onChange={(v) => set("columnLeftL", v)}
        />
        <Slider
          label="right column x"
          value={layout.columnLeftR}
          min={50}
          max={95}
          step={0.1}
          onChange={(v) => set("columnLeftR", v)}
        />
        <Slider
          label="row 1 y"
          value={layout.rowTops[0]}
          min={0}
          max={40}
          step={0.1}
          onChange={(v) => setRowTop(0, v)}
        />
        <Slider
          label="row 2 y"
          value={layout.rowTops[1]}
          min={10}
          max={70}
          step={0.1}
          onChange={(v) => setRowTop(1, v)}
        />
        <Slider
          label="row 3 y"
          value={layout.rowTops[2]}
          min={30}
          max={95}
          step={0.1}
          onChange={(v) => setRowTop(2, v)}
        />
      </Section>

      <Section title="NAME PLACARD · mirrors across tiles">
        <Slider
          label="width"
          value={layout.placardWidth}
          min={4}
          max={20}
          step={0.1}
          onChange={(v) => set("placardWidth", v)}
        />
        <Slider
          label="height"
          value={layout.placardHeight}
          min={1.5}
          max={8}
          step={0.1}
          onChange={(v) => set("placardHeight", v)}
        />
        <Slider
          label="vertical offset from tile bottom"
          value={layout.placardTopOffset}
          min={-8}
          max={6}
          step={0.1}
          onChange={(v) => set("placardTopOffset", v)}
        />
      </Section>

      <Section title="TOPIC BAR">
        <Slider
          label="x"
          value={layout.topicBar.left}
          min={0}
          max={70}
          step={0.1}
          onChange={(v) => setTopicBar({ left: v })}
        />
        <Slider
          label="y"
          value={layout.topicBar.top}
          min={0}
          max={25}
          step={0.1}
          onChange={(v) => setTopicBar({ top: v })}
        />
        <Slider
          label="width"
          value={layout.topicBar.width}
          min={10}
          max={80}
          step={0.1}
          onChange={(v) => setTopicBar({ width: v })}
        />
        <Slider
          label="height"
          value={layout.topicBar.height}
          min={2}
          max={12}
          step={0.1}
          onChange={(v) => setTopicBar({ height: v })}
        />
      </Section>

      <Section title="MAIN STAGE">
        <Slider
          label="x"
          value={layout.centerSlot.left}
          min={10}
          max={60}
          step={0.1}
          onChange={(v) => setCenter({ left: v })}
        />
        <Slider
          label="y"
          value={layout.centerSlot.top}
          min={0}
          max={40}
          step={0.1}
          onChange={(v) => setCenter({ top: v })}
        />
        <Slider
          label="width"
          value={layout.centerSlot.width}
          min={20}
          max={70}
          step={0.1}
          onChange={(v) => setCenter({ width: v })}
        />
        <Slider
          label="height"
          value={layout.centerSlot.height}
          min={15}
          max={70}
          step={0.1}
          onChange={(v) => setCenter({ height: v })}
        />
      </Section>

      <Section title="COUNTDOWN TIMER · circle centre + diameter">
        <Slider
          label="centre x"
          value={layout.timer.left}
          min={0}
          max={100}
          step={0.1}
          onChange={(v) => setTimer({ left: v })}
        />
        <Slider
          label="centre y"
          value={layout.timer.top}
          min={0}
          max={100}
          step={0.1}
          onChange={(v) => setTimer({ top: v })}
        />
        <Slider
          label="diameter"
          value={layout.timer.width}
          min={2}
          max={25}
          step={0.1}
          onChange={(v) => setTimer({ width: v, height: v })}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-[9px] tracking-[0.25em]"
        style={{ color: "#f0f0f0" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-1.5 pl-1">{children}</div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "%",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  unit?: string;
}) {
  // Sub-percent steps get a second decimal; everything else stays tight.
  const decimals = step < 0.1 ? 2 : 1;
  const display = useMemo(() => value.toFixed(decimals), [value, decimals]);
  return (
    <label className="flex items-center gap-2 text-[10px]">
      <span
        className="w-44 flex-shrink-0"
        style={{ color: "#888", letterSpacing: "0.08em" }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#ff2e6b]"
        style={{ minWidth: "90px" }}
      />
      <input
        type="number"
        value={display}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-14 px-1 py-0.5 text-right outline-none"
        style={{
          background: "#0a0a0a",
          border: "1px solid #222",
          color: "#f0f0f0",
          fontSize: "11px",
          fontFamily: "Inter, sans-serif",
        }}
      />
      <span
        className="w-3 flex-shrink-0"
        style={{ color: "#555", fontSize: "9px" }}
      >
        {unit}
      </span>
    </label>
  );
}
