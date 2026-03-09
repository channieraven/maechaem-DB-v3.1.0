CREATE TABLE "carbon_estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"plot_id" integer NOT NULL,
	"agb_tonnes_per_ha" real,
	"carbon_tco2e_per_ha" real,
	"methodology" varchar(120),
	"estimated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" varchar(50) NOT NULL,
	"log_id" varchar(50),
	"tree_code" varchar(50),
	"plot_code" varchar(50),
	"content" text NOT NULL,
	"author_email" varchar(200),
	"author_name" varchar(200),
	"mentions" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_comment_id_unique" UNIQUE("comment_id")
);
--> statement-breakpoint
CREATE TABLE "growth_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_id" varchar(50) NOT NULL,
	"tree_code" varchar(50) NOT NULL,
	"tag_label" varchar(50),
	"plot_code" varchar(50) NOT NULL,
	"species_code" varchar(50),
	"species_group" varchar(10),
	"species_name" varchar(200),
	"tree_number" integer,
	"row_main" varchar(20),
	"row_sub" varchar(20),
	"height_m" real,
	"status" varchar(20),
	"flowering" varchar(10),
	"note" text,
	"recorder" varchar(200),
	"survey_date" varchar(30),
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
	"target_sheet" varchar(50) DEFAULT 'growth_logs' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"last_edited_by" varchar(200),
	CONSTRAINT "growth_logs_log_id_unique" UNIQUE("log_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" varchar(50) NOT NULL,
	"user_email" varchar(200) NOT NULL,
	"comment_id" varchar(50),
	"log_id" varchar(50),
	"tree_code" varchar(50),
	"plot_code" varchar(50),
	"message" text,
	"author_name" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notifications_notification_id_unique" UNIQUE("notification_id")
);
--> statement-breakpoint
CREATE TABLE "plot_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" varchar(50) NOT NULL,
	"plot_code" varchar(50) NOT NULL,
	"image_type" varchar(50),
	"gallery_category" varchar(50),
	"url" text NOT NULL,
	"description" text,
	"uploader" varchar(200),
	"date" varchar(30),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plot_images_image_id_unique" UNIQUE("image_id")
);
--> statement-breakpoint
CREATE TABLE "plots" (
	"id" serial PRIMARY KEY NOT NULL,
	"plot_code" varchar(50) NOT NULL,
	"village" varchar(120),
	"owner_name" varchar(200),
	"geometry" jsonb NOT NULL,
	"area_rai" real,
	"area_ha" real,
	"system_type" varchar(80),
	"dominant_species" text,
	"established_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plots_plot_code_unique" UNIQUE("plot_code")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"fullname" text,
	"role" varchar(50) DEFAULT 'pending' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"position" text,
	"organization" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "spacing_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"spacing_id" varchar(50) NOT NULL,
	"plot_code" varchar(50) NOT NULL,
	"avg_spacing" real,
	"min_spacing" real,
	"max_spacing" real,
	"tree_count" integer,
	"note" text,
	"date" varchar(30),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spacing_logs_spacing_id_unique" UNIQUE("spacing_id")
);
--> statement-breakpoint
CREATE TABLE "species_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"plot_id" integer NOT NULL,
	"species_name" varchar(200) NOT NULL,
	"local_name" varchar(200),
	"count" integer,
	"avg_dbh_cm" real,
	"avg_height_m" real,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trees_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"tree_code" varchar(50) NOT NULL,
	"tag_label" varchar(50),
	"plot_code" varchar(50) NOT NULL,
	"species_code" varchar(50),
	"species_group" varchar(10),
	"species_name" varchar(200),
	"tree_number" integer,
	"row_main" varchar(20),
	"row_sub" varchar(20),
	"utm_x" real,
	"utm_y" real,
	"lat" real,
	"lng" real,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trees_profile_tree_code_unique" UNIQUE("tree_code")
);
--> statement-breakpoint
ALTER TABLE "carbon_estimates" ADD CONSTRAINT "carbon_estimates_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_observations" ADD CONSTRAINT "species_observations_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;