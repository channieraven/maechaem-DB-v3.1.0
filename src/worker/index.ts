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
 * │  │              │    │  ├─ GET /api/r2/tiles/*  → R2 COG proxy       │ │
 * │  │              │    │  └─ *  (fallthrough)    → serve SPA           │ │
 * │  └──────────────┘    └─────────────────────────────────────────────┘ │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Why Hono instead of Next.js on Cloudflare?
 * - Hono is designed from the ground up for edge runtimes: zero Node.js APIs.
 * - No OpenNext adapter required — no mysterious build errors.
 * - Tiny footprint: ~12 KB gzipped vs. Next.js server bundle (>1 MB).
 * - First-class Cloudflare bindings support (Hyperdrive, R2, KV, etc.).
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { plotsRouter } from "./routes/plots";
import { webhooksRouter } from "./routes/webhooks";
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

// Example of a protected route — extend as needed.
app.use("/api/protected/*", clerkAuthMiddleware());

app.get("/api/protected/me", (c) => {
  const userId = c.get("userId");
  return c.json({ ok: true, data: { userId } });
});

// ---------------------------------------------------------------------------
// R2 COG tile proxy
// Streams Cloud-Optimized GeoTIFF tiles from R2 to the client.
// MapLibre GL JS requests tiles via HTTP range requests — this endpoint
// transparently forwards the Range header to R2.
// ---------------------------------------------------------------------------

app.get("/api/r2/tiles/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const rangeHeader = c.req.header("Range");

  let object: R2ObjectBody | null;
  // Track the parsed range so we can build the Content-Range response header.
  let parsedRange: R2Range | undefined;

  if (rangeHeader) {
    // Parse "bytes=start-end" from the Range header and pass explicit
    // byte offsets to R2 so it returns a proper 206 Partial Content response.
    parsedRange = parseRangeHeader(rangeHeader);
    if (parsedRange) {
      object = await c.env.R2_BUCKET.get(key, { range: parsedRange });
    } else {
      // Malformed Range header — fall back to a full object fetch.
      object = await c.env.R2_BUCKET.get(key);
    }
  } else {
    object = await c.env.R2_BUCKET.get(key);
  }

  if (!object) {
    return c.json({ ok: false, error: "Tile not found", status: 404 }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
  // CORS for MapLibre tile requests
  headers.set("Access-Control-Allow-Origin", "*");
  // Tell clients that this endpoint accepts byte-range requests (required by
  // GeoTIFF.js / maplibre-cog-protocol to know it can make range requests).
  headers.set("Accept-Ranges", "bytes");

  let status = 200;
  if (parsedRange) {
    status = 206;
    // GeoTIFF.js reads the Content-Range header to determine the total file
    // size, which is essential for parsing the COG header at the end of the
    // file.  Without this header geotiff.js cannot seek correctly and throws
    // "AggregateError: Request failed".
    const total = object.size;
    const start = parsedRange.offset;
    const end =
      parsedRange.length !== undefined
        ? parsedRange.offset + parsedRange.length - 1
        : total - 1;
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  }

  return new Response(object.body, { headers, status });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses an HTTP Range header of the form "bytes=start-end" or "bytes=start-"
 * and returns an R2 range object suitable for `R2Bucket.get(key, { range })`.
 */
function parseRangeHeader(
  rangeHeader: string
): R2Range | undefined {
  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return undefined;

  const offset = parseInt(match[1]!, 10);
  const endStr = match[2];
  const length = endStr ? parseInt(endStr, 10) - offset + 1 : undefined;

  return length !== undefined ? { offset, length } : { offset };
}

// ---------------------------------------------------------------------------
// Export the Hono app as a Cloudflare Pages / Workers fetch handler.
// Cloudflare Pages expects the default export to have a `fetch` method.
// ---------------------------------------------------------------------------
export default app;
