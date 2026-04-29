/**
 * Thin wrapper around VDO.Ninja's iframe `postMessage` API.
 *
 * The wrapper page never creates its own peer connections — it iframes
 * the existing VDO.Ninja URL each guest already publishes through, then
 * piggy-backs on the room's P2P data channels for our gameplay events.
 * That keeps guest upload bandwidth untouched (Hard Rule #1 in CLAUDE.md).
 *
 * Outbound: parent → iframe → broadcast to all peer connections.
 *   { sendData: { overlayNinja: <payload> }, type: 'pcs' }
 *
 * Inbound: iframe → parent (whenever a remote peer's payload arrives).
 *   event.data.dataReceived?.overlayNinja  → typed {@link EventPayload}
 *
 * All payloads are namespaced under `overlayNinja` so we can share a
 * room with VDO.Ninja's own and other apps' data without crossing wires.
 *
 * Reference: https://docs.vdo.ninja/guides/iframe-api-documentation
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { CardId } from "../cards";
import type { Emoji } from "../emojis";
import type { SeatId, TileMap } from "../coords";

// ── URL builders ────────────────────────────────────────────────────────

/** Base URL for the VDO.Ninja hosted client. */
const VDO_NINJA_BASE = "https://vdo.ninja/";

/**
 * Producer's stream identifier — the OBS Virtual Camera publish ID.
 * Host iframes view this so the host sees the composited feed.
 */
export const PRODUCER_VIEW_ID = "TBSqrdw";

/**
 * Constants shared by every wrapper iframe in the room. These match the
 * params the producer's existing guest URLs already carry — the wrapper
 * preserves them so the layer doesn't fight the production setup.
 *
 * Flag-style params (no `=value`) are encoded as `null` and rendered
 * without an equals sign, matching what VDO.Ninja's URL parser expects.
 */
const GUEST_ROOM_PARAMS: Array<readonly [string, string | null]> = [
  ["room", "GamifiedShow"],
  ["hash", "1f71"],
  ["q", null],
  ["tips", null],
  ["roombitrate", "0"],
];

/**
 * Overlay browser source URL. Joins the room as a data-only peer:
 * no video, no audio, just data channel for receiving emoji/card events.
 *
 * NOTE: per build-spec §6 the `&dataonly` flag is the intended mode but
 * worth verifying before show day; fallback is `&novideo&noaudio`.
 */
const OVERLAY_PARAMS: Array<readonly [string, string | null]> = [
  ["room", "GamifiedShow"],
  ["password", "gaming"],
  ["dataonly", null],
  ["hash", "1f71"],
];

/**
 * Builds a `key=value` query string, supporting flag-style params where
 * `value === null` produces just the key. Uses `encodeURIComponent` so
 * label/push values can safely contain spaces or symbols.
 */
function toQueryString(
  params: Array<readonly [string, string | null]>,
): string {
  return params
    .map(([k, v]) =>
      v === null
        ? encodeURIComponent(k)
        : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
    )
    .join("&");
}

export interface GuestIframeParams {
  /** VDO.Ninja stream id this guest publishes under (e.g., `i2zCGkA`). */
  push: string;
  /** Display label VDO.Ninja shows in the room (e.g., `Guest1`). */
  label: string;
}

/**
 * Broadcast-mode flags layered on top of {@link GUEST_ROOM_PARAMS} for
 * the GUEST iframe only. Together they make the guest see only the
 * producer's composited stream (the director) and remove all other
 * guests from the visible layout — so a 4th guest joining doesn't
 * shrink the producer's stream to make room.
 *
 *   broadcast    → guests see only the director's stream; other guests
 *                  are removed from the layout (auto-discovers the
 *                  director, no need to hardcode `view=TBSqrdw`).
 *                  Audio between guests is unaffected.
 *   showlist=0   → hides VDO.Ninja's participant sidebar.
 *   minipreview  → small self-view so guests can confirm their cam.
 *
 * `roombitrate=0` (in GUEST_ROOM_PARAMS) stays as a bandwidth safety
 * belt — it works in conjunction with `broadcast`, not as a substitute.
 *
 * Reference: https://docs.vdo.ninja/advanced-settings/video-parameters/broadcast
 */
const GUEST_BROADCAST_PARAMS: Array<readonly [string, string | null]> = [
  ["broadcast", null],
  ["showlist", "0"],
  ["minipreview", null],
];

/**
 * Builds the iframe `src` for a guest's wrapper. Layers the broadcast-
 * mode flags on top of the room constants so the guest sees only the
 * producer's composited stream (auto-discovered) — and other guests
 * joining doesn't shrink that view.
 *
 * Does **not** add an explicit `view=` — `&broadcast` auto-targets the
 * director's stream.
 */
