/**
 * Drizzle ORM schema for Mae Chaem agroforestry database.
 *
 * v3.1.0 — Cloudflare Workers + Cloudflare D1 (SQLite).
 * Migrated from Neon PostgreSQL / Hyperdrive to Cloudflare D1 for
 * fully native Cloudflare storage — no external database required.
 *
 * Tables:
 *  - plot_boundary_plan : GeoJSON plot boundaries with farmer metadata (map layer)
 *  - plots              : agroforestry plot metadata
 *  - species_observations: field species counts per plot
 *  - carbon_estimates   : above-ground biomass / carbon stock estimates
 *  - profiles           : user profiles synced from Clerk (v2.1.0 migration)
 *  - trees_profile      : individual tree coordinates & taxonomy (was trees_profile sheet)
 *  - growth_logs        : periodic tree growth measurements (was growth_logs sheet)
 *  - plot_images        : images attached to plots (was plot_images sheet)
 *  - spacing_logs       : inter-tree spacing surveys (was spacing_logs sheet)
 *  - comments           : comments on growth-log entries (was comments sheet)
 *  - notifications      : in-app notifications for mentions / replies
 */
import {
  sqliteTable,
  integer,
  text,
  real,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// plot_boundary_plan  (GIS map layer — migrated from v3.0.0 PostGIS table)
// Geometry is stored as a GeoJSON string (TEXT) instead of PostGIS geometry.
// ---------------------------------------------------------------------------

export const plotBoundaryPlan = sqliteTable("plot_boundary_plan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmerName: text("farmer_name"),
  /** Unique plot identifier (e.g. "P05") */
  plotCode: text("plot_code").notNull().unique(),
  groupNumber: text("group_number"),
  /** Area in rai (Thai land unit; 1 rai ≈ 0.16 ha) */
  areaRai: real("area_rai"),
  /** Area in square metres */
  areaSqm: real("area_sqm"),
  /** Thai sub-district (tambon) */
  tambon: text("tambon"),
  /** Mean elevation in metres above sea level */
  elevMean: real("elev_mean"),
  /** GeoJSON geometry object stored as a JSON text string */
  geom: text("geom"),
});

// ---------------------------------------------------------------------------
// plots
// ---------------------------------------------------------------------------

