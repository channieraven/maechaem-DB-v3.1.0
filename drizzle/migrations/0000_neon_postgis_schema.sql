-- Mae Chaem DB — Neon PostgreSQL + PostGIS initial schema
--
-- Apply with:
--   npm run db:push          (direct Neon connection via DATABASE_URL in .env)
-- Or generate + apply manually:
--   npm run db:generate      (generates this file from schema.ts)
--   psql $DATABASE_URL -f drizzle/migrations/0000_neon_postgis_schema.sql
--
-- Requires the PostGIS extension to be enabled on the Neon database.
-- In the Neon console: Extensions → Add PostGIS
-- Or via SQL: CREATE EXTENSION IF NOT EXISTS postgis;

--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plot_boundary_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"farmer_name" text,
	"plot_code" text NOT NULL,
	"group_number" text,
	"area_rai" real,
	"area_sqm" real,
	"tambon" text,
	"elev_mean" real,
	"geom" geometry(Geometry,4326)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plot_boundary_plan_plot_code_unique" ON "plot_boundary_plan" ("plot_code");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plots" (
	"id" serial PRIMARY KEY NOT NULL,
	"plot_code" text NOT NULL,
	"village" text,
	"owner_name" text,
	"geometry" geometry(Geometry,4326) NOT NULL,
	"area_rai" real,
	"area_ha" real,
	"system_type" text,
	"dominant_species" text,
	"established_year" integer,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plots_plot_code_unique" ON "plots" ("plot_code");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "species_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"plot_id" integer NOT NULL REFERENCES "plots"("id") ON DELETE CASCADE,
	"species_name" text NOT NULL,
	"local_name" text,
	"count" integer,
	"avg_dbh_cm" real,
	"avg_height_m" real,
	"observed_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "carbon_estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"plot_id" integer NOT NULL REFERENCES "plots"("id") ON DELETE CASCADE,
	"agb_tonnes_per_ha" real,
	"carbon_tco2e_per_ha" real,
	"methodology" text,
	"estimated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"fullname" text,
	"role" text NOT NULL DEFAULT 'pending',
	"approved" boolean NOT NULL DEFAULT false,
	"position" text,
	"organization" text,
	"phone" text,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_id_unique" ON "profiles" ("user_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trees_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"tree_code" text NOT NULL,
	"tag_label" text,
	"plot_code" text NOT NULL,
	"species_code" text,
	"species_group" text,
	"species_name" text,
	"tree_number" integer,
	"row_main" text,
	"row_sub" text,
	"utm_x" real,
	"utm_y" real,
	"lat" real,
	"lng" real,
	"note" text,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trees_profile_tree_code_unique" ON "trees_profile" ("tree_code");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_id" text NOT NULL,
	"tree_code" text NOT NULL,
	"tag_label" text,
	"plot_code" text NOT NULL,
	"species_code" text,
	"species_group" text,
	"species_name" text,
	"tree_number" integer,
	"row_main" text,
	"row_sub" text,
	"height_m" real,
	"status" text,
	"flowering" text,
	"note" text,
	"recorder" text,
	"survey_date" text,
	"dbh_cm" real,
	"bamboo_culms" integer,
	"dbh_1_cm" real,
	"dbh_2_cm" real,
	"dbh_3_cm" real,
	"banana_total" integer,
	"banana_1yr" integer,
	"yield_bunches" integer,
	"yield_hands" integer,
	"price_per_hand" real,
	"target_sheet" text NOT NULL DEFAULT 'growth_logs',
	"timestamp" timestamptz NOT NULL DEFAULT now(),
	"last_edited_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_logs_log_id_unique" ON "growth_logs" ("log_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plot_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" text NOT NULL,
	"plot_code" text NOT NULL,
	"image_type" text,
	"gallery_category" text,
	"url" text NOT NULL,
	"description" text,
	"uploader" text,
	"date" text,
	"timestamp" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plot_images_image_id_unique" ON "plot_images" ("image_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spacing_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"spacing_id" text NOT NULL,
	"plot_code" text NOT NULL,
	"avg_spacing" real,
	"min_spacing" real,
	"max_spacing" real,
	"tree_count" integer,
	"note" text,
	"date" text,
	"timestamp" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spacing_logs_spacing_id_unique" ON "spacing_logs" ("spacing_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"log_id" text,
	"tree_code" text,
	"plot_code" text,
	"content" text NOT NULL,
	"author_email" text,
	"author_name" text,
	"mentions" text NOT NULL DEFAULT '[]',
	"created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "comments_comment_id_unique" ON "comments" ("comment_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"user_email" text NOT NULL,
	"comment_id" text,
	"log_id" text,
	"tree_code" text,
	"plot_code" text,
	"message" text,
	"author_name" text,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"is_read" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_notification_id_unique" ON "notifications" ("notification_id");
