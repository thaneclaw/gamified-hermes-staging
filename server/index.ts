import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Server } from "socket.io";
import { actions, getSnapshot, initState, subscribe } from "./state.ts";

// Port is configurable; Vite's dev-server proxy targets this value via
// vite.config.ts so the browser can connect to /socket.io on the app's
// origin and have the WS upgrade forwarded here. In production (Fly.io,
// Docker, …) the same process serves both the static client bundle and
// Socket.IO on PORT, so the browser connects to window.location.origin
// with no extra config.
const PORT = Number(process.env.PORT ?? 3101);

// When SERVE_STATIC is set, the HTTP handler also serves the Vite build
// output out of ./dist. In dev this stays off and Vite runs the client
// on :5173 with a /socket.io proxy to this server. The Dockerfile flips
// it on; anything running `npm run dev:server` stays in pure-API mode.
const SERVE_STATIC = process.env.SERVE_STATIC === "1";
const DIST_DIR = resolve(process.cwd(), "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Resolve a request path to a file inside DIST_DIR, falling back to
// index.html so client-side routes (/producer, /host, /overlay, …)
// render the SPA shell. Paths that would escape DIST_DIR are rejected
// so a crafted URL can't read arbitrary files off the container.
async function resolveStatic(urlPath: string): Promise<string | null> {
  const clean = urlPath.split("?")[0]!.split("#")[0]!;
  const safe = normalize(clean).replace(/^(\.\.[\/\\])+/, "");
  const candidate = join(DIST_DIR, safe);
  if (!candidate.startsWith(DIST_DIR)) return null;
  try {
    const s = await stat(candidate);
    if (s.isFile()) return candidate;
    if (s.isDirectory()) {
      const idx = join(candidate, "index.html");
      const si = await stat(idx);
      if (si.isFile()) return idx;
    }
  } catch {
    // fall through to SPA index.html
  }
  return join(DIST_DIR, "index.html");
}

const httpServer = createServer(async (req, res) => {
  const url = req.url ?? "/";
  // Lightweight liveness/readiness probe for Fly.io's health checks.
  // Also handy for curling the app to confirm the server is up.
  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  if (!SERVE_STATIC) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("game-show server ok\n");
    return;
  }
  const file = await resolveStatic(url);
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
    return;
  }
  const ext = extname(file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  // Hashed asset files under /assets/ get aggressive caching; index.html
  // (and anything else) stays no-cache so a redeploy takes effect on
  // next load without clients holding a stale shell.
  const immutable =
    url.startsWith("/assets/") && ext !== ".html" ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { "content-type": type, "cache-control": immutable });
  createReadStream(file).pipe(res);
});

