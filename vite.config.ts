import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite configuration for Cloudflare Pages + Hono worker.
 *
 * Build strategy:
 *  - The React SPA (client) is compiled to `dist/` as a standard Vite build.
 *  - The Hono worker (server) is compiled to `dist/_worker.js` by Wrangler,
 *    which Cloudflare Pages automatically picks up as the Functions entrypoint.
 *
 * Why no @cloudflare/vite-plugin here?
 *  Cloudflare's official Vite plugin is designed for Workers, not Pages Functions.
 *  For Pages, the recommended pattern is to build the client with Vite and let
 *  Wrangler bundle the worker separately via `wrangler pages dev` / `wrangler pages deploy`.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    // Output directory matches `pages_build_output_dir` in wrangler.json
    outDir: "dist",
    // Generate source maps for debugging
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching on Cloudflare's edge CDN
        manualChunks: {
          react: ["react", "react-dom"],
          maplibre: ["maplibre-gl"],
        },
      },
    },
  },

  // Optimise deps for browser
  optimizeDeps: {
    include: ["react", "react-dom", "maplibre-gl"],
  },
});
