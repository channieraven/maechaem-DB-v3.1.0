/**
 * worker/index.ts — Hono application entry point for Cloudflare Pages Functions.
 *
 * Architecture overview:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Cloudflare Pages                                                    │
 * │  ┌──────────────┐    ┌─────────────────────────────────────────────┐ │
 * │  │  dist/       │    │  _worker.js  (this file, bundled by Wrangler)│ │
 * │  │  (Vite SPA)  │    │  ├─ GET /api/plots          → Drizzle + Hyperdrive│ │
 * │  │              │    │  ├─ GET /api/plots/:id      → single plot detail │ │
 * │  │              │    │  ├─ GET /api/users           → list profiles (admin)│ │
 * │  │              │    │  ├─ PUT /api/users/:id/role  → sync role + claims  │ │
 * │  │              │    │  └─ *  (fallthrough)         → serve SPA           │ │
 * │  └──────────────┘    └─────────────────────────────────────────────┘ │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Why Hono instead of Next.js on Cloudflare?
 * - Hono is designed from the ground up for edge runtimes: zero Node.js APIs.
 * - No OpenNext adapter required — no mysterious build errors.
 * - Tiny footprint: ~12 KB gzipped vs. Next.js server bundle (>1 MB).
 * - First-class Cloudflare bindings support (Hyperdrive, KV, etc.).
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { plotsRouter } from "./routes/plots";
import { webhooksRouter } from "./routes/webhooks";
import { usersRouter } from "./routes/users";
import { clerkAuthMiddleware } from "./middleware/clerk";
import type { Env } from "../db/db";

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Structured request logging (visible in `wrangler pages dev` console)
app.use("*", logger());

// CORS — in production tighten the origin to your Pages domain.
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "https://maechaem-gis.pages.dev"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Pretty-print JSON responses in development
app.use("/api/*", prettyJSON());

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    data: {
      status: "healthy",
      environment: c.env.ENVIRONMENT ?? "unknown",
      timestamp: new Date().toISOString(),
    },
  })
);

// Public plot listing & detail (authentication optional — add clerkAuthMiddleware
// before the router if you want to restrict access)
app.route("/api/plots", plotsRouter);

// Clerk webhook — public, signature-verified internally by the handler.
app.route("/api/webhooks", webhooksRouter);

// ---------------------------------------------------------------------------
// Protected routes (require valid Clerk session)
// ---------------------------------------------------------------------------

app.use("/api/protected/*", clerkAuthMiddleware());

app.get("/api/protected/me", (c) => {
  const userId = c.get("userId");
  return c.json({ ok: true, data: { userId } });
});

// User management — migrated from v2.1.0 syncUserClaims Cloud Function.
// Requires a valid Clerk session; admin-only enforcement is done inside the router.
app.use("/api/users/*", clerkAuthMiddleware());
app.route("/api/users", usersRouter);

// ---------------------------------------------------------------------------
// SPA fallback — serve static assets for all non-API routes.
// In the Workers + Assets model the Worker intercepts every request, so we
// must explicitly delegate to the ASSETS binding for the compiled React app.
// ---------------------------------------------------------------------------

app.all("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// ---------------------------------------------------------------------------
// Export the Hono app as a Cloudflare Pages / Workers fetch handler.
// Cloudflare Pages expects the default export to have a `fetch` method.
// ---------------------------------------------------------------------------
export default app;
