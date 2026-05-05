import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/matches": "http://localhost:3001",
      "/streams": "http://localhost:3001",
      "/assign": "http://localhost:3001",
      "/unassign": "http://localhost:3001",
      "/start": "http://localhost:3001",
      "/updateScoreLocal": "http://localhost:3001",
      "/saveResult": "http://localhost:3001",
      "/submitFinal": "http://localhost:3001",
      "/refresh": "http://localhost:3001",
      "/config": "http://localhost:3001",
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
