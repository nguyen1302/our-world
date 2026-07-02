# Spec — Publish Journey → Public Share Link

**Goal:** Let an admin publish the whole memory map as a **secret, read-only public link**. Anyone with the link (no login) can browse the map + timeline, **play the full journey** (vehicle + music + the couple's faces), open photos full-screen, and read the per-mốc descriptions. The owner can **revoke** the link anytime. The S3 bucket stays private throughout.

**Decisions (locked with the user):**
- **Scope:** one link for the **whole map / grand journey** (all trips). No per-trip links in v1.
- **Public viewer can:** play the journey (vehicle + music + faces), open the lightbox (full-res photos), read titles + descriptions.
- **Access control:** unguessable random token in the URL, **revocable**. No password, no auto-expiry in v1 (leave hooks for both). Photos/music served via **short-lived presigned URLs**; bucket remains private.
- **Data is LIVE, not a snapshot:** the public link renders the space's current content read-only. Editing/deleting content later is reflected on the link automatically. (Only the couple's **faces** are persisted onto the share, since faces normally live in the owner's browser localStorage.)

---

## 1. Data model

New table `shares` (`src/db/schema.ts`):

```ts
export const shares = pgTable("shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id").notNull(),
  token: text("token").notNull().unique(),        // random URL slug (unguessable)
  title: text("title"),                            // optional display title on the public page
  includeMusic: boolean("include_music").notNull().default(true),
  facesJson: jsonb("faces_json"),                  // { a: dataUrl|null, b: dataUrl|null } snapshot for the vehicle
  revoked: boolean("revoked").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // reserved; null = no expiry
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tokenIdx: index("shares_token_idx").on(t.token) }));
```

- **Token:** 22–24 chars, base62, from `crypto.randomBytes` (or `crypto.randomUUID()` stripped). Unique. Long enough that enumeration is infeasible.
- **facesJson:** captured at publish time (and updatable) so the public vehicle shows the couple's faces. Faces are ~small PNG data-URLs (the crop is 240px); storing them in JSONB is fine. (Alternative: upload to S3 + store keys; JSONB is simpler and keeps them private-by-token.)
- One space realistically has **one active share**; the table supports many (e.g., regenerate = new token, old still revocable). Publish UI treats "the current link" as the most recent non-revoked share.

Migration: `npm run db:generate` + `db:push` (or add to migrate). Add `shares` to schema exports.

---

## 2. Server: shared read queries (refactor to avoid duplication)

The public API must return the **same shapes** as the authed API but scoped by `spaceId` from the token, not from the session. Extract the read logic so both call it:

Create `src/lib/queries.ts` with pure functions (no auth inside):
- `listTrips(spaceId): Promise<MemoryMarker[]>` — the body of current `GET /api/memories` (trips + cover presign + photoCount).
- `getTripDetail(spaceId, tripId): Promise<{trip, places}> | null` — body of current `GET /api/memories/[id]` (places + gallery presign). Enforces the trip belongs to `spaceId`.
- `getStats(spaceId): Promise<Stats>` — body of `GET /api/stats`.
- `getScratch(spaceId): Promise<string[]>` — body of `GET /api/scratch`.
- `getActiveTrackUrl(spaceId): Promise<string | null>` — presigned active track (from `GET /api/music`).

Refactor the existing authed routes to call these (behavior unchanged). This keeps presigning + shapes identical between authed and public.

`src/lib/share.ts`:
- `createShare(spaceId, opts): Promise<Share>` — generate unique token, insert.
- `resolveShare(token): Promise<{ share: Share } | null>` — fetch by token; return null if not found, `revoked`, or `expiresAt < now`.
- `revokeShare(id)`, `updateShareFaces(id, faces)`, `bumpView(id)`.

---

## 3. Public API (no auth) — `/api/public/[token]/...`

Every handler: `const s = await resolveShare(token); if (!s) return 404` then use `s.share.spaceId`. **Read-only only — no mutation endpoints exist under `/api/public`.** `runtime = "nodejs"`.

- `GET /api/public/[token]` → `{ title, includeMusic, faces: facesJson, hasMusic }` (page bootstrap + `bumpView`).
- `GET /api/public/[token]/memories` → `listTrips(spaceId)`.
- `GET /api/public/[token]/memories/[id]` → `getTripDetail(spaceId, id)` (404 if the trip isn't in this space).
- `GET /api/public/[token]/stats` → `getStats(spaceId)`.
- `GET /api/public/[token]/scratch` → `getScratch(spaceId)`.
- `GET /api/public/[token]/music` → `{ activeUrl }` from `getActiveTrackUrl` **iff `includeMusic`**, else `{ activeUrl: null }`.
- `GET /api/public/[token]/photo/[photoId]` → presigned **original** URL for the lightbox, but **only after verifying** the photo's `spaceId === share.spaceId` and it's not deleted (mirror `GET /api/photos/[id]/url` with the space check instead of auth). Prevents using the token to read arbitrary photos.

All presigned URLs use the existing `storage.presignGet` (short TTL, e.g. 6h). No `/unplaced`, `/upload`, `/locate`, `/admin`, or any PATCH/DELETE under `/api/public`.

---

## 4. Public viewer page — `/s/[token]`

New route `src/app/s/[token]/page.tsx` (server component shell) → renders a client `PublicHome`.

- **Reuse the existing components** — `WorldMap`, `TimelineBar`, `MemoryCard`, `JourneyControls`, the Lightbox — in **read-only mode**. They already gate all editing behind `isAdmin`; the public page passes `isAdmin={false}` and never mounts admin-only widgets (`UnplacedPanel`, `TopMenu`, `Uploader`).
- **Data loading (public fetchers):** `PublicHome` mirrors `page.tsx`'s load/refresh, but hits `/api/public/[token]/*`:
  - on mount: fetch `memories`, `scratch`, `stats`, the share bootstrap (`faces`, `title`), and `music` → `setMemories/setScratch/setStats`, `useFaces.setFaces(faces)` (from the share, **not** localStorage), `setMusicTrack(activeUrl)`.
  - drill-in: the `pendingEnterTripId` effect fetches `/api/public/[token]/memories/${id}` → `enterTrip(d)`. **Parameterize the trip-detail fetch base** so it points at the public endpoint.
  - `playBigTrips` in `TimelineBar` prefetches trip details — must also use the public base when in public mode.
- **Routing the fetch base:** add a lightweight React context `ApiBaseContext` (default `""` = authed `/api`; public sets `"/api/public/<token>"`). `TimelineBar` (prefetch) and the trip-detail loader read it. MemoryCard's PATCH/DELETE calls are already only invoked in edit mode (admin), which is off publicly — but guard them behind `isAdmin` to be safe (they already are).
- **Read-only affordances:** no ✎/★/🗑/➕, no "Sửa", no close-to-edit; the card is view-only. The Lightbox opens via `/api/public/[token]/photo/[photoId]`.
- **Top bar (public):** brand "We Were Here ♥" + optional share `title` + Stats + Route toggle + base-layer toggle + a small "▶ Chuyến đi" is on the timeline as usual. No menu/import/faces/music-manager. Maybe a tiny "Được chia sẻ bởi …"/footer credit (optional).
- **SEO/privacy:** add `<meta name="robots" content="noindex, nofollow">` on `/s/[token]` so secret links aren't indexed. (Optional nice-to-have: OpenGraph `og:title`/`og:image` = share title + a presigned cover, for a rich preview when the link is pasted — note the presigned URL expiry caveat.)
- **Journey/faces/music parity:** journey replay, camera, vehicle, FX, music, and the couple's faces all work exactly as in the authed app (faces come from the share record; music from the active track if `includeMusic`).

Middleware: ensure `/s/[token]` and `/api/public/**` are **excluded from the auth gate** (they must be reachable logged-out). Update `middleware.ts` matcher/allowlist accordingly.

---

## 5. Publish / manage UI (admin)

Add a menu item **"Chia sẻ hành trình"** (`TopMenu`, admin-only) → opens a `ShareModal` (new component, reuses `.ow-modal`/`.ow-modal__box`).

Modal states:
- **No active link yet:** explainer + **"Tạo link chia sẻ"** button. On click: snapshot current `useFaces` faces into the request, `POST /api/share` → returns `{ token, url }`.
- **Active link exists:** show the full URL in a read-only field + **"Sao chép"** (copy to clipboard) + **"Mở"** (open in new tab). Toggles: **"Kèm nhạc nền"** (includeMusic), **"Cập nhật khuôn mặt"** (re-snapshot faces from current localStorage into the share — useful after changing faces). **"Thu hồi link"** (revoke, with confirm) → link stops working immediately; user can create a new one. Show `viewCount` ("Đã xem N lần") as a small stat. Optional: a QR of the URL (nice for showing on a phone) — v1 optional.

Authed share-management API (admin) — `/api/share`:
- `POST /api/share` (admin) body `{ title?, includeMusic?, faces }` → create or return current share; persists `facesJson`. Response `{ token, url }` where `url = ${SITE_ORIGIN}/s/${token}`.
- `GET /api/share` (admin) → current active share `{ token, url, includeMusic, viewCount, createdAt }` or null.
- `PATCH /api/share/[id]` (admin) → update `includeMusic` / `title` / re-snapshot `facesJson`.
- `POST /api/share/[id]/revoke` (admin) → set `revoked=true`.

`SITE_ORIGIN`: derive from request headers (`x-forwarded-proto` + `host`) or an env `PUBLIC_BASE_URL` (e.g. `https://wewerehere.duckdns.org`). Prefer the env for stability; fall back to headers.

---

## 6. Security & privacy

- **Unguessable token** (≥128 bits of entropy) is the only credential; treat the link like a secret. Unique index on `token`.
- **Strict space scoping:** every public query filters by `share.spaceId`; the photo endpoint verifies each photo belongs to that space before presigning. The token can never read another space's data or any un-owned S3 object.
- **Read-only surface:** no mutation route under `/api/public`. No admin data (users, jobs, unplaced, upload) is exposed.
- **Presigned URLs are short-lived** (existing TTL); the bucket stays private with public-access blocked. A leaked presigned image URL expires on its own.
- **Revoke is immediate:** `resolveShare` rejects `revoked`/expired tokens → 404 on page + API.
- **No indexing:** `robots noindex` + not linked anywhere.
- **Rate-limit (optional, v1.1):** simple per-token/IP throttle on `/api/public/**` to deter scraping; low priority since everything is read-only + presigned.
- **Location privacy note:** a memory map inherently reveals where photos were taken (incl. possibly home). This is the couple's explicit choice to publish; out of scope to blur, but worth a one-line warning in the ShareModal ("Link sẽ hiển thị vị trí các mốc").

---

## 7. Edge cases

- **Content changes after publish (live):** edits/new trips appear automatically; deleted trips/photos disappear. No stale snapshot to maintain.
- **Faces changed after publish:** public still shows the snapshot until the owner taps "Cập nhật khuôn mặt". (Acceptable; documented.)
- **Music off / no track:** vehicle still plays with the generated WebAudio tune only if we choose to allow it publicly — **decision:** if `includeMusic=false` OR no active track, the public journey runs **silent** (do NOT expose the generated fallback unless includeMusic is on; simplest: public music = active track when includeMusic, else none). Keep the mute toggle.
- **Token 404:** `/s/[token]` renders a friendly "Link không tồn tại hoặc đã bị thu hồi" page (not the app).
- **Expired presign during a long session:** thumbnails may 404 after TTL; a page refresh re-presigns. (Acceptable v1; could add per-image refresh later.)
- **Viewer count:** `bumpView` on page bootstrap only (not per asset) to avoid inflating.

---

## 8. Task breakdown (implementation order)

1. **Schema:** add `shares` table + export; `db:generate`/`db:push`.
2. **lib/queries.ts:** extract `listTrips/getTripDetail/getStats/getScratch/getActiveTrackUrl`; refactor authed routes to use them (no behavior change; keep tests green).
3. **lib/share.ts:** token gen, create/resolve/revoke/updateFaces/bumpView.
4. **Authed share API:** `POST/GET /api/share`, `PATCH /api/share/[id]`, `POST /api/share/[id]/revoke`.
5. **Public API:** `/api/public/[token]` bootstrap + `memories`, `memories/[id]`, `stats`, `scratch`, `music`, `photo/[photoId]`.
6. **Middleware:** allowlist `/s/**` and `/api/public/**` (logged-out reachable).
7. **ApiBaseContext + fetch parameterization** in `TimelineBar` (prefetch) and the trip-detail loader.
8. **`/s/[token]` page + `PublicHome`** client (read-only reuse of WorldMap/TimelineBar/MemoryCard/JourneyControls/Lightbox; faces from share; music per includeMusic; robots noindex; 404 page).
9. **ShareModal + "Chia sẻ hành trình" menu item** (create/copy/open/toggle music/update faces/revoke/viewCount).
10. **Manual test:** create link → open in a logged-out browser → browse, play journey (faces+music), lightbox; revoke → link dies. Verify token can't read another space / arbitrary photo.

---

## 9. Out of scope (v1)
Per-trip links, password protection, auto-expiry UI, QR (optional), OG preview image, province "scratch" overlay, rate-limiting, comments/reactions from viewers. Hooks (`expiresAt`, multi-share) are left in the schema for later.
