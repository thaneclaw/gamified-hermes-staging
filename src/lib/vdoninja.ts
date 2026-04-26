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

import { useEffect, useRef, type RefObject } from "react";
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
 * Builds the iframe `src` for a guest's wrapper. Combines the room
 * constants with the per-guest variables. Does **not** add `view=` —
 * guests view the producer's composited Virtual Camera feed via OBS,
 * not each other directly.
 */
export function buildIframeUrl(params: GuestIframeParams): string {
  const all = [
    ...GUEST_ROOM_PARAMS,
    ["push", params.push] as const,
    ["label", params.label] as const,
  ];
  return `${VDO_NINJA_BASE}?${toQueryString(all)}`;
}

/**
 * Builds the iframe `src` for the host's wrapper. Identical to
 * {@link buildIframeUrl} but adds `view=TBSqrdw` so the host sees the
 * producer's composited feed (matching the host's existing URL today).
 */
export function buildHostIframeUrl(params: GuestIframeParams): string {
  const all = [
    ...GUEST_ROOM_PARAMS,
    ["push", params.push] as const,
    ["label", params.label] as const,
    ["view", PRODUCER_VIEW_ID] as const,
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

/** Producer fired "Reset cards" — wrappers zero counters and re-enable. */
export interface CardResetEvent {
  type: "cardReset";
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
 * The listener registers once per `onMessage` identity, so wrap callbacks
 * in `useCallback` if you want to avoid resubscribing on every render.
 */
export function useVdoNinja(opts: UseVdoNinjaOptions = {}): UseVdoNinjaResult {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { onMessage } = opts;

  useEffect(() => {
    if (!onMessage) return;
    return onData(iframeRef, onMessage);
  }, [onMessage]);

  return {
    iframeRef,
    send: (payload) => sendData(iframeRef, payload),
  };
}
