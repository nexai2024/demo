import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Vite replacement for the CRA/craco setup:
// - "@" alias (was craco webpack alias + jsconfig paths)
// - /api dev proxy (was src/setupProxy.js)
// - build/ output dir (matches the directory the CRA build produced, so
//   existing Vercel/deploy settings keep working)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.BACKEND_PROXY_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "build",
  },
  test: {
    environment: "jsdom",
  },
});
