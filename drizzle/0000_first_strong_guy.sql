CREATE TABLE IF NOT EXISTS "geocode_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lat_key" text NOT NULL,
	"lng_key" text NOT NULL,
	"country" text,
	"city" text,
	"place_name" text,
	"province_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"country" text,
	"city" text,
	"place_name" text,
	"province_code" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"cover_photo_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"memory_id" uuid,
	"type" text DEFAULT 'photo' NOT NULL,
	"s3_key_original" text NOT NULL,
	"s3_key_thumb" text,
	"taken_at" timestamp with time zone,
	"lat" double precision,
	"lng" double precision,
	"width" integer,
	"height" integer,
	"duration" double precision,
	"status" text DEFAULT 'pending' NOT NULL,
	"exif_json" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geocode_cell_idx" ON "geocode_cache" USING btree ("lat_key","lng_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_space_idx" ON "memories" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_start_idx" ON "memories" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_province_idx" ON "memories" USING btree ("province_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_space_idx" ON "photos" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_memory_idx" ON "photos" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_status_idx" ON "photos" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_space_idx" ON "users" USING btree ("space_id");