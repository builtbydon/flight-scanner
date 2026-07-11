/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const hashFrontendSource = () => {
  const root = join(process.cwd(), "src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        walk(path);
      } else if (/\.(css|ts|tsx)$/.test(entry)) {
        files.push(path);
      }
    }
  };
  walk(root);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(process.cwd(), file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
};

// During local dev, proxy the API to the FastAPI backend on :8000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep the normal Docker/Tailscale app at `/`, while allowing the static
  // BuiltByDon deployment to be built under `/flight-scanner/`.
  base: process.env.VITE_BASE_PATH || "/",
  define: {
    __FS_SOURCE_HASH__: JSON.stringify(hashFrontendSource()),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // The primary experience is a 3D globe, so Three.js stays intentionally
    // heavy. Split stable vendor groups and accept the WebGL chunk budget.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) {
            return "vendor-three";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Vitest owns src/ component tests; Playwright owns tests/ (e2e) — keep apart.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