export function buildIframeUrl(params: GuestIframeParams): string {
  const all = [
    ...GUEST_ROOM_PARAMS,
    ...GUEST_BROADCAST_PARAMS,
    ["push", params.push] as const,
    ["label", params.label] as const,
  ];
  return `${VDO_NINJA_BASE}?${toQueryString(all)}`;
}

/**
 * Director-room constants for host and editor iframes.
 * Replaces `room=` with `dir=` + `codirector=` for director-privilege
 * access, and adds `password` (required for codirector entry).
 */
const DIRECTOR_ROOM_PARAMS: Array<readonly [string, string | null]> = [
  ["dir", "GamifiedShow"],
  ["codirector", "gamifiedadmin"],
  ["password", "gaming"],
  ["hash", "1f71"],
];

/**
 * Host-specific viewing flags.
 *   q            → quality selector hidden
 *   tips         → tooltips disabled
 *   broadcast    → sees only director/producer stream
 *   showlist=0   → hides participant sidebar
 *   minipreview  → small self-view
 *   pausepreview → guest tiles paused by default in director controls
 */
const HOST_VIEW_PARAMS: Array<readonly [string, string | null]> = [
  ["q", null],
  ["tips", null],
  ["broadcast", null],
  ["showlist", "0"],
  ["minipreview", null],
  ["pausepreview", null],
];

/**
 * Editor-specific viewing flags.
 *   videodevice=0 → no camera prompt (audio-only publish)
 *   broadcast     → sees only director/producer stream
 *   showlist=0    → hides participant sidebar
 *   minipreview   → small self-view
 *   blind         → video tiles render but don't load by default
 */
const EDITOR_VIEW_PARAMS: Array<readonly [string, string | null]> = [
  ["videodevice", "0"],
  ["broadcast", null],
  ["showlist", "0"],
  ["minipreview", null],
  ["blind", null],
];

/**
 * Builds the iframe `src` for the host's wrapper.
 * The host gets codirector privileges (`dir=` + `codirector=`) and
 * publishes their camera (`push=`) so the producer's existing OBS
 * browser source for that push ID keeps working unchanged.
 * `broadcast` auto-targets the director stream — no hardcoded `view=`.
 */
export function buildHostIframeUrl(params: GuestIframeParams): string {
  const all = [
    ...DIRECTOR_ROOM_PARAMS,
    ...HOST_VIEW_PARAMS,
    ["push", params.push] as const,
    ["label", params.label] as const,
  ];
  return `${VDO_NINJA_BASE}?${toQueryString(all)}`;
}

/**
 * Builds the iframe `src` for the editor's wrapper.
 * Audio-only publish (`videodevice=0`), codirector privileges, and
 * `blind` so they manually un-blind only the producer's virtual cam.
 */
export function buildEditorIframeUrl(params: GuestIframeParams): string {
  const all = [
    ...DIRECTOR_ROOM_PARAMS,
    ...EDITOR_VIEW_PARAMS,
    ["push", params.push] as const,
    ["label", params.label] as const,
  ];
  return `${VDO_NINJA_BASE}?${toQueryString(all)}`;
}

/**
 * Builds the URL the OBS overlay browser source loads. Joins the room
 * as a data-only peer (no video/audio) and listens for our broadcasts.
 */
export function buildOverlayDataOnlyUrl(): string {
  return `${VDO_NINJA_BASE}?${toQueryString(OVERLAY_PARAMS)}`;
}

// ── Event payloads ──────────────────────────────────────────────────────

/** Source of an outgoing event — either a numbered guest seat or the host. */
export type EventSender =
  | { kind: "guest"; seat: SeatId; label: string }
  | { kind: "host"; label: string };

/** A guest tapped an emoji button. Renders a float over the sender's tile. */
export interface EmojiEvent {
  type: "emoji";
  from: EventSender;
  emoji: Emoji;
  /** Wall-clock timestamp the sender created the event (ms). */
  ts: number;
}

/** A guest played a card on another guest. */
export interface CardPlayEvent {
  type: "cardPlay";
  from: EventSender;
  cardId: CardId;
  /** Targeted guest's seat (host can never be targeted; see spec §3.1). */
  targetSeat: SeatId;
  targetLabel: string;
  ts: number;
}

/** Producer broadcast new roster names to all wrappers + the overlay. */
export interface RosterUpdateEvent {
  type: "rosterUpdate";
  /** Full map keyed by seat — every seat must be present. */
  names: Record<SeatId, string>;
  ts: number;
}

/**
 * Producer fired "Reset cards". Wrappers compare `resetEpoch` against
 * the highest one they've already seen (persisted) and clear their
 * per-card counters only when the incoming epoch is newer. That makes
 * resets idempotent and survives a wrapper refresh — the producer can
 * re-broadcast on demand and a stale wrapper picks it up correctly.
 */
export interface CardResetEvent {
  type: "cardReset";
  /** Monotonically increasing producer-side identifier (Date.now()). */
  resetEpoch: number;
  ts: number;
}

