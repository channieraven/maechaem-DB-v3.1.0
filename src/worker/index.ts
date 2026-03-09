/**
 * worker/index.ts — Hono application entry point for Cloudflare Pages Functions.
 *
 * Architecture overview:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Cloudflare Pages                                                    │
 * │  ┌──────────────┐    ┌─────────────────────────────────────────────┐ │
 * │  │  dist/       │    │  _worker.js  (this file, bundled by Wrangler)│ │
 * │  │  (Vite SPA)  │    │  ├─ GET /api/plots      → Drizzle + Hyperdrive│ │
 * │  │              │    │  ├─ GET /api/plots/:id   → single plot detail │ │
 * │  │              │    │  └─ *  (fallthrough)    → serve SPA           │ │
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
import { growthLogsRouter } from "./routes/growth-logs";
import { treesRouter } from "./routes/trees";
import { imagesRouter } from "./routes/images";
import { spacingLogsRouter } from "./routes/spacing-logs";
import { commentsRouter } from "./routes/comments";
import { notificationsRouter } from "./routes/notifications";
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
// Data routes — migrated from v1.0.1 Google Apps Script functions
// ---------------------------------------------------------------------------

// Growth log measurements (growth_logs + growth_logs_supp sheets)
app.route("/api/growth-logs", growthLogsRouter);

// Tree profiles / coordinate data (trees_profile sheet)
app.route("/api/trees", treesRouter);

// Plot images (plot_images sheet)
app.route("/api/images", imagesRouter);

// Inter-tree spacing surveys (spacing_logs sheet)
app.route("/api/spacing-logs", spacingLogsRouter);

// Comments on growth log entries (comments sheet)
app.route("/api/comments", commentsRouter);

// In-app notifications (notifications sheet)
app.route("/api/notifications", notificationsRouter);

// User profile management (users sheet — login/register handled by Clerk)
app.route("/api/users", usersRouter);

// ---------------------------------------------------------------------------
// Protected routes (require valid Clerk session)
// ---------------------------------------------------------------------------

// Example of a protected route — extend as needed.
app.use("/api/protected/*", clerkAuthMiddleware());

app.get("/api/protected/me", (c) => {
  const userId = c.get("userId");
  return c.json({ ok: true, data: { userId } });
});

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
