CREATE TABLE IF NOT EXISTS "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"country" text,
	"city" text,
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
ALTER TABLE "memories" ADD COLUMN "trip_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_space_idx" ON "trips" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_start_idx" ON "trips" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_trip_idx" ON "memories" USING btree ("trip_id");