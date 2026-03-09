/**
 * db.ts — Drizzle ORM database connection for Cloudflare D1.
 *
 * Uses Cloudflare D1 (SQLite) as the database backend — fully native to
 * Cloudflare Workers, no external database required.
 *
 * D1 is available as a binding named `DB` in wrangler.json.
 * In local development (`wrangler dev`), Wrangler automatically creates a
 * local SQLite file that mirrors the D1 API.
 *
 * Migrations are stored in `./drizzle/migrations/` and can be applied with:
 *   wrangler d1 execute maechaem-db --local --file=drizzle/migrations/0000_d1_schema.sql
 *   wrangler d1 execute maechaem-db --file=drizzle/migrations/0000_d1_schema.sql
 */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type {
  Plot,
  NewPlot,
  SpeciesObservation,
  CarbonEstimate,
  Profile,
  NewProfile,
  TreeProfile,
  NewTreeProfile,
  GrowthLog,
  NewGrowthLog,
  PlotImage,
  NewPlotImage,
  SpacingLog,
  NewSpacingLog,
  Comment,
  NewComment,
  Notification,
  NewNotification,
} from "./schema";

/**
 * Cloudflare environment bindings.
 * Extend this interface as you add more bindings in wrangler.json.
 */
export interface Env {
  /**
   * Cloudflare D1 database binding — available in both production and local
   * `wrangler dev`.  Declared as `d1_databases` in wrangler.json.
   */
  DB: D1Database;
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
 *   const rows = await db.select().from(schema.plots);
 *   return c.json(rows);
 * });
 * ```
 */
export function createDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Database = ReturnType<typeof createDb>;
