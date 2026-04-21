import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CardKey } from "./constants.ts";
import type { Contestant, Layout, Round } from "./types.ts";

// Producer-authored config that survives server restarts. Transient show
// state (buzzer, positions, votes, reactions, active effect, round phases,
// card usage) is never persisted — it only makes sense within a live show
// and would otherwise leak into the next session.
// version 1: rounds + contestants only.
// version 2: adds optional `layout`.
// version 3: adds optional `cardMaxes` (per-card per-player allotment)
//            and `timerDurationMs` (countdown-clock preset). Both are
//            host/producer-tuned values that should survive restarts so
//            the show starts up with whatever was last configured.
export interface PersistedSettings {
  version: 1 | 2 | 3;
  rounds: Round[];
  contestants: Contestant[];
  layout?: Layout;
  cardMaxes?: Record<CardKey, number>;
  timerDurationMs?: number;
}

// Production deploys (Fly.io, Docker, …) point DATA_DIR at a mounted
// persistent volume — typically /data — so rundown/roster/layout survive
// restarts and redeploys. Dev leaves it unset and falls back to `.data/`
// alongside the repo, which is gitignored.
const DATA_DIR = process.env.DATA_DIR ?? ".data";
const FILE = `${DATA_DIR}/settings.json`;
const LAYOUT_FILE = `${DATA_DIR}/layout.json`;
const DEBOUNCE_MS = 400;

let saveTimer: NodeJS.Timeout | null = null;
let pending: PersistedSettings | null = null;
let layoutSaveTimer: NodeJS.Timeout | null = null;
let pendingLayout: PersistedLayout | null = null;

// Layout lives in its own file so it survives a full "reset all". The
// settings file can be wiped / re-seeded independently.
export interface PersistedLayout {
  version: 1;
  layout: Layout;
}

export async function loadSettings(): Promise<PersistedSettings | null> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedSettings;
    // Version 1 didn't include layout; accept and let the server fall back
    // to DEFAULT_LAYOUT. Versions newer than the server knows about get
    // ignored defensively.
    if (
      parsed?.version !== 1 &&
      parsed?.version !== 2 &&
      parsed?.version !== 3
    ) {
      console.warn("[persist] ignoring unknown settings version", parsed?.version);
      return null;
    }
    return parsed;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    console.error("[persist] failed to load settings:", err);
    return null;
  }
}

export function scheduleSave(settings: PersistedSettings): void {
  pending = settings;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = pending;
    pending = null;
    if (!snapshot) return;
    void writeAtomic(snapshot);
  }, DEBOUNCE_MS);
}

export async function clearSettings(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    pending = null;
  }
  try {
    await unlink(FILE);
  } catch (err: unknown) {
    if (!isNotFound(err)) console.error("[persist] failed to clear settings:", err);
  }
}

async function writeAtomic(settings: PersistedSettings): Promise<void> {
  try {
    await mkdir(dirname(FILE), { recursive: true });
    const tmp = FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(settings, null, 2), "utf8");
    await rename(tmp, FILE);
  } catch (err) {
    console.error("[persist] failed to save settings:", err);
  }
}

// ── Layout — separate file so it outlives "reset all" ──────────────────

export async function loadLayout(): Promise<Layout | null> {
  try {
    const raw = await readFile(LAYOUT_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedLayout;
    if (parsed?.version !== 1) {
      console.warn("[persist] ignoring unknown layout version", parsed?.version);
      return null;
    }
    return parsed.layout;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    console.error("[persist] failed to load layout:", err);
    return null;
  }
}

export function scheduleLayoutSave(layout: Layout): void {
  pendingLayout = { version: 1, layout };
  if (layoutSaveTimer) return;
  layoutSaveTimer = setTimeout(() => {
    layoutSaveTimer = null;
    const snap = pendingLayout;
    pendingLayout = null;
    if (!snap) return;
    void writeLayoutAtomic(snap);
  }, DEBOUNCE_MS);
}

async function writeLayoutAtomic(data: PersistedLayout): Promise<void> {
  try {
    await mkdir(dirname(LAYOUT_FILE), { recursive: true });
    const tmp = LAYOUT_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, LAYOUT_FILE);
  } catch (err) {
    console.error("[persist] failed to save layout:", err);
  }
}

// Deliberately no clearLayout export — a full reset shouldn't touch the
// layout file. Use the editor's "reset" button (wired to layoutReset on
// the store), which writes DEFAULT_LAYOUT over the file.

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  );
}
