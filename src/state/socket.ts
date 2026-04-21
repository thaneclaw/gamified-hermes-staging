import { io, type Socket } from "socket.io-client";

// Connects to the app's own origin. In dev, Vite proxies /socket.io to the
// Socket.IO server (see vite.config.ts). In prod, the server serves both
// the app and the websocket on one origin so no extra configuration is
// needed.
export const socket: Socket = io({
  autoConnect: true,
  transports: ["websocket", "polling"],
});
