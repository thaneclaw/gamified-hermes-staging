import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Socket.IO server (see server/index.ts) listens on :3101 by default.
// We proxy /socket.io (HTTP + WebSocket upgrade) through Vite so the browser
// can connect to the app's own origin and stay CORS-free in production too.
const SERVER_PORT = Number(process.env.SERVER_PORT ?? 3101);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/socket.io": {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