const io = new Server(httpServer, {
  cors: {
    // Dev-friendly: allow any origin. Tighten once a production domain
    // is known.
    origin: true,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  // Seed this client with the current snapshot immediately so they can
  // render without waiting for an action to fire.
  socket.emit("state", getSnapshot());

  // ── Wire every action event to its handler. Names mirror the Zustand
  // action names on the client, using `:` as the namespace separator
  // (see the Phase 2 handoff doc).
  socket.on("round:trigger", (p: { id: string; skipIntro?: boolean }) =>
    actions.roundTrigger(p?.id, { skipIntro: p?.skipIntro === true }),
  );
  socket.on("round:intro-replay", (p?: { id?: string }) =>
    actions.roundIntroReplay(p?.id),
  );
  socket.on("round:close", () => actions.roundClose());
  socket.on("round:add", () => actions.roundAdd());
  socket.on("round:update", (p) => actions.roundUpdate(p.id, p.patch));
  socket.on("round:delete", (p: { id: string }) => actions.roundDelete(p.id));
  socket.on("round:move", (p: { id: string; dir: -1 | 1 }) =>
    actions.roundMove(p.id, p.dir),
  );
  socket.on("rounds:reset", () => actions.roundsResetStatuses());
  socket.on("rundown:clear", () => actions.rundownClear());

  socket.on("buzz", (p: { contestantId: string }) =>
    actions.buzz(p.contestantId),
  );
  socket.on("buzzer:reset", () => actions.buzzerReset());

  socket.on("position:take", (p) =>
    actions.positionTake(p.contestantId, p.color),
  );
  socket.on("positions:reset", () => actions.positionsReset());
  socket.on("debate:toggle", () => actions.debateToggle());

  socket.on("typedbuzz:submit", (p) =>
    actions.submitTypedBuzz(p.contestantId, p.text),
  );
  socket.on("vote:cast", (p) => actions.castVote(p.contestantId, p.optionKey));
  socket.on("sentiment:submit", (p: { contestantId: string; score: number }) =>
    actions.submitSentimentScore(p.contestantId, p.score),
  );
  socket.on("biggerdeal:submit", (p: { contestantId: string; choiceIndex: number }) =>
    actions.submitBiggerDeal(p.contestantId, p.choiceIndex),
  );
  // WHAT'S THE PLAY: either a preset index pick or a freeform answer.
  // Wire-level union so the client can send either shape; server
  // resolves which branch to take based on which field is present.
  socket.on(
    "play:submit",
    (p: { contestantId: string; choiceIndex?: number; freeform?: string }) =>
      actions.submitPlay(p.contestantId, {
        choiceIndex: p.choiceIndex,
        freeform: p.freeform,
      }),
  );
  socket.on("answer:submit", (p) =>
    actions.submitHiddenAnswer(p.contestantId, p.text),
  );
  socket.on("answer:reveal", (p: { contestantId: string }) =>
    actions.revealAnswer(p.contestantId),
  );
  socket.on("answer:hide", (p: { contestantId: string }) =>
    actions.hostHideAnswer(p.contestantId),
  );
  socket.on("mvp:submit", (p: { contestantId: string; targetId: string }) =>
    actions.submitMvpPick(p.contestantId, p.targetId),
  );

  socket.on("reaction:send", (p) =>
    actions.reactionSend(p.contestantId, p.emoji),
  );

  socket.on("card:try", (p) => actions.cardTryPlay(p.byId, p.cardKey));
  socket.on("card:fire", (p) =>
    actions.cardFire(p.byId, p.cardKey, p.targetId ?? null),
  );
  socket.on("card:cancel", () => actions.cancelTarget());

  socket.on("contestant:rename", (p) =>
    actions.contestantRename(p.id, p.name),
  );

  socket.on("spotlight:set", (p: { id: string | null }) =>
    actions.spotlightSet(p?.id ?? null),
  );
  socket.on("timer:duration-set", (p: { ms: number }) =>
    actions.timerDurationSet(p?.ms ?? 30_000),
  );
  socket.on("timer:start", () => actions.timerStart());
  socket.on("timer:stop", () => actions.timerStop());

  socket.on("chat:send", (p) => actions.chatSend(p));

  socket.on("layout:update", (p) => actions.layoutUpdate(p));
  socket.on("layout:reset", () => actions.layoutReset());

  socket.on("show:restart", () => actions.showRestart());
  socket.on("reset:all", () => actions.resetAll());

  socket.on("cards:set-max", (p: { cardKey: string; max: number }) => {
    // Narrow the wire payload to a known CardKey before calling into the
    // typed action. Unknown keys are dropped on the server side too, but
    // validating here gives us a cleaner no-op signal.
    const key = p?.cardKey as "interrupt" | "quickdebate" | "yesand";
    if (key !== "interrupt" && key !== "quickdebate" && key !== "yesand") return;
    actions.cardMaxSet(key, p.max);
  });

  socket.on("mvp:winner-reveal", () => actions.mvpWinnerReveal());
  socket.on("mvp:winner-hide", () => actions.mvpWinnerHide());
});

// Broadcast every server-side state change to all connected clients.
subscribe((snapshot) => {
  io.emit("state", snapshot);
});

// Restore producer-authored settings from disk first so the seed snapshot
// sent to the first connecting client is the persisted one. Only then do
// we start accepting connections.
initState()
  .catch((err) => {
    console.error("[server] failed to restore settings; starting with seed:", err);
  })
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`[server] game-show socket.io server on :${PORT}`);
    });
  });
