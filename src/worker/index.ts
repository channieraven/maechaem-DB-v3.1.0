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
 * │  │              │    │  ├─ GET/POST/DELETE /api/growth-logs          │ │
 * │  │              │    │  ├─ GET/POST/DELETE /api/trees                │ │
 * │  │              │    │  ├─ GET/POST/PUT/DELETE /api/images           │ │
 * │  │              │    │  ├─ GET/POST/DELETE /api/spacing-logs         │ │
 * │  │              │    │  ├─ GET/POST/DELETE /api/comments             │ │
 * │  │              │    │  ├─ GET/PUT /api/notifications                │ │
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
import { growthLogsRouter } from "./routes/growth-logs";
import { treesRouter } from "./routes/trees";
import { imagesRouter } from "./routes/images";
import { spacingLogsRouter } from "./routes/spacing-logs";
import { commentsRouter } from "./routes/comments";
import { notificationsRouter } from "./routes/notifications";
import { usersRouter } from "./routes/users";
import { clerkAuthMiddleware } from "./middleware/clerk";
import { createClerkClient } from "@clerk/backend";
import type { Env } from "../db/db";

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Structured request logging (visible in `wrangler pages dev` console)
app.use("*", logger());

// CORS — allow both the Cloudflare Pages default domain and the production
// custom domain.  Same-origin requests (most production traffic) bypass CORS
// checks entirely, so listing the custom domain here also covers scenarios
// where the frontend is served from a subdomain or a separate origin.
app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:5173",
      "https://maechaem-gis.pages.dev",
      "https://maechaem-db-rfd.work",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Pretty-print JSON responses in development
app.use("/api/*", prettyJSON());

// ---------------------------------------------------------------------------
// Global error handler — ensures all unhandled errors return JSON, not HTML.
// This catches any exception that escapes a route handler's own try-catch.
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { ok: false, error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", status: 500 },
    500
  );
});

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
// Import and edit endpoints require authentication to track the editor.
app.use("/api/growth-logs/import", clerkAuthMiddleware());
app.use("/api/growth-logs/:logId{[^/]+}", async (c, next) => {
  if (c.req.method === "PUT") {
    return clerkAuthMiddleware()(c, next);
  }
  return next();
});
// Attach verified user's email as a context variable for downstream handlers.
app.use("/api/growth-logs/*", async (c, next) => {
  const userId = c.get("userId") as string | undefined;
  if (userId) {
    try {
      const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
      const user = await clerk.users.getUser(userId);
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ?? userId;
      c.set("userEmail", email);
    } catch {
      // Non-fatal — fall back to userId
      c.set("userEmail", userId);
    }
  }
  return next();
});
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
