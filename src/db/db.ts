/**
 * db.ts — Drizzle ORM database connection.
 *
 * Dual-mode connection strategy:
 * ┌────────────────┬────────────────────────────────────────────────────────┐
 * │  Environment   │  Connection                                            │
 * ├────────────────┼────────────────────────────────────────────────────────┤
 * │  Local dev     │  Direct Neon PostgreSQL URL from DATABASE_URL env var  │
 * │  Production    │  Cloudflare Hyperdrive binding (HYPERDRIVE.connectionString) │
 * └────────────────┴────────────────────────────────────────────────────────┘
 *
 * Hyperdrive transparently provides:
 *  - Connection pooling (no cold-start penalty)
 *  - Regional caching for read queries
 *  - Automatic TLS termination at the edge
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type { Plot, NewPlot, SpeciesObservation, CarbonEstimate } from "./schema";

/**
 * Cloudflare environment bindings.
 * Extend this interface as you add more bindings in wrangler.json.
 */
export interface Env {
  /** Cloudflare Hyperdrive binding — available in production Workers/Pages. */
  HYPERDRIVE: Hyperdrive;
  /** R2 bucket for Cloud-Optimized GeoTIFF (COG) raster tiles. */
  R2_BUCKET: R2Bucket;
  /**
   * Static assets binding — serves the compiled Vite SPA from the `dist/`
   * directory.  Exposed by setting `assets.binding = "ASSETS"` in wrangler.json.
   */
  ASSETS: Fetcher;
  /**
   * Clerk publishable key — safe to expose in the browser, set as a Pages
   * environment variable.
   */
  CLERK_PUBLISHABLE_KEY: string;
  /**
   * Clerk secret key — server-side only, set as a Pages secret.
   */
  CLERK_SECRET_KEY: string;
  /**
   * Clerk webhook signing secret — from the Clerk Dashboard (Webhooks → Signing Secret).
   * Used to verify incoming webhook payloads from Clerk.
   */
  CLERK_WEBHOOK_SECRET?: string;
  /**
   * Direct Neon PostgreSQL connection URL.
   * Used for local development (`npm run dev`) and Drizzle migrations.
   * In production this is **not** needed — Hyperdrive provides the URL.
   */
  DATABASE_URL?: string;
  ENVIRONMENT?: string;
}

/**
 * Build a Drizzle database instance from the Cloudflare execution context.
 *
 * @param env  - The Cloudflare Env bindings object passed to the fetch handler.
 * @returns      Drizzle ORM instance with full schema typing.
 *
 * @example
 * ```ts
 * // Inside a Hono route handler:
 * app.get("/api/plots", async (c) => {
 *   const db = createDb(c.env);
 *   const plots = await db.select().from(schema.plots);
 *   return c.json(plots);
 * });
 * ```
 */
export function createDb(env: Env) {
  // Prefer Hyperdrive in production; fall back to direct URL locally.
  const connectionString =
    env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "No database connection available. " +
        "Set DATABASE_URL for local development or configure a Hyperdrive binding."
    );
  }

  // `postgres` (postgres-js) is the recommended driver for both
  // Hyperdrive and direct Neon connections.
  // - max: 1  → important for serverless/edge: never hold multiple connections
  //             per worker invocation; Hyperdrive handles pooling externally.
  // - prepare: false → required for Neon/PgBouncer compatibility; Hyperdrive
  //                    also benefits from this on short-lived edge requests.
  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
