import { createServer } from "node:http";
import { Server } from "socket.io";
import { actions, getSnapshot, initState, subscribe } from "./state.ts";

// Port is configurable; Vite's dev-server proxy targets this value via
// vite.config.ts so the browser can connect to /socket.io on the app's
// origin and have the WS upgrade forwarded here.
const PORT = Number(process.env.PORT ?? 3101);

const httpServer = createServer((_req, res) => {
  // Plain HTTP health check — no static serving in this dev-focused
  // server. Vite serves the client during development.
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("game-show server ok\n");
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
