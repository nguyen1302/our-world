export type Role = "admin" | "viewer";

export interface ConfigUser {
  username: string;
  passwordHash: string;
  role: Role;
}

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

export interface AppConfig {
  databaseUrl: string;
  authSecret: string;
  defaultSpaceId: string;
  users: ConfigUser[];
  s3: S3Config;
  clusterDistanceKm: number;
  clusterTimeGapHours: number;
  nominatimUserAgent: string;
  nominatimBaseUrl: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseUsers(raw: string | undefined): ConfigUser[] {
  const value = required("USERS", raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (e) {
    throw new Error(`USERS must be valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("USERS must be a non-empty JSON array");
  }
  return parsed.map((u, i) => {
    const user = u as Record<string, unknown>;
    if (typeof user.username !== "string" || typeof user.passwordHash !== "string") {
      throw new Error(`USERS[${i}] needs string username and passwordHash`);
    }
    if (user.role !== "admin" && user.role !== "viewer") {
      throw new Error(`USERS[${i}].role must be "admin" or "viewer"`);
    }
    return { username: user.username, passwordHash: user.passwordHash, role: user.role };
  });
}

function num(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`${name} must be a number`);
  return n;
}

let cached: AppConfig | null = null;

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached && env === process.env) return cached;
  const config: AppConfig = {
    databaseUrl: required("DATABASE_URL", env.DATABASE_URL),
    authSecret: required("AUTH_SECRET", env.AUTH_SECRET),
    defaultSpaceId: env.DEFAULT_SPACE_ID || "00000000-0000-0000-0000-000000000001",
    users: parseUsers(env.USERS),
    s3: {
      bucket: required("S3_BUCKET", env.S3_BUCKET),
      region: env.S3_REGION || "ap-southeast-1",
      accessKeyId: env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    },
    clusterDistanceKm: num("CLUSTER_DISTANCE_KM", env.CLUSTER_DISTANCE_KM, 1.5),
    clusterTimeGapHours: num("CLUSTER_TIME_GAP_HOURS", env.CLUSTER_TIME_GAP_HOURS, 6),
    nominatimUserAgent: env.NOMINATIM_USER_AGENT || "our-world/0.1",
    nominatimBaseUrl: env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org",
  };
  if (env === process.env) cached = config;
  return config;
}
