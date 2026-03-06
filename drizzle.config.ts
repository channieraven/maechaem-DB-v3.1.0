import { defineConfig } from "drizzle-kit";

/**
 * drizzle.config.ts — Drizzle Kit configuration for schema migrations.
 *
 * Used by:
 *   npm run db:generate  → generate SQL migration files in ./drizzle/migrations/
 *   npm run db:migrate   → apply pending migrations to the database
 *   npm run db:studio    → open Drizzle Studio visual DB editor
 *
 * The DATABASE_URL environment variable must point to your Neon PostgreSQL
 * connection string. For local development, copy .env.example to .env and
 * fill in the value.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"]!,
  },
  verbose: true,
  strict: true,
});
