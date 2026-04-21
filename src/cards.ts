import { Hand, MessageSquarePlus, Swords, type LucideIcon } from "lucide-react";

export type CardKey = "interrupt" | "quickdebate" | "yesand";

export interface Card {
  name: string;
  short: string;
  icon: LucideIcon;
  color: string;
  maxUses: number;
  needsTarget: boolean;
  description: string;
  duration: number;
}

export const CARDS: Record<CardKey, Card> = {
  interrupt: {
    name: "SHUT THE !@#$ UP!!",
    short: "STFU",
    icon: Hand,
    color: "#ff2e6b",
    maxUses: 2,
    needsTarget: true,
    description: "Cut off the current speaker. Their feed dims, yours jumps.",
    duration: 2200,
  },
  quickdebate: {
    name: "QUICK DEBATE",
    short: "QD",
    icon: Swords,
    color: "#ffab00",
    maxUses: 1,
    needsTarget: true,
    description: "30-second rapid-fire back-and-forth with a chosen rival.",
    duration: 4000,
  },
  yesand: {
    name: "YES AND",
    short: "Y&A",
    icon: MessageSquarePlus,
    color: "#c239ff",
    maxUses: 1,
    needsTarget: false,
    description:
      "Go next and build on what the person before you just said.",
    duration: 2800,
  },
};
