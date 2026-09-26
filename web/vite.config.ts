import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // 5173 is in the backend's default CORS allow-list (qsentinel/api/main.py).
  server: { port: 5173, host: true },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Big libraries in their own cacheable files; pages are split by React.lazy in App.tsx.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "zustand"],
          three: ["three"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
