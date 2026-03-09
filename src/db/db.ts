/**
 * db.ts — Drizzle ORM database connection for Neon PostgreSQL (HTTP driver).
 *
 * Uses @neondatabase/serverless's HTTP-based `neon()` driver, which is ideal
 * for Cloudflare Workers and other edge/serverless runtimes where persistent
 * TCP/WebSocket connections are not available or practical.
 *
 * The same DATABASE_URL is used in all contexts:
 *  - Production (Cloudflare Worker)  : set via `wrangler secret put DATABASE_URL`
 *  - Local dev (`wrangler dev`)      : set in .dev.vars
 *  - Migrations (`npm run db:push`)  : set in .env (read by Drizzle Kit)
 *
 * DATABASE_URL must be the direct Neon connection string, e.g.:
 *   postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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
   * Direct Neon connection string.
   * Set as a Worker secret in production (`wrangler secret put DATABASE_URL`)
   * and in .dev.vars for local development.
   */
  DATABASE_URL: string;
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
 * Uses the HTTP-based Neon driver — no persistent connection required.
 * Each request creates a lightweight HTTP call to Neon.
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
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
