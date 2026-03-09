/**
 * Drizzle ORM schema for Mae Chaem agroforestry plots.
 *
 * Table: plots
 * - Stores individual agroforestry plot records with GeoJSON geometry
 *   and metadata about the plot, owner, and measurement data.
 */
import { pgTable, serial, text, real, jsonb, timestamp, varchar, integer, boolean } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// plots
// ---------------------------------------------------------------------------

export const plots = pgTable("plots", {
  id: serial("id").primaryKey(),
  /** Unique plot identifier (e.g. "MC-2024-001") */
  plotCode: varchar("plot_code", { length: 50 }).notNull().unique(),
  /** Village / sub-district where the plot is located */
  village: varchar("village", { length: 120 }),
  /** Name of the plot owner/farmer */
  ownerName: varchar("owner_name", { length: 200 }),
  /** GeoJSON Polygon or MultiPolygon geometry stored as JSONB */
  geometry: jsonb("geometry").notNull(),
  /** Area in rai (Thai land unit; 1 rai ≈ 0.16 ha) */
  areaRai: real("area_rai"),
  /** Area in hectares (computed field stored for convenience) */
  areaHa: real("area_ha"),
  /** Primary agroforestry system classification */
  systemType: varchar("system_type", { length: 80 }),
  /** Dominant species (comma-separated or first listed) */
  dominantSpecies: text("dominant_species"),
  /** Year the plot was established */
  establishedYear: integer("established_year"),
  /** Date the plot record was created in this database */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /** Date the plot record was last updated */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// species_observations
// ---------------------------------------------------------------------------

export const speciesObservations = pgTable("species_observations", {
  id: serial("id").primaryKey(),
  plotId: integer("plot_id")
    .notNull()
    .references(() => plots.id, { onDelete: "cascade" }),
  speciesName: varchar("species_name", { length: 200 }).notNull(),
  localName: varchar("local_name", { length: 200 }),
  /** Count of individuals observed in the plot */
  count: integer("count"),
  /** Average DBH (diameter at breast height) in cm */
  avgDbhCm: real("avg_dbh_cm"),
  /** Average height in metres */
  avgHeightM: real("avg_height_m"),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// carbon_estimates
// ---------------------------------------------------------------------------

export const carbonEstimates = pgTable("carbon_estimates", {
  id: serial("id").primaryKey(),
  plotId: integer("plot_id")
    .notNull()
    .references(() => plots.id, { onDelete: "cascade" }),
  /** Estimated above-ground biomass in tonnes per hectare */
  agbTonnesPerHa: real("agb_tonnes_per_ha"),
  /** Estimated carbon stock in tCO2e per hectare */
  carbonTco2ePerHa: real("carbon_tco2e_per_ha"),
  /** Methodology / allometric equation used */
  methodology: varchar("methodology", { length: 120 }),
  estimatedAt: timestamp("estimated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// profiles
// Migrated from v2.1.0 Firebase Cloud Functions (createUserProfile logic).
// Mirrors the Firestore `profiles` collection document structure, adapted
// for PostgreSQL.  Role/approval state is the source of truth; it is synced
// to Clerk public metadata so the JWT carries the latest values.
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  /** Clerk user ID — matches `sub` claim in the Clerk JWT. */
  userId: text("user_id").notNull().unique(),
  /** Primary email address sourced from Clerk on user.created. */
  email: text("email").notNull(),
  /** Display name (from Clerk firstName+lastName or email prefix). */
  fullname: text("fullname"),
  /**
   * Access role — mirrors v2.1.0 Firestore field.
   *  "admin"   → full access, can manage users
   *  "pending" → awaiting admin approval
   */
  role: varchar("role", { length: 50 }).notNull().default("pending"),
  /**
   * Whether the user has been approved by an admin.
   * First registered user is automatically approved as bootstrap admin.
   */
  approved: boolean("approved").notNull().default(false),
  /** Optional: job title / position */
  position: text("position"),
  /** Optional: employer / organisation */
  organization: text("organization"),
  /** Optional: contact phone number */
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// TypeScript types inferred from schema
export type Plot = typeof plots.$inferSelect;
export type NewPlot = typeof plots.$inferInsert;
export type SpeciesObservation = typeof speciesObservations.$inferSelect;
export type CarbonEstimate = typeof carbonEstimates.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
