/**
 * Drizzle ORM schema for Mae Chaem agroforestry database.
 *
 * Migrated from v1.0.1 (Google Apps Script / Sheets backend) to
 * v3.1.0 (Cloudflare Workers + Neon PostgreSQL via Hyperdrive).
 *
 * Tables:
 *  - plots              : GeoJSON plot boundaries (carried over from v3.0.0)
 *  - species_observations: field species counts per plot
 *  - carbon_estimates   : above-ground biomass / carbon stock estimates
 *  - profiles           : user profiles synced from Clerk (extended with role/approval)
 *  - trees_profile      : individual tree coordinates & taxonomy (was trees_profile sheet)
 *  - growth_logs        : periodic tree growth measurements (was growth_logs sheet)
 *  - plot_images        : images attached to plots (was plot_images sheet)
 *  - spacing_logs       : inter-tree spacing surveys (was spacing_logs sheet)
 *  - comments           : comments on growth-log entries (was comments sheet)
 *  - notifications      : in-app notifications for mentions / replies
 */
import {
  pgTable,
  serial,
  text,
  real,
  jsonb,
  timestamp,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

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
// profiles  (extended from the Clerk webhook seed created in webhooks.ts)
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  /** Clerk user ID (e.g. "user_2abc…") */
  userId: text("user_id").notNull().unique(),
  email: text("email").notNull(),
  fullname: varchar("fullname", { length: 200 }),
  position: varchar("position", { length: 200 }),
  organization: varchar("organization", { length: 200 }),
  /** Role: "admin" | "researcher" | "pending" */
  role: varchar("role", { length: 50 }).notNull().default("pending"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// trees_profile  (migrated from the `trees_profile` Google Sheet)
// ---------------------------------------------------------------------------

export const treesProfile = pgTable("trees_profile", {
  id: serial("id").primaryKey(),
  treeCode: varchar("tree_code", { length: 50 }).notNull().unique(),
  tagLabel: varchar("tag_label", { length: 50 }),
  plotCode: varchar("plot_code", { length: 50 }).notNull(),
  speciesCode: varchar("species_code", { length: 50 }),
  speciesGroup: varchar("species_group", { length: 10 }),
  speciesName: varchar("species_name", { length: 200 }),
  treeNumber: integer("tree_number"),
  rowMain: varchar("row_main", { length: 20 }),
  rowSub: varchar("row_sub", { length: 20 }),
  utmX: real("utm_x"),
  utmY: real("utm_y"),
  lat: real("lat"),
  lng: real("lng"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// growth_logs  (migrated from the `growth_logs` Google Sheet)
// ---------------------------------------------------------------------------

export const growthLogs = pgTable("growth_logs", {
  id: serial("id").primaryKey(),
  logId: varchar("log_id", { length: 50 }).notNull().unique(),
  treeCode: varchar("tree_code", { length: 50 }).notNull(),
  tagLabel: varchar("tag_label", { length: 50 }),
  plotCode: varchar("plot_code", { length: 50 }).notNull(),
  speciesCode: varchar("species_code", { length: 50 }),
  speciesGroup: varchar("species_group", { length: 10 }),
  speciesName: varchar("species_name", { length: 200 }),
  treeNumber: integer("tree_number"),
  rowMain: varchar("row_main", { length: 20 }),
  rowSub: varchar("row_sub", { length: 20 }),
  // Common measurements
  heightM: real("height_m"),
  status: varchar("status", { length: 20 }),
  flowering: varchar("flowering", { length: 10 }),
  note: text("note"),
  recorder: varchar("recorder", { length: 200 }),
  surveyDate: varchar("survey_date", { length: 30 }),
  // Standard (Forest / Rubber / Fruit)
  dbhCm: real("dbh_cm"),
  // Bamboo
  bambooCulms: integer("bamboo_culms"),
  dbh1Cm: real("dbh_1_cm"),
  dbh2Cm: real("dbh_2_cm"),
  dbh3Cm: real("dbh_3_cm"),
  // Banana
  bananaTotal: integer("banana_total"),
  banana1yr: integer("banana_1yr"),
  yieldBunches: integer("yield_bunches"),
  yieldHands: integer("yield_hands"),
  pricePerHand: real("price_per_hand"),
  /** target_sheet: "growth_logs" | "growth_logs_supp" */
  targetSheet: varchar("target_sheet", { length: 50 }).notNull().default("growth_logs"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// plot_images  (migrated from the `plot_images` Google Sheet)
// ---------------------------------------------------------------------------

export const plotImages = pgTable("plot_images", {
  id: serial("id").primaryKey(),
  imageId: varchar("image_id", { length: 50 }).notNull().unique(),
  plotCode: varchar("plot_code", { length: 50 }).notNull(),
  /** "plan_pre_1" | "plan_pre_2" | "plan_post_1" | "gallery" | "plan_pre" */
  imageType: varchar("image_type", { length: 50 }),
  /** "tree" | "soil" | "atmosphere" | "other" — only when imageType=gallery */
  galleryCategory: varchar("gallery_category", { length: 50 }),
  url: text("url").notNull(),
  description: text("description"),
  uploader: varchar("uploader", { length: 200 }),
  date: varchar("date", { length: 30 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// spacing_logs  (migrated from the `spacing_logs` Google Sheet)
// ---------------------------------------------------------------------------

export const spacingLogs = pgTable("spacing_logs", {
  id: serial("id").primaryKey(),
  spacingId: varchar("spacing_id", { length: 50 }).notNull().unique(),
  plotCode: varchar("plot_code", { length: 50 }).notNull(),
  avgSpacing: real("avg_spacing"),
  minSpacing: real("min_spacing"),
  maxSpacing: real("max_spacing"),
  treeCount: integer("tree_count"),
  note: text("note"),
  date: varchar("date", { length: 30 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// comments  (migrated from the `comments` Google Sheet)
// ---------------------------------------------------------------------------

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  commentId: varchar("comment_id", { length: 50 }).notNull().unique(),
  logId: varchar("log_id", { length: 50 }),
  treeCode: varchar("tree_code", { length: 50 }),
  plotCode: varchar("plot_code", { length: 50 }),
  content: text("content").notNull(),
  authorEmail: varchar("author_email", { length: 200 }),
  authorName: varchar("author_name", { length: 200 }),
  /** JSON array of mentioned user emails, e.g. '["a@b.com"]' */
  mentions: text("mentions").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// notifications  (migrated from the `notifications` Google Sheet)
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  notificationId: varchar("notification_id", { length: 50 }).notNull().unique(),
  userEmail: varchar("user_email", { length: 200 }).notNull(),
  commentId: varchar("comment_id", { length: 50 }),
  logId: varchar("log_id", { length: 50 }),
  treeCode: varchar("tree_code", { length: 50 }),
  plotCode: varchar("plot_code", { length: 50 }),
  message: text("message"),
  authorName: varchar("author_name", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  isRead: boolean("is_read").notNull().default(false),
});

// TypeScript types inferred from schema
export type Plot = typeof plots.$inferSelect;
export type NewPlot = typeof plots.$inferInsert;
export type SpeciesObservation = typeof speciesObservations.$inferSelect;
export type CarbonEstimate = typeof carbonEstimates.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type TreeProfile = typeof treesProfile.$inferSelect;
export type NewTreeProfile = typeof treesProfile.$inferInsert;
export type GrowthLog = typeof growthLogs.$inferSelect;
export type NewGrowthLog = typeof growthLogs.$inferInsert;
export type PlotImage = typeof plotImages.$inferSelect;
export type NewPlotImage = typeof plotImages.$inferInsert;
export type SpacingLog = typeof spacingLogs.$inferSelect;
export type NewSpacingLog = typeof spacingLogs.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
