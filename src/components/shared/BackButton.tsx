import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

// Minimal top-of-page back link that returns the user to the login/
// name-picker screen. Used across the Host, Producer, and Contestant
// surfaces now that the global nav/header chrome is gone.
export function BackButton({ to = "/" }: { to?: string } = {}) {
  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-4">
      <Link
        to={to}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] uppercase hover:opacity-80 transition"
        style={{
          fontFamily: "Inter, sans-serif",
          border: "1px solid #333",
          color: "#f0f0f0",
          letterSpacing: "0.12em",
          background: "#0a0a0a",
        }}
      >
        <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
        back
      </Link>
    </div>
  );
}
