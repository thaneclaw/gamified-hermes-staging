/**
 * VDO.Ninja IFRAME chat plumbing.
 *
 * Chat rides VDO.Ninja's *built-in* chat infrastructure (server-relayed
 * websocket), NOT our `sendData` P2P data channel. We piggy-back on the
 * iframe's existing chat so the wrapper's chat panel is just an
 * alternate UI for the same conversation guests can already see via the
 * native in-iframe chat button (which we deliberately do not hide).
 *
 * Outbound: parent → iframe.
 *   { sendChat: <text> }
 *
 * Inbound: iframe → parent (whenever a chat message arrives in the room).
 *   event.data.action === 'incoming-chat'
 *     event.data.value = { msg, label, type, ts }
 * (VDO.Ninja's exact shape varies by build; we read defensively below.)
 *
 * Reference: https://docs.vdo.ninja/guides/iframe-api-documentation
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";

export interface ChatMessage {
  /** Stable id used as the React key for the message list. */
  id: string;
  /** Display name VDO.Ninja attached (the sender's `&label=`). */
  label: string;
  /** The message text — already plain (no HTML) per VDO.Ninja's chat API. */
  msg: string;
  /** Wall-clock timestamp the wrapper saw the message (ms). */
  ts: number;
  /**
   * `local` = sent by this wrapper via `sendChat`. We optimistically
   * append local sends to the panel without waiting for an echo, since
   * VDO.Ninja's iframe doesn't reliably reflect our own messages.
   */
  source: "local" | "remote";
}

/**
 * Sends a chat message via the VDO.Ninja iframe. Returns true if the
 * iframe is mounted and the message was posted; false otherwise so
 * callers can decide whether to surface an error.
 */
export function sendChat(
  iframeRef: RefObject<HTMLIFrameElement>,
  text: string,
): boolean {
  const win = iframeRef.current?.contentWindow;
  if (!win) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  win.postMessage({ sendChat: trimmed }, "*");
  return true;
}

/**
 * Subscribes to inbound chat events from the VDO.Ninja iframe. Returns
 * an unsubscribe function for use in useEffect cleanup.
 *
 * VDO.Ninja's iframe emits chat under a couple of shapes depending on
 * build (`incoming-chat` action, or a top-level `chat` field). We read
 * defensively and ignore everything that doesn't look like chat.
 */
export function onChat(
  iframeRef: RefObject<HTMLIFrameElement>,
  callback: (msg: Omit<ChatMessage, "id" | "source">) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    const expectedSource = iframeRef.current?.contentWindow;
    if (expectedSource && event.source !== expectedSource) return;
    const data = event.data as Record<string, unknown> | null | undefined;
    if (!data || typeof data !== "object") return;

    // Shape A: { action: 'incoming-chat', value: { msg, label, ts? } }
    if (data["action"] === "incoming-chat") {
      const value = data["value"] as Record<string, unknown> | undefined;
      const msg = typeof value?.["msg"] === "string" ? (value["msg"] as string) : null;
      const label = typeof value?.["label"] === "string" ? (value["label"] as string) : "";
      if (msg) {
        callback({ msg, label: label || "?", ts: Date.now() });
      }
      return;
    }

    // Shape B: top-level `chat` field on the message itself
    const chat = data["chat"];
    if (chat && typeof chat === "object") {
      const c = chat as Record<string, unknown>;
      const msg = typeof c["msg"] === "string" ? (c["msg"] as string) : null;
      const label = typeof c["label"] === "string" ? (c["label"] as string) : "";
      if (msg) {
        callback({ msg, label: label || "?", ts: Date.now() });
      }
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/**
 * React hook that wires inbound chat reception with auto-cleanup.
 * The consuming component renders the iframe element + ref itself
 * (PlayRoute already owns `iframeRef` from {@link useVdoNinja}).
 */
export function useVdoNinjaChat(
  iframeRef: RefObject<HTMLIFrameElement>,
  onMessage: (msg: Omit<ChatMessage, "id" | "source">) => void,
): { send: (text: string) => boolean } {
  // Pin the latest callback in a ref so the listener doesn't churn on
  // every parent render of the component that owns it.
  const cbRef = useRef(onMessage);
  useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    return onChat(iframeRef, (msg) => cbRef.current(msg));
  }, [iframeRef]);

  return {
    send: useCallback((text: string) => sendChat(iframeRef, text), [iframeRef]),
  };
}
