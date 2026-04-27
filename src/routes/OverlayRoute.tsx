import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  TILES_STORAGE_KEY,
  loadCalibratedTiles,
  saveCalibratedTiles,
  type SeatId,
  type Tile,
  type TileMap,
} from "../coords";
import {
  buildOverlayDataOnlyUrl,
  useVdoNinja,
  type CardPlayEvent,
  type EmojiEvent,
  type EventPayload,
} from "../lib/vdoninja";

// ── canvas + perf constants ─────────────────────────────────────────────

/** Fixed render target — matches the producer's OBS canvas exactly. */
const CANVAS_W = 1920;
const CANVAS_H = 1080;

/**
 * Soft cap on simultaneous in-flight emoji floats per sender. Spec §3.2:
 * realistic spam tops out at 10–15; 30 is comfortable headroom without
 * letting a runaway sender queue 1k DOM nodes.
 */
const EMOJI_PER_SEAT_CAP = 30;

/** Emoji float animation length (matches `floatUpOverlay` keyframe). */
const EMOJI_FLOAT_MS = 1500;

/** Card animation total length (matches `cardOverlayHold` keyframe). */
const CARD_ANIM_MS = 2800;

/**
 * Calibration palette — stable per-seat colors so each rect is easy to
 * distinguish on a busy scene during setup.
 */
const CALIBRATION_COLORS: Record<SeatId, string> = {
  L1: "#22e2ff",
  L2: "#a855ff",
  L3: "#ff2e9f",
  R1: "#ffb000",
  R2: "#22ff8a",
  R3: "#ff5454",
};

// ── per-event render state ──────────────────────────────────────────────

interface EmojiSprite {
  id: string;
  seat: SeatId;
  emoji: string;
  /** X offset within the tile (0..tile.w). */
  xWithinTile: number;
  /** Sway direction (+1 / −1) for the slight horizontal drift. */
  swaySign: 1 | -1;
}

interface CardSprite {
  id: string;
  cardId: CardPlayEvent["cardId"];
  targetSeat: SeatId;
}

// ── component ───────────────────────────────────────────────────────────

