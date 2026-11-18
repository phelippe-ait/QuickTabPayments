import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Keep vendor code in dedicated, long-lived chunks. Stripe is only
        // reached from checkout (lazy), so it is never part of the menu load.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@stripe/")) return "stripe";
          if (id.includes("@supabase/")) return "supabase";
          if (id.includes("@tanstack/")) return "query";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router/") ||
            id.includes("/scheduler/")
          ) {
            return "react";
          }
        },
      },
    },
  },
});
