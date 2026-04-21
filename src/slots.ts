export type SlotKey = "L1" | "L2" | "L3" | "R1" | "R2" | "R3" | "CENTER";

export type ContestantSlotKey = Exclude<SlotKey, "CENTER">;

export interface SlotRect {
  left: string;
  top: string;
  width: string;
  height: string;
}

// Black video rectangles on the studio backdrop — where VDO Ninja feeds show.
export const SLOTS: Record<SlotKey, SlotRect> = {
  L1: { left: "5.3%", top: "5.7%", width: "14.4%", height: "25.0%" },
  L2: { left: "5.3%", top: "36.2%", width: "14.4%", height: "24.8%" },
  L3: { left: "5.3%", top: "66.7%", width: "14.4%", height: "24.8%" },
  R1: { left: "80.4%", top: "5.7%", width: "14.5%", height: "25.0%" },
  R2: { left: "80.6%", top: "36.2%", width: "14.3%", height: "24.9%" },
  R3: { left: "80.5%", top: "66.7%", width: "14.4%", height: "24.9%" },
  CENTER: { left: "27.8%", top: "14.3%", width: "44.6%", height: "44.3%" },
};

// Nameplate + topic bar positions used to live here as static constants.
// They're now computed at render time from the producer-editable Layout
// in state. See computeLayoutRects() below.

export const BACKDROP_SRC = "/backdrop.jpg";

export const EMOJIS = ["🔥", "💀", "😂", "🤯", "👀", "🎯", "❓", "💯"];

// Given a Layout (producer-editable), produce the concrete rects the
// overlay renders. Kept here so slot/placard/topic math lives in one
// place; OverlayPreview + RLGLCenterTile both consume the result.
import type { Layout } from "./state/types";

const pct = (n: number) => `${n}%`;

export interface LayoutRects {
  slots: Record<SlotKey, SlotRect>;
  placards: Record<ContestantSlotKey, SlotRect>;
  topicBar: SlotRect;
}

export function computeLayoutRects(layout: Layout): LayoutRects {
  const { tileWidth, tileHeight, columnLeftL, columnLeftR, rowTops } = layout;
  // Fall back to 1.0 so layouts persisted before tileScale was added still
  // render correctly after load.
  const scale = layout.tileScale ?? 1;

  // Scaled tile dimensions. The anchor column/row values still mark the
  // *unscaled* top-left, so to grow each tile in place we shift its
  // top-left by half of the scale delta — result: the tile's centre
  // stays pinned to `columnLeft + tileWidth/2, rowTop + tileHeight/2`.
  const scaledW = tileWidth * scale;
  const scaledH = tileHeight * scale;
  const shiftX = (scaledW - tileWidth) / 2;
  const shiftY = (scaledH - tileHeight) / 2;

  const slot = (unscaledLeft: number, unscaledTop: number): SlotRect => ({
    left: pct(unscaledLeft - shiftX),
    top: pct(unscaledTop - shiftY),
    width: pct(scaledW),
    height: pct(scaledH),
  });

  // Placards sit relative to the scaled tile's bottom edge so they track
  // the growing/shrinking tile. Width + height stay as configured.
  const placardLeft = (columnLeft: number) =>
    columnLeft + (tileWidth - layout.placardWidth) / 2;
  const placardTop = (rowIdx: number) =>
    rowTops[rowIdx]! - shiftY + scaledH + layout.placardTopOffset;

  const placard = (left: number, top: number): SlotRect => ({
    left: pct(left),
    top: pct(top),
    width: pct(layout.placardWidth),
    height: pct(layout.placardHeight),
  });

  return {
    slots: {
      L1: slot(columnLeftL, rowTops[0]),
      L2: slot(columnLeftL, rowTops[1]),
      L3: slot(columnLeftL, rowTops[2]),
      R1: slot(columnLeftR, rowTops[0]),
      R2: slot(columnLeftR, rowTops[1]),
      R3: slot(columnLeftR, rowTops[2]),
      CENTER: {
        left: pct(layout.centerSlot.left),
        top: pct(layout.centerSlot.top),
        width: pct(layout.centerSlot.width),
        height: pct(layout.centerSlot.height),
      },
    },
    placards: {
      L1: placard(placardLeft(columnLeftL), placardTop(0)),
      L2: placard(placardLeft(columnLeftL), placardTop(1)),
      L3: placard(placardLeft(columnLeftL), placardTop(2)),
      R1: placard(placardLeft(columnLeftR), placardTop(0)),
      R2: placard(placardLeft(columnLeftR), placardTop(1)),
      R3: placard(placardLeft(columnLeftR), placardTop(2)),
    },
    topicBar: {
      left: pct(layout.topicBar.left),
      top: pct(layout.topicBar.top),
      width: pct(layout.topicBar.width),
      height: pct(layout.topicBar.height),
    },
  };
}
