import { defineConfig } from "drizzle-kit";

/**
 * drizzle.config.ts — Drizzle Kit configuration for schema migrations.
 *
 * Used by:
 *   npm run db:generate  → generate SQL migration files in ./drizzle/migrations/
 *   npm run db:push      → push schema changes directly to Neon (no migration files)
 *
 * Both commands read DATABASE_URL from your local .env file.
 * Use the same direct Neon connection string that is used everywhere else:
 *
 *   DATABASE_URL=postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
 *
 * The same DATABASE_URL is also used by the Cloudflare Worker at runtime
 * (set via `wrangler secret put DATABASE_URL` for production, or in
 * .dev.vars for local `wrangler dev`).
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
