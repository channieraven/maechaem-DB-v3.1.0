import { defineConfig } from "drizzle-kit";

/**
 * drizzle.config.ts — Drizzle Kit configuration for schema migrations.
 *
 * Used by:
 *   npm run db:generate  → generate SQL migration files in ./drizzle/migrations/
 *
 * Migrations are applied to Cloudflare D1 using wrangler:
 *   # Local development
 *   wrangler d1 migrations apply maechaem-db --local
 *
 *   # Production
 *   wrangler d1 migrations apply maechaem-db
 *
 * Ensure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_D1_DATABASE_ID are set in
 * your environment when running migrations against production D1.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  verbose: true,
  strict: true,
});
