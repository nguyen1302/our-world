// Upload all /tmp/seed/*.jpg through the real API (run inside web container).
import { readFileSync, readdirSync } from "node:fs";
const BASE = "http://localhost:3000";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const names = readdirSync("/tmp/seed").filter((f) => /\.(jpe?g)$/i.test(f));
  const files = names.map((n) => readFileSync(`/tmp/seed/${n}`));
  console.log("uploading", names.length, "files");

  const presign = await fetch(`${BASE}/api/upload/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ files: names.map((n) => ({ filename: n, contentType: "image/jpeg" })) }),
  }).then((r) => r.json());

  const keys = [];
  for (let i = 0; i < files.length; i++) {
    const it = presign.items[i];
    await fetch(it.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: files[i] });
    keys.push({ key: it.key, contentType: "image/jpeg" });
  }

  const complete = await fetch(`${BASE}/api/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ keys }),
  }).then((r) => r.json());
  console.log("created", complete.created.length, "photos");

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const m = await fetch(`${BASE}/api/memories`, { headers: { Cookie: cookie } }).then((r) => r.json());
    const stats = await fetch(`${BASE}/api/stats`, { headers: { Cookie: cookie } }).then((r) => r.json());
    console.log(`poll ${i}: memories=${m.memories.length} provinces=${stats.provinces} photos=${stats.photos}`);
    if (stats.photos >= 8) {
      console.log("FINAL memories:", m.memories.map((x) => `${x.title} (${x.provinceCode}, ${x.photoCount}p)`));
      return;
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
