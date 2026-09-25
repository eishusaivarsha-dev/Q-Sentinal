import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      output: {
        // Big libraries in their own cacheable files; pages are split by React.lazy in App.tsx.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "zustand"],
          three: ["three"],
          charts: ["recharts"],
        },
      },
    },
  },
});
