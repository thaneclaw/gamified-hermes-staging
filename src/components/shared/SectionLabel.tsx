import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  sub?: string;
}

export function SectionLabel({ icon: Icon, label, sub }: Props) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5" style={{ color: "#666" }} />
      <span
        className="text-xs tracking-widest"
        style={{
          fontFamily: "Inter, sans-serif",
          color: "#f0f0f0",
          letterSpacing: "0.15em",
        }}
      >
        {label}
      </span>
      {sub && (
        <span
          className="text-[10px] opacity-50"
          style={{ fontFamily: "Inter, sans-serif", color: "#fff" }}
        >
          {sub}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "#1f1f1f" }} />
    </div>
  );
}
