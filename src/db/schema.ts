import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const spaces = pgTable("spaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").notNull(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // 'admin' | 'viewer'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ spaceIdx: index("users_space_idx").on(t.spaceId) }),
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").notNull(),
    tripId: uuid("trip_id"),
    title: text("title").notNull(),
    description: text("description"),
    country: text("country"),
    city: text("city"),
    placeName: text("place_name"),
    provinceCode: text("province_code"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    coverPhotoId: uuid("cover_photo_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    spaceIdx: index("memories_space_idx").on(t.spaceId),
    tripIdx: index("memories_trip_idx").on(t.tripId),
    startIdx: index("memories_start_idx").on(t.startAt),
    provinceIdx: index("memories_province_idx").on(t.provinceCode),
  }),
);

// A Trip groups nearby-in-time Memories (place visits) into one journey stop,
// e.g. a 3-day Nha Trang trip that visited many places = one Trip.
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    country: text("country"),
    city: text("city"),
    provinceCode: text("province_code"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    coverPhotoId: uuid("cover_photo_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    spaceIdx: index("trips_space_idx").on(t.spaceId),
    startIdx: index("trips_start_idx").on(t.startAt),
  }),
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").notNull(),
    memoryId: uuid("memory_id"),
    type: text("type").notNull().default("photo"), // 'photo' | 'video'
    s3KeyOriginal: text("s3_key_original").notNull(),
    s3KeyThumb: text("s3_key_thumb"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    width: integer("width"),
    height: integer("height"),
    duration: doublePrecision("duration"),
    status: text("status").notNull().default("pending"), // pending|processed|needs_review|error
    exifJson: jsonb("exif_json"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    spaceIdx: index("photos_space_idx").on(t.spaceId),
    memoryIdx: index("photos_memory_idx").on(t.memoryId),
    statusIdx: index("photos_status_idx").on(t.status),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("queued"), // queued|running|done|error
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ statusIdx: index("jobs_status_idx").on(t.status) }),
);

export const geocodeCache = pgTable(
  "geocode_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    latKey: text("lat_key").notNull(),
    lngKey: text("lng_key").notNull(),
    country: text("country"),
    city: text("city"),
    placeName: text("place_name"),
    provinceCode: text("province_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ cellIdx: index("geocode_cell_idx").on(t.latKey, t.lngKey) }),
);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").notNull(),
    name: text("name").notNull(),
    s3Key: text("s3_key").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ spaceIdx: index("tracks_space_idx").on(t.spaceId) }),
);

// A public, revocable share of the whole map/journey (read-only, no login).
export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").notNull(),
    token: text("token").notNull().unique(), // unguessable URL slug
    title: text("title"),
    includeMusic: boolean("include_music").notNull().default(true),
    facesJson: jsonb("faces_json"), // { a: dataUrl|null, b: dataUrl|null } snapshot for the vehicle
    revoked: boolean("revoked").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // reserved; null = no expiry
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tokenIdx: index("shares_token_idx").on(t.token) }),
);

export type Memory = typeof memories.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Share = typeof shares.$inferSelect;
