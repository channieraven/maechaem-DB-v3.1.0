/**
 * Drizzle ORM schema for Mae Chaem agroforestry database.
 *
 * v3.2.0 — Cloudflare Workers + Neon PostgreSQL + PostGIS.
 * Reverted to Neon/PostGIS to preserve native spatial capabilities
 * (ST_AsGeoJSON, spatial analysis, etc.) required for the GIS dashboard.
 *
 * DATABASE_URL is used in all contexts (migrations, local dev, production).
 * Set it in .env for Drizzle Kit, in .dev.vars for wrangler dev, and via
 * `wrangler secret put DATABASE_URL` for the production Cloudflare Worker.
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
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";

/**
 * PostGIS geometry column type.
 *
 * The column is created as `geometry(Geometry,4326)` in PostgreSQL.
 * When reading, use `sql<string>\`ST_AsGeoJSON(${table.column})\`` in your
 * Drizzle select to get a GeoJSON string back from the database.
 * When writing, use `sql\`ST_SetSRID(ST_GeomFromGeoJSON(${value}::json::text),4326)\``.
 */
const postgisGeometry = customType<{ data: string }>({
  dataType() {
    return "geometry(Geometry,4326)";
  },
});

// ---------------------------------------------------------------------------
// plot_boundary_plan  (GIS map layer — PostGIS native geometry)
// ---------------------------------------------------------------------------

export const plotBoundaryPlan = pgTable("plot_boundary_plan", {
  id: serial("id").primaryKey(),
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
  /** PostGIS geometry(Geometry,4326) — query via ST_AsGeoJSON() */
  geom: postgisGeometry("geom"),
});

// ---------------------------------------------------------------------------
// plots
// ---------------------------------------------------------------------------

export const plots = pgTable("plots", {
  id: serial("id").primaryKey(),
  /** Unique plot identifier (e.g. "MC-2024-001") */
  plotCode: text("plot_code").notNull().unique(),
  /** Village / sub-district where the plot is located */
  village: text("village"),
  /** Name of the plot owner/farmer */
  ownerName: text("owner_name"),
  /** PostGIS geometry(Geometry,4326) — query via ST_AsGeoJSON() */
  geometry: postgisGeometry("geometry").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// species_observations
// ---------------------------------------------------------------------------

export const speciesObservations = pgTable("species_observations", {
  id: serial("id").primaryKey(),
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
  observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
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
  methodology: text("methodology"),
  estimatedAt: timestamp("estimated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// profiles
// Migrated from v2.1.0 Firebase Cloud Functions (createUserProfile logic).
// Role/approval state is the source of truth; it is synced to Clerk public
// metadata so the JWT carries the latest values.
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
  role: text("role").notNull().default("pending"),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// trees_profile  (migrated from the `trees_profile` Google Sheet)
// ---------------------------------------------------------------------------

export const treesProfile = pgTable("trees_profile", {
  id: serial("id").primaryKey(),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// growth_logs  (migrated from the `growth_logs` Google Sheet)
// ---------------------------------------------------------------------------

export const growthLogs = pgTable("growth_logs", {
  id: serial("id").primaryKey(),
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
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  /** Email/userId of the person who last edited this record. */
  lastEditedBy: text("last_edited_by"),
});

// ---------------------------------------------------------------------------
// plot_images  (migrated from the `plot_images` Google Sheet)
// ---------------------------------------------------------------------------

export const plotImages = pgTable("plot_images", {
  id: serial("id").primaryKey(),
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
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// spacing_logs  (migrated from the `spacing_logs` Google Sheet)
// ---------------------------------------------------------------------------

export const spacingLogs = pgTable("spacing_logs", {
  id: serial("id").primaryKey(),
  spacingId: text("spacing_id").notNull().unique(),
  plotCode: text("plot_code").notNull(),
  avgSpacing: real("avg_spacing"),
  minSpacing: real("min_spacing"),
  maxSpacing: real("max_spacing"),
  treeCount: integer("tree_count"),
  note: text("note"),
  date: text("date"),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// comments  (migrated from the `comments` Google Sheet)
// ---------------------------------------------------------------------------

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  commentId: text("comment_id").notNull().unique(),
  logId: text("log_id"),
  treeCode: text("tree_code"),
  plotCode: text("plot_code"),
  content: text("content").notNull(),
  authorEmail: text("author_email"),
  authorName: text("author_name"),
  /** JSON array of mentioned user emails, e.g. '["a@b.com"]' */
  mentions: text("mentions").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// notifications  (migrated from the `notifications` Google Sheet)
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  notificationId: text("notification_id").notNull().unique(),
  userEmail: text("user_email").notNull(),
  commentId: text("comment_id"),
  logId: text("log_id"),
  treeCode: text("tree_code"),
  plotCode: text("plot_code"),
  message: text("message"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
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
