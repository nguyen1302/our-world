// In-network E2E: run inside the `web` container. Creates the bucket, logs in,
// uploads two GPS-tagged fixtures via presigned PUT, completes, and polls.
import { readFileSync } from "node:fs";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const BASE = "http://localhost:3000";

async function main() {
  // 1. ensure bucket
  const s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  });
  try {
    await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
    console.log("bucket created");
  } catch (e) {
    console.log("bucket:", e.name);
  }

  // 2. login
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  console.log("login:", login.status);

  const files = ["/tmp/gps1.jpg", "/tmp/gps2.jpg"].map((p) => readFileSync(p));

  // 3. presign
  const presign = await fetch(`${BASE}/api/upload/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ files: files.map((_, i) => ({ filename: `g${i}.jpg`, contentType: "image/jpeg" })) }),
  }).then((r) => r.json());
  console.log("presign items:", presign.items?.length);

  // 4. PUT to S3
  const keys = [];
  for (let i = 0; i < files.length; i++) {
    const it = presign.items[i];
    const put = await fetch(it.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: files[i] });
    console.log(`PUT ${i}:`, put.status);
    keys.push({ key: it.key, contentType: "image/jpeg" });
  }

  // 5. complete
  const complete = await fetch(`${BASE}/api/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ keys }),
  }).then((r) => r.json());
  console.log("complete:", complete);

  // 6. poll
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const mem = await fetch(`${BASE}/api/memories`, { headers: { Cookie: cookie } }).then((r) => r.json());
    if (mem.memories?.length) {
      console.log("MEMORIES:", JSON.stringify(mem.memories, null, 2));
      const stats = await fetch(`${BASE}/api/stats`, { headers: { Cookie: cookie } }).then((r) => r.json());
      const scratch = await fetch(`${BASE}/api/scratch`, { headers: { Cookie: cookie } }).then((r) => r.json());
      console.log("STATS:", stats);
      console.log("SCRATCH:", scratch);
      const detail = await fetch(`${BASE}/api/memories/${mem.memories[0].id}`, { headers: { Cookie: cookie } }).then((r) => r.json());
      console.log("DETAIL photos:", detail.photos.length, "title:", detail.memory.title);
      return;
    }
    console.log(`poll ${i}: no memories yet`);
  }
  console.log("TIMEOUT: no memories appeared");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