export const plots = sqliteTable("plots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Unique plot identifier (e.g. "MC-2024-001") */
  plotCode: text("plot_code").notNull().unique(),
  /** Village / sub-district where the plot is located */
  village: text("village"),
  /** Name of the plot owner/farmer */
  ownerName: text("owner_name"),
  /** GeoJSON Polygon or MultiPolygon geometry stored as a JSON text string */
  geometry: text("geometry").notNull(),
  /** Area in rai (Thai land unit; 1 rai ≈ 0.16 ha) */
  areaRai: real("area_rai"),
  /** Area in hectares (computed field stored for convenience) */
  areaHa: real("area_ha"),
  /** Primary agroforestry system classification */
  systemType: text("system_type"),
  /** Dominant species (comma-separated or first listed) */
  dominantSpecies: text("dominant_species"),
  /** Year the plot was established */
  establishedYear: integer("established_year"),
  /** Timestamp (ms since epoch) when the record was created */
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  /** Timestamp (ms since epoch) when the record was last updated */
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// species_observations
// ---------------------------------------------------------------------------

export const speciesObservations = sqliteTable("species_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plotId: integer("plot_id")
    .notNull()
    .references(() => plots.id, { onDelete: "cascade" }),
  speciesName: text("species_name").notNull(),
  localName: text("local_name"),
  /** Count of individuals observed in the plot */
  count: integer("count"),
  /** Average DBH (diameter at breast height) in cm */
  avgDbhCm: real("avg_dbh_cm"),
  /** Average height in metres */
  avgHeightM: real("avg_height_m"),
  observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// carbon_estimates
// ---------------------------------------------------------------------------

export const carbonEstimates = sqliteTable("carbon_estimates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plotId: integer("plot_id")
    .notNull()
    .references(() => plots.id, { onDelete: "cascade" }),
  /** Estimated above-ground biomass in tonnes per hectare */
  agbTonnesPerHa: real("agb_tonnes_per_ha"),
  /** Estimated carbon stock in tCO2e per hectare */
  carbonTco2ePerHa: real("carbon_tco2e_per_ha"),
  /** Methodology / allometric equation used */
  methodology: text("methodology"),
  estimatedAt: integer("estimated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// profiles
// Migrated from v2.1.0 Firebase Cloud Functions (createUserProfile logic).
// Role/approval state is the source of truth; it is synced to Clerk public
// metadata so the JWT carries the latest values.
// ---------------------------------------------------------------------------

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  role: text("role").notNull().default("pending"),
  /**
   * Whether the user has been approved by an admin.
   * First registered user is automatically approved as bootstrap admin.
   * Stored as INTEGER 0/1; Drizzle maps to boolean automatically.
   */
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  /** Optional: job title / position */
  position: text("position"),
  /** Optional: employer / organisation */
  organization: text("organization"),
  /** Optional: contact phone number */
  phone: text("phone"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// trees_profile  (migrated from the `trees_profile` Google Sheet)
// ---------------------------------------------------------------------------

export const treesProfile = sqliteTable("trees_profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  treeCode: text("tree_code").notNull().unique(),
  tagLabel: text("tag_label"),
  plotCode: text("plot_code").notNull(),
  speciesCode: text("species_code"),
  speciesGroup: text("species_group"),
  speciesName: text("species_name"),
  treeNumber: integer("tree_number"),
  rowMain: text("row_main"),
  rowSub: text("row_sub"),
  utmX: real("utm_x"),
  utmY: real("utm_y"),
  lat: real("lat"),
  lng: real("lng"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// growth_logs  (migrated from the `growth_logs` Google Sheet)
// ---------------------------------------------------------------------------

export const growthLogs = sqliteTable("growth_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  logId: text("log_id").notNull().unique(),
  treeCode: text("tree_code").notNull(),
  tagLabel: text("tag_label"),
  plotCode: text("plot_code").notNull(),
  speciesCode: text("species_code"),
  speciesGroup: text("species_group"),
  speciesName: text("species_name"),
  treeNumber: integer("tree_number"),
  rowMain: text("row_main"),
  rowSub: text("row_sub"),
  // Common measurements
  heightM: real("height_m"),
  status: text("status"),
  flowering: text("flowering"),
  note: text("note"),
  recorder: text("recorder"),
  surveyDate: text("survey_date"),
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
  targetSheet: text("target_sheet").notNull().default("growth_logs"),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  /** Email/userId of the person who last edited this record. */
  lastEditedBy: text("last_edited_by"),
});

// ---------------------------------------------------------------------------
// plot_images  (migrated from the `plot_images` Google Sheet)
// ---------------------------------------------------------------------------

export const plotImages = sqliteTable("plot_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageId: text("image_id").notNull().unique(),
  plotCode: text("plot_code").notNull(),
  /** "plan_pre_1" | "plan_pre_2" | "plan_post_1" | "gallery" | "plan_pre" */
  imageType: text("image_type"),
  /** "tree" | "soil" | "atmosphere" | "other" — only when imageType=gallery */
  galleryCategory: text("gallery_category"),
  url: text("url").notNull(),
  description: text("description"),
  uploader: text("uploader"),
  date: text("date"),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// spacing_logs  (migrated from the `spacing_logs` Google Sheet)
// ---------------------------------------------------------------------------

export const spacingLogs = sqliteTable("spacing_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spacingId: text("spacing_id").notNull().unique(),
  plotCode: text("plot_code").notNull(),
  avgSpacing: real("avg_spacing"),
  minSpacing: real("min_spacing"),
  maxSpacing: real("max_spacing"),
  treeCount: integer("tree_count"),
  note: text("note"),
  date: text("date"),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// comments  (migrated from the `comments` Google Sheet)
// ---------------------------------------------------------------------------

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commentId: text("comment_id").notNull().unique(),
  logId: text("log_id"),
  treeCode: text("tree_code"),
  plotCode: text("plot_code"),
  content: text("content").notNull(),
  authorEmail: text("author_email"),
  authorName: text("author_name"),
  /** JSON array of mentioned user emails, e.g. '["a@b.com"]' */
  mentions: text("mentions").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// notifications  (migrated from the `notifications` Google Sheet)
// ---------------------------------------------------------------------------

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notificationId: text("notification_id").notNull().unique(),
  userEmail: text("user_email").notNull(),
  commentId: text("comment_id"),
  logId: text("log_id"),
  treeCode: text("tree_code"),
  plotCode: text("plot_code"),
  message: text("message"),
  authorName: text("author_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  /** Stored as INTEGER 0/1; Drizzle maps to boolean automatically. */
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
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