/**
 * Wrapper-on-mount sync request. The wrapper missed any broadcasts
 * fired before it joined the room, so it asks every other peer to
 * (re-)announce the current resetEpoch. Producer responds with a fresh
 * CardResetEvent carrying the latest epoch from its localStorage.
 */
export interface GetResetEpochEvent {
  type: "getResetEpoch";
  ts: number;
}

/** Producer pushed updated tile coordinates from calibration mode. */
export interface CalibrationEvent {
  type: "calibration";
  tiles: TileMap;
  ts: number;
}

/** Discriminated union of every payload the app sends over the channel. */
export type EventPayload =
  | EmojiEvent
  | CardPlayEvent
  | RosterUpdateEvent
  | CardResetEvent
  | GetResetEpochEvent
  | CalibrationEvent;

// ── Iframe data channel ─────────────────────────────────────────────────

/** Namespace key our payloads sit under so we don't collide with other apps. */
const NAMESPACE = "overlayNinja" as const;

interface OutboundMessage {
  sendData: { [NAMESPACE]: EventPayload };
  /** `pcs` = broadcast to all peer connections in the room. */
  type: "pcs";
}

/**
 * Sends a typed event payload through the VDO.Ninja iframe so it reaches
 * every other peer in the room over P2P data channels. No-op (with a
 * console warn) if the iframe isn't mounted yet.
 *
 * @example
 * sendData(iframeRef, { type: 'emoji', from: { ... }, emoji: '🔥', ts: Date.now() });
 */
export function sendData(
  iframeRef: RefObject<HTMLIFrameElement>,
  payload: EventPayload,
): void {
  const win = iframeRef.current?.contentWindow;
  if (!win) {
    console.warn("[vdoninja] sendData called before iframe mounted");
    return;
  }
  const msg: OutboundMessage = {
    sendData: { [NAMESPACE]: payload },
    type: "pcs",
  };
  if (import.meta.env.DEV) {
    console.log("[vdoninja] →", payload.type, payload);
  }
  win.postMessage(msg, "*");
}

/**
 * Subscribes to inbound `EventPayload`s arriving over the data channel
 * from other peers in the room. Returns an unsubscribe function the
 * caller must invoke on cleanup.
 *
 * Filters by namespace so unrelated VDO.Ninja iframe messages (chat,
 * volume changes, hand-raises, etc.) don't reach the callback.
 */
export function onData(
  iframeRef: RefObject<HTMLIFrameElement>,
  callback: (payload: EventPayload) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    // Guard: only accept messages from our iframe (window.parent === us).
    const expectedSource = iframeRef.current?.contentWindow;
    if (expectedSource && event.source !== expectedSource) return;

    const data = event.data as
      | { dataReceived?: { [NAMESPACE]?: EventPayload } }
      | undefined;
    const payload = data?.dataReceived?.[NAMESPACE];
    if (!payload || typeof payload !== "object") return;
    if (import.meta.env.DEV) {
      console.log("[vdoninja] ←", payload.type, payload);
    }
    callback(payload);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

// ── React hook ──────────────────────────────────────────────────────────

export interface UseVdoNinjaOptions {
  /** Optional listener for inbound events. Called for every namespaced payload. */
  onMessage?: (payload: EventPayload) => void;
}

export interface UseVdoNinjaResult {
  /** Attach to the iframe element rendered by the consuming component. */
  iframeRef: RefObject<HTMLIFrameElement>;
  /** Send a typed event over the room's data channel. */
  send: (payload: EventPayload) => void;
}

/**
 * React hook that wires up the inbound listener with auto-cleanup and
 * exposes a `send` helper bound to the iframe ref. The consuming
 * component renders the actual `<iframe ref={iframeRef} src={...} />`.
 *
 * Pin the callback in a ref so the window listener is registered exactly
 * ONCE for the component's lifetime. The previous shape resubscribed on
 * every callback identity change — and since callers commonly depend on
 * objects that get rebuilt each render (e.g. a derived `identity`), the
 * listener was effectively flapping on/off on every render. Inbound
 * broadcasts that arrived during the gap (or during React 18 StrictMode's
 * dev-only double-invoke) were silently dropped — manifesting as the
 * wrapper appearing to ignore producer cardReset events. The ref pattern
 * mirrors what `useVdoNinjaChat` already does for chat reception.
 */
export function useVdoNinja(opts: UseVdoNinjaOptions = {}): UseVdoNinjaResult {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { onMessage } = opts;
  const cbRef = useRef(onMessage);
  useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    return onData(iframeRef, (payload) => cbRef.current?.(payload));
  }, []);

  // Memoized so consuming components can list `send` in useEffect deps
  // without triggering churn on every render. iframeRef is stable.
  const send = useCallback(
    (payload: EventPayload) => sendData(iframeRef, payload),
    [],
  );

  return { iframeRef, send };
}