export function OverlayRoute() {
  const [search] = useSearchParams();
  const calibrateMode = search.get("calibrate") === "1";

  // Per-machine tile overrides (from prior CalibrationEvents). Live in
  // localStorage on this overlay browser source's machine.
  const [tiles, setTiles] = useState<TileMap>(loadCalibratedTiles);

  // Emoji + card animations currently on screen. Trimmed by timers below.
  const [emojiSprites, setEmojiSprites] = useState<readonly EmojiSprite[]>([]);
  const [cardSprites, setCardSprites] = useState<readonly CardSprite[]>([]);
  const idCounter = useRef(0);
  const nextId = () => `${Date.now().toString(36)}-${(idCounter.current++).toString(36)}`;

  // Make the body fully transparent so OBS only composites our sprites.
  // Cross-tab calibration: also pick up direct localStorage writes (e.g.
  // calibration done in a sibling tab) on top of the broadcast events.
  useEffect(() => {
    document.body.classList.add("overlay-route");
    const onStorage = (e: StorageEvent) => {
      if (e.key === TILES_STORAGE_KEY) setTiles(loadCalibratedTiles());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      document.body.classList.remove("overlay-route");
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Drop emoji sprites once their float animation has finished. Storing
  // them in state lets React reconcile cleanly without a re-render loop.
  const enqueueEmoji = useCallback((sprite: EmojiSprite) => {
    setEmojiSprites((prev) => {
      // Per-seat soft cap: drop the oldest sprite for this seat first.
      const sameSeat = prev.filter((s) => s.seat === sprite.seat);
      let next = prev;
      if (sameSeat.length >= EMOJI_PER_SEAT_CAP) {
        next = prev.filter((s) => s.id !== sameSeat[0]!.id);
      }
      return [...next, sprite];
    });
    window.setTimeout(() => {
      setEmojiSprites((prev) => prev.filter((s) => s.id !== sprite.id));
    }, EMOJI_FLOAT_MS + 80);
  }, []);

  const enqueueCard = useCallback((sprite: CardSprite) => {
    setCardSprites((prev) => [...prev, sprite]);
    window.setTimeout(() => {
      setCardSprites((prev) => prev.filter((s) => s.id !== sprite.id));
    }, CARD_ANIM_MS + 80);
  }, []);

  const onMessage = useCallback(
    (msg: EventPayload) => {
      switch (msg.type) {
        case "emoji":
          handleEmoji(msg, tiles, enqueueEmoji, nextId);
          break;
        case "cardPlay":
          enqueueCard({ id: nextId(), cardId: msg.cardId, targetSeat: msg.targetSeat });
          break;
        case "calibration":
          setTiles(msg.tiles);
          saveCalibratedTiles(msg.tiles);
          break;
        // rosterUpdate, cardReset → handled by /play, not the overlay.
        default:
          break;
      }
    },
    // tiles is intentionally read fresh inside handleEmoji via closure;
    // re-binding the listener every tile change is fine and rare.
    [tiles, enqueueEmoji, enqueueCard],
  );

  const { iframeRef } = useVdoNinja({ onMessage });
  const overlayUrl = useMemo(() => buildOverlayDataOnlyUrl(), []);

  return (
    <div style={styles.root}>
      <div style={styles.canvas}>
        {emojiSprites.map((sprite) => (
          <EmojiFloat key={sprite.id} sprite={sprite} tile={tiles[sprite.seat]} />
        ))}

        {cardSprites.map((sprite) =>
          sprite.cardId === "stfu" ? (
            <StfuCard key={sprite.id} tile={tiles[sprite.targetSeat]} />
          ) : (
            <MicDropCard key={sprite.id} tile={tiles[sprite.targetSeat]} />
          ),
        )}

        {calibrateMode && <CalibrationGrid tiles={tiles} />}
      </div>

      {/*
        Hidden data-channel iframe. We position it off-screen (and 0 size +
        no pointer events) so it never paints over the scene, while
        keeping it mounted so the WebRTC data channel stays connected.
      */}
      <iframe
        ref={iframeRef}
        src={overlayUrl}
        title="VDO.Ninja data channel"
        style={styles.hiddenIframe}
        allow="microphone; camera"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function handleEmoji(
  msg: EmojiEvent,
  tiles: TileMap,
  enqueue: (sprite: EmojiSprite) => void,
  nextId: () => string,
) {
  // Host has no tile (per build-spec §3.2 emojis come from the *sender's*
  // tile, and §5 only defines six guest tiles). Drop silently.
  if (msg.from.kind !== "guest") return;
  const tile = tiles[msg.from.seat];
  if (!tile) return;
  enqueue({
    id: nextId(),
    seat: msg.from.seat,
    emoji: msg.emoji,
    xWithinTile: Math.random() * tile.w,
    swaySign: Math.random() < 0.5 ? -1 : 1,
  });
}

// ── sprites ─────────────────────────────────────────────────────────────

interface EmojiFloatProps {
  sprite: EmojiSprite;
  tile: Tile;
}

function EmojiFloat({ sprite, tile }: EmojiFloatProps) {
  // Spawn at the bottom edge of the tile, centered on the chosen X.
  // Keep the spawn position in static `top/left` (set once per element);
  // the float itself is a transform-only animation = compositor-friendly.
  const spawnLeft = tile.x + sprite.xWithinTile;
  const spawnTop = tile.y + tile.h - 36; // a touch above the bottom edge
  return (
    <div
      style={{
        position: "absolute",
        left: spawnLeft,
        top: spawnTop,
        width: 0,
        height: 0,
        // The keyframe animates --sway via translate; per-sprite var below.
        ["--sway" as string]: `${sprite.swaySign * 18}px`,
        animation: `floatUpOverlay ${EMOJI_FLOAT_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          transform: "translate(-50%, -50%)",
          fontSize: 56,
          lineHeight: 1,
          filter: "drop-shadow(0 0 12px rgba(0, 0, 0, 0.55))",
          // Keep emoji glyphs from getting AA'd into mush.
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        }}
      >
        {sprite.emoji}
      </span>
    </div>
  );
}

function StfuCard({ tile }: { tile: Tile }) {
  return (
    <div style={tileBoxStyle(tile)}>
      {/* Red flash + dim — single layer, transform-only animation. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(255, 60, 100, 0.85), rgba(180, 0, 30, 0.6))",
          mixBlendMode: "multiply",
          opacity: 0,
          willChange: "opacity",
          animation: "stfuFlash 2800ms ease-out forwards",
        }}
      />
      {/* Persistent dim + desaturate "wash" — separate layer so the flash
          can ride on top without recomputing both each frame. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(20, 0, 8, 0.55)",
          opacity: 0,
          willChange: "opacity",
          animation: "stfuDim 2800ms ease-out forwards",
        }}
      />
      {/* "🤐" zipper-mouth slam over the name area (lower-third of tile). */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "62%",
          transform: "translate(-50%, -50%) scale(0)",
          fontSize: Math.round(tile.h * 0.55),
          lineHeight: 1,
          willChange: "transform, opacity",
          animation: "stfuSlam 2800ms cubic-bezier(0.22, 1.2, 0.36, 1) forwards",
          textShadow: "0 6px 22px rgba(0, 0, 0, 0.7)",
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        }}
      >
        {"\u{1F910}"}
      </div>
    </div>
  );
}

function MicDropCard({ tile }: { tile: Tile }) {
  const micSize = Math.round(tile.w * 0.42);
  return (
    <div style={tileBoxStyle(tile)}>
      {/* Spotlight beam — gold cone fading downward through the tile. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255, 200, 60, 0) 0%, rgba(255, 200, 60, 0.55) 35%, rgba(255, 160, 0, 0.4) 70%, rgba(255, 160, 0, 0) 100%)",
          opacity: 0,
          willChange: "opacity",
          animation: "micSpotlight 2800ms ease-out forwards",
        }}
      />
      {/* Mic SVG falling from the top with a small bounce. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "10%",
          transform: "translate(-50%, -200%) rotate(-12deg)",
          willChange: "transform, opacity",
          animation: "micFall 2800ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <MicSvg size={micSize} />
      </div>
      {/* Crown-glow ring around the lower placard area. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "70%",
          width: tile.w * 0.7,
          height: tile.w * 0.7,
          transform: "translate(-50%, -50%) scale(0.4)",
          borderRadius: "50%",
          border: "3px solid rgba(255, 200, 60, 0.85)",
          boxShadow:
            "0 0 32px rgba(255, 200, 60, 0.7), inset 0 0 28px rgba(255, 200, 60, 0.5)",
          opacity: 0,
          willChange: "transform, opacity",
          animation: "micCrown 2800ms ease-out forwards",
        }}
      />
    </div>
  );
}

function MicSvg({ size }: { size: number }) {
  // Hand-rolled mic glyph — keeps the bundle small and avoids loading an
  // external icon font at OBS browser-source startup.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 96"
      aria-hidden="true"
      style={{
        filter: "drop-shadow(0 8px 18px rgba(0, 0, 0, 0.6))",
      }}
    >
      <defs>
        <linearGradient id="micGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.45" stopColor="#ffcb45" />
          <stop offset="1" stopColor="#a86a00" />
        </linearGradient>
      </defs>
      {/* capsule */}
      <rect x="20" y="6" width="24" height="46" rx="12" fill="url(#micGrad)" />
      {/* grill highlight lines */}
      <g stroke="rgba(60, 30, 0, 0.45)" strokeWidth="1.5">
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="26" x2="42" y2="26" />
        <line x1="22" y1="34" x2="42" y2="34" />
        <line x1="22" y1="42" x2="42" y2="42" />
      </g>
      {/* yoke */}
      <path
        d="M14 44 Q 14 64 32 64 Q 50 64 50 44"
        stroke="#d8a230"
        strokeWidth="3"
        fill="none"
      />
      {/* stem */}
      <rect x="30" y="62" width="4" height="20" fill="#d8a230" />
      {/* base */}
      <rect x="22" y="82" width="20" height="6" rx="2" fill="#d8a230" />
    </svg>
  );
}

function CalibrationGrid({ tiles }: { tiles: TileMap }) {
  return (
    <>
      {(Object.keys(tiles) as SeatId[]).map((seat) => {
        const tile = tiles[seat];
        const color = CALIBRATION_COLORS[seat];
        return (
          <div
            key={seat}
            style={{
              ...tileBoxStyle(tile),
              background: `${color}22`,
              outline: `2px dashed ${color}`,
              outlineOffset: -2,
              color,
              fontSize: 28,
              letterSpacing: 2,
              fontWeight: 800,
              padding: 10,
              boxSizing: "border-box",
              textShadow: "0 0 6px rgba(0, 0, 0, 0.85)",
            }}
          >
            <div>{seat}</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              {`${tile.x},${tile.y} · ${tile.w}×${tile.h}`}
            </div>
          </div>
        );
      })}
    </>
  );
}

function tileBoxStyle(tile: Tile): CSSProperties {
  return {
    position: "absolute",
    left: tile.x,
    top: tile.y,
    width: tile.w,
    height: tile.h,
    overflow: "hidden",
    pointerEvents: "none",
  };
}

// ── styles ──────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    background: "transparent",
    overflow: "hidden",
    pointerEvents: "none",
  },
  canvas: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CANVAS_W,
    height: CANVAS_H,
    pointerEvents: "none",
  },
  hiddenIframe: {
    position: "absolute",
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    border: 0,
    opacity: 0,
    pointerEvents: "none",
  },
};
