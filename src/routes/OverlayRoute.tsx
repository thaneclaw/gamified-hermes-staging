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

/** Card animation total length (matches the per-card keyframes in index.css). */
const CARD_ANIM_MS = 2000;

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

/**
 * STFU card animation (target tile only, ~2s).
 *
 * Layout:
 *   1. Tile-shake wrapper (transform-only) wraps everything so the whole
 *      tile region rocks for the first 100ms.
 *   2. Red radial flash on the tile, fading in fast and decaying.
 *   3. Dim/desaturate wash holds for the bulk of the animation.
 *   4. Two-line "SHUT THE / !@#$ UP!!" text slams in via the existing
 *      `slamIn` keyframe + a multi-layer drop-shadow stack (red + black)
 *      cribbed from Chris's repo for the same dramatic stamp effect.
 *
 * Sized so the longest line ("SHUT THE !@#$ UP!!") fits the 280px-wide
 * tile with a margin: clamps based on tile.w so calibrated tiles still
 * read clean.
 */
function StfuCard({ tile }: { tile: Tile }) {
  // 32px at the spec'd 280px width; scales down on smaller tiles.
  const fontSize = Math.max(18, Math.round(tile.w * 0.115));
  return (
    <div
      style={{
        ...tileBoxStyle(tile),
        // Wrapper-level shake animation — a couple of fast oscillations.
        willChange: "transform",
        animation: "stfuTileShake 360ms ease-in-out",
      }}
    >
      {/* Red flash — fast in, decays. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 45%, rgba(255, 60, 100, 0.9), rgba(180, 0, 30, 0.55))",
          mixBlendMode: "multiply",
          opacity: 0,
          willChange: "opacity",
          animation: "stfuFlash 2000ms ease-out forwards",
        }}
      />
      {/* Dim + desaturate wash — uses backdrop-style filter approximation
          via a dark overlay (the underlying VDO video is in another OBS
          source so we can't apply CSS filter to it directly; the dark
          wash reads as "muted" against the red flash on top). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 0, 8, 0.6)",
          opacity: 0,
          willChange: "opacity",
          animation: "stfuDim 2000ms ease-out forwards",
        }}
      />
      {/* The slam text — the hero of the animation. Two lines, line-height
          0.95 so they hug. Multi-layer drop-shadow gives the stacked
          stamp look (red offset + black offset behind for depth). */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) scale(3) rotate(-2deg)",
          opacity: 0,
          willChange: "transform, opacity",
          animation:
            "stfuSlamText 2000ms cubic-bezier(0.2, 1.5, 0.4, 1) forwards",
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
          fontWeight: 900,
          fontSize,
          lineHeight: 0.95,
          letterSpacing: 1,
          color: "#ffffff",
          textAlign: "center",
          whiteSpace: "pre",
          textShadow: [
            // Red offset — the brand stamp
            "3px 3px 0 #ff2e6b",
            "3px 3px 0 #ff2e6b",
            // Black offset behind that for depth
            "5px 5px 0 #000",
            "5px 5px 0 #000",
            // Soft outer glow so it pops off the video below
            "0 0 18px rgba(255, 46, 107, 0.85)",
          ].join(", "),
        }}
      >
        {"SHUT THE\n!@#$ UP!!"}
      </div>
    </div>
  );
}

/**
 * MIC DROP card animation (target tile only, ~2s).
 *
 * Layout:
 *   1. Amber radial flash on the tile (no shake — celebration, not
 *      disruption).
 *   2. "MIC DROP" text slams in via slamIn with an amber/black multi-
 *      layer drop-shadow stack matching the STFU treatment.
 *   3. Mic emoji falls from the top of the tile and lands beside the
 *      text with a small bounce.
 *   4. Tile edge gets a gentle gold inset glow ring that pulses opacity.
 */
function MicDropCard({ tile }: { tile: Tile }) {
  const fontSize = Math.max(20, Math.round(tile.w * 0.13));
  const micSize = Math.max(28, Math.round(tile.w * 0.18));
  return (
    <div style={tileBoxStyle(tile)}>
      {/* Amber flash — quick in, holds soft, then fades. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 45%, rgba(255, 200, 60, 0.78), rgba(255, 160, 0, 0.4))",
          mixBlendMode: "screen",
          opacity: 0,
          willChange: "opacity",
          animation: "micFlash 2000ms ease-out forwards",
        }}
      />
      {/* Gold ring around the tile edge — pulses gently while the text holds. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow:
            "inset 0 0 32px rgba(255, 200, 60, 0.85), inset 0 0 80px rgba(255, 200, 60, 0.45)",
          opacity: 0,
          willChange: "opacity",
          animation: "micGlowRing 2000ms ease-out forwards",
        }}
      />
      {/* Mic emoji falling from the top — lands a touch left of the text. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(calc(-50% - 2.5em), -200%) rotate(-12deg)",
          willChange: "transform, opacity",
          animation:
            "micEmojiFall 2000ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          fontSize: micSize,
          lineHeight: 1,
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
          filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.55))",
        }}
      >
        {"\u{1F3A4}"}
      </div>
      {/* Slam text — single line "MIC DROP", amber-stamped. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) scale(3) rotate(-2deg)",
          opacity: 0,
          willChange: "transform, opacity",
          animation:
            "micSlamText 2000ms cubic-bezier(0.2, 1.5, 0.4, 1) forwards",
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
          fontWeight: 900,
          fontSize,
          letterSpacing: 1.5,
          color: "#ffffff",
          textAlign: "center",
          whiteSpace: "nowrap",
          textShadow: [
            "3px 3px 0 #ffcb45",
            "3px 3px 0 #ffcb45",
            "5px 5px 0 #000",
            "5px 5px 0 #000",
            "0 0 18px rgba(255, 203, 69, 0.85)",
          ].join(", "),
        }}
      >
        MIC DROP
      </div>
    </div>
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
