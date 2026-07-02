# "We Were Here ♥" — UI/UX Design + Responsive Brief (v2, full system snapshot)

> **Status:** This document describes the **actual, current implementation** as of the latest commit — every feature, flow, component, state, class name, and responsive rule that exists in the code today. It supersedes the earlier brief (whose class names — `.ow-play`, `.ow-tlnode`, `.ow-pin2`, `.ow-pop` — are obsolete). Use it to (a) redesign the visuals and (b) design a **complete responsive system**, then hand back redlines the engineer implements against these exact hooks.
>
> **For the design agent — what we want from you:**
> 1. A refined **visual design system** (tokens, type, spacing, radii, shadows, motion) that reads well over satellite imagery.
> 2. **Per-component redlines** keyed to the exact class names below.
> 3. A **full responsive design** — mobile-first (primary device = iPhone Safari), plus tablet + desktop. The app has ONE mobile breakpoint today (`max-width: 767px`); we want a considered multi-breakpoint system, including all the journey/placing/detail states listed in §11.
> 4. **Vehicle SVG artwork** (§12).
>
> **Do NOT change** data flows, the DB model, the map library, clustering, or journey logic (§2/§4/§5 are behavioral truth — restyle/relayout what's there, keep the behavior). If you want to change layout/structure for responsive, that's fine — just keep every documented behavior and state reachable.

---

## 1. Product

A **private, two-person "memory map."** A satellite map of Vietnam (Apple-Find style). Photos imported from an iPhone are auto-placed as markers by their EXIF time + GPS, clustered into **Trips → Places**, and shown on the map + a bottom **timeline axis**. A **Play** mode replays the whole history: a cute little vehicle (with the couple's cropped faces on it) drives stop-to-stop across the map and the timeline, with music. Tone: **romantic, warm, cute, nostalgic — but tasteful, modern, premium; never childish or cluttered.**

UI language is **Vietnamese** (all microcopy below is the literal on-screen text). Brand shown: **"We Were Here"** with sub-label **"Bản đồ ký ức"**.

---

## 2. Hard constraints

- **Basemap = satellite imagery** by default (Esri World Imagery) with a place-label reference overlay; an optional **"light" basemap** (CARTO Voyager) is toggleable. UI chrome floats over busy imagery → panels need strong contrast/legibility.
- **Map lib = Leaflet 1.9 + react-leaflet 4.2 + leaflet.markercluster.** Markers/vehicles are Leaflet **divIcons** styled via CSS + inline SVG; routes are `Polyline`s. Camera moves are `flyTo` / `flyToBounds`.
- **Mobile-first**, primary device iPhone Safari. Must be fully responsive. Uses `100dvh`.
- **Lightweight**: prefer SVG/CSS over heavy assets. Faces are stored client-side (localStorage). Photos/audio come from S3 via presigned URLs.
- **Tech**: Next.js 14 (App Router), TypeScript, Zustand stores, Drizzle ORM + Postgres. Two roles: **admin** (edit/upload) and **viewer** (read-only).

---

## 3. Data model (source of truth for what a "mốc" is)

Postgres tables (`src/db/schema.ts`):

- **spaces** — one shared space per couple.
- **users** — `role: 'admin' | 'viewer'`, bcrypt password.
- **trips** ("mốc lớn" / journey stop) — `title, description, country, city, provinceCode, lat, lng, startAt, endAt, coverPhotoId, deletedAt`. Centroid + time-span of its member places.
- **memories** ("mốc nhỏ" / a Place visit) — same shape as trips **plus** `tripId` (FK to trips). This is the granular "place."
- **photos** — `memoryId, type ('photo'|'video'), s3KeyOriginal, s3KeyThumb, takenAt, lat, lng, width, height, status ('pending'|'processed'|'needs_review'|'error'), exifJson`, soft-delete.
- **jobs** — background queue (`type='process_photo'`, payload `{photoId, fallbackMemoryId?}`).
- **geocode_cache** — reverse-geocode cache keyed to a ~110 m grid cell.
- **tracks** — uploaded background music (`name, s3Key, isActive`).
- **Faces** (couple's cropped faces for the vehicle) are **NOT** in the DB — stored in `localStorage` key `ow_faces` as `{a, b}` PNG data-URLs.

**Hierarchy:** `Photo → Memory (Place / mốc nhỏ) → Trip (mốc lớn)`. The map's top-level markers and the timeline beads are **Trips**. Drilling into a trip reveals its **Places**.

### Clustering rules (`src/lib/config.ts`, do not change semantics)
- Photo joins an existing **Place** if within **5 km** AND **6 h** of it; else a new Place is created.
- Place joins an existing **Trip** if within **80 km** AND **36 h**; else a new Trip is created.
- `recomputeTrip`/`recompute…` recompute centroid, time-span, cover, and title from members; empty trips/places soft-delete. A **manually chosen cover survives** recompute if its photo still exists.

### Dates — critical, don't reintroduce a bug
EXIF times are **wall-clock** stored in `timestamptz` columns. They are formatted with **`getUTC*` / ISO-string slicing** everywhere (NEVER converted to a local timezone). A past bug double-shifted dates by converting to VN time — the correct bead/label is the UTC-sliced value. Keep all date rendering as UTC-slice.

### Known content redundancy (please advise in the redesign)
Auto **titles currently embed a date range**: `"{Place|City} · dd/mm/yyyy"` or `"… · dd–dd/mm/yyyy"` (from `buildTitle` / `recomputeTrip`). The memory card ALSO shows the date on its own row (`.ow-card__date`) → the date appears twice, and stored old titles can show a stale date. **Recommendation for the designer:** title = place/city name only; date lives solely in the date row. (Engineer will implement whatever the design decides.)

---

## 4. Feature list (everything the system does today)

1. **Auth** — login (`/login`), session cookie, roles admin/viewer. Viewers can't edit/upload; admin-only UI is hidden for them.
2. **Import photos** (admin) — pick many iPhone photos; browser uploads directly to S3 (presigned), a worker reads EXIF, makes a thumbnail, reverse-geocodes, and clusters into Trip/Place. Runs in background; a progress toast shows; screen wake-lock held during upload.
3. **Two-level map** — Trip markers (clustered) at level 1; entering a trip shows its Place markers at level 2.
4. **Timeline axis** — all trips as photo "beads" on a horizontal time axis with year dividers; zoomable; auto-scrolls to the active bead.
5. **Journey replay** (the centerpiece) — two nested journeys:
   - **Big journey** ("Chuyến đi"): vehicle visits every Trip in chronological order.
   - **Small journey** (inside a trip with >1 places): auto-starts to tour that trip's Places.
   - One vehicle at a time; music; motion FX; couple's faces on the vehicle.
6. **Memory card** — detail panel for the focused Trip: cover, title, date, place, description (a little story), a horizontal strip of Place chips, a photo gallery, and edit tools.
7. **Editing** (admin) — inline edit title/description; change cover (★); delete photo (🗑, also removes from S3); add more photos to a place (➕); delete a trip.
8. **Manual placement of no-GPS photos** — iOS strips GPS from Photo-Library uploads; a "Chưa định vị N" panel lets admin select photos and drop them (a) on a map point, (b) onto an existing Trip marker, (c) onto an existing Place marker, or (d) onto a **timeline bead** — attaching to that existing mốc.
9. **Full-screen photo viewer (Lightbox)** — Drive-like; swipe + arrow keys + counter.
10. **On This Day** — banner when a past-year trip shares today's month/day (hidden on mobile currently).
11. **Stats** — counts of kỷ niệm (memories/places) · tỉnh thành (provinces) · ảnh (photos). (Also computes videos/countries.)
12. **Faces** — crop the two people's faces (circular) to composite onto the vehicle; stored locally.
13. **Music** — upload background tracks; pick an active one; if none, a gentle generated WebAudio tune plays during the journey; mute toggle.
14. **Base-layer toggle** — satellite ↔ light basemap.
15. **Route toggle** ("Tuyến đường") — show/hide the dashed journey route lines.
16. **Visited provinces** — provinces count is shown; `scratchCodes` (distinct visited province codes) is fetched. **Note:** there is currently **no province-highlight ("scratch map") overlay drawn on the map** — this is data-only today. (Opportunity: the designer may propose a tasteful visited-province highlight; flag it as new work.)

---

## 5. Key user flows (step-by-step, current behavior)

**Import → see on map.** Menu (admin) → "Import ảnh" → OS file picker → files chunked (40/batch), presigned, PUT to S3 (3 concurrent, 4 retries) → `/api/upload/complete` creates photo rows + enqueues jobs → worker (polls every 2 s) processes each: EXIF → thumbnail → if **GPS present**: reverse-geocode + cluster into Trip/Place, status `processed`; if **no GPS**: attach to `fallbackMemoryId` if the import targeted a place, else status `needs_review` (shows in "Chưa định vị"). A toast tracks progress; the app refreshes automatically.

**Browse.** Tap a Trip marker (or a timeline bead) → map frames the trip's places, the **memory card** opens with that trip's detail. Tap a Place chip or Place marker → focuses that place. Close the card → camera does NOT move (stays put).

**Journey.** Tap **"▶ Chuyến đi"** (timeline). Vehicle starts at trip 1, **paused**. Controls (bottom): **✕ Thoát**, status ("Chặng X / Y · …"), **Tiếp →**. Press **Tiếp** → vehicle drives to the next trip (map frames both endpoints, vehicle slides across, FX puffs), arrives, pauses, card/detail updates, music continues. If a trip has multiple places, a **small journey** auto-starts to tour them (its own rose-colored control panel). **Tap any timeline bead mid-journey** → the vehicle **travels from its current stop directly to that bead** (see §7). Reaching the last stop / pressing Thoát ends it (index resets).

**Place a no-GPS photo.** "📍 Chưa định vị N" → modal grid → select photos ("Chọn tất cả" available) → "Đặt N ảnh lên bản đồ →" → a banner appears: *"Đặt N ảnh: bấm 1 điểm trên bản đồ, hoặc bấm 1 mốc (trên bản đồ / timeline) để thêm vào mốc đó."* Then either click an empty map point (geocode + cluster) or click a Trip marker / Place marker / timeline bead (attach to that existing mốc). "Huỷ" cancels.

**Edit.** In the card, "✎ Sửa" reveals gallery ★ (set cover) / 🗑 (delete photo) and "➕ Thêm ảnh"; the title/description are click-to-edit; "★" on a place/trip sets its cover; a trip can be deleted.

---

## 6. Screen & component inventory (redline targets — EXACT class names)

App shell: `.ow-app` (+ state modifiers, see §11), map `.ow-map`, vignette `.ow-app::after`.

### 6.1 Top bar — `.ow-topbar`
Floating frosted bar, `justify-content: space-between`, pointer-events pass through except children.
- **Brand** `.ow-brand` → `.ow-brand__dot` (glowing gold dot), `.ow-brand__name` ("We Were Here", serif italic), `.ow-brand__sub` ("Bản đồ ký ức").
- **Right cluster** `.ow-topright` (wraps). Contains:
  - **Stats** `.ow-stats` → repeated `.ow-stat` → `.ow-stat__n` (number, serif) + `.ow-stat__l` (label). Labels: "kỷ niệm", "tỉnh thành", "ảnh".
  - **On This Day** `.ow-otd` → `.ow-otd__dot` (pulsing), `.ow-otd__k` ("Ngày này"), `.ow-otd__v` ("{N} năm trước · {city}").
  - **Route toggle** `.ow-pillbtn` (+`.ow-pillbtn--on` when active) — icon + "Tuyến đường".
  - **Unplaced** `.ow-unplaced-btn` (admin) — "📍 Chưa định vị **N**".
  - **Menu** `.ow-menu` → button `.ow-pillbtn.ow-iconbtn`; popup `.ow-menu__pop` with `.ow-menu__backdrop`; items `.ow-menu__item` (Import ảnh [admin], Khuôn mặt, Nhạc [admin], Đăng xuất `.ow-menu__item--logout`).

### 6.2 Timeline — `.ow-tlbar`
- Head `.ow-tl-head`: clock icon, `.ow-tl-title` ("Dòng thời gian"), `.ow-tl-sep` ("·"), `.ow-tl-range` ("2024 – 2026"), spacer `.ow-tl-spacer`, play `.ow-tl-play` ("▶ Chuyến đi"), base toggle `.ow-tl-base` (🗺️/🛰️), zoom `.ow-tl-zoom` (− / +). (`.ow-tl-back` exists in CSS, legacy.)
- Track `.ow-tlbar__track` → `.ow-tlbar__inner` (time-proportional width).
  - Axis line `.ow-tl-axis`; first-year tick `.ow-tltick`/`.ow-tltick__label`.
  - Year divider `.ow-tlyear` → `.ow-tlyear__line` (dashed) + `.ow-tlyear__chip` ("🎆 2025").
  - **Bead** `.ow-tlbead` (+`--active`, +`--placing`) → `.ow-tlbead__thumb` (cover photo circle) + `.ow-tlbead__label` (day/month, e.g. "4/7"). Active bead is bigger with a gold gradient ring; placing beads get a dashed outline.
  - Empty state `.ow-tlempty` ("Chưa có kỷ niệm nào — hãy import ảnh.").
  - Legacy timeline-vehicle hook `.ow-tlvehicle` exists (the vehicle currently rides the MAP, not the timeline — see §7 note).
- **Layout math:** beads positioned by time, but with a **minimum gap of 58 px** so clustered trips never overlap; year dividers placed at the midpoint between beads whose year changes.

### 6.3 Memory card — `.ow-card`
Cover `.ow-card__coverwrap` → `.ow-card__cover` (click = zoom/Lightbox) + `.ow-card__coverfade` + `.ow-card__close` (✕) + `.ow-card__placebadge` ("📍 City, Country"). Body `.ow-card__body`:
- Title row `.ow-card__titlerow` → `.ow-card__title` + edit button `.ow-card__edit` (✎); edit inputs `.ow-card__title-input` / `.ow-card__desc-input`.
- Date `.ow-card__date` ("📅 22 Tháng 6, 2024").
- Description `.ow-card__desc` (serif italic story) + `.ow-card__edithint` ("Nhấn để sửa mô tả").
- **Place chips** `.ow-placechips` → `.ow-placechip` (img + name) — horizontal scroll of the trip's places.
- Album head `.ow-album-head` + `.ow-album-tools` with `.ow-minibtn` (+`--on`): "✎ Sửa" toggles edit mode, "➕ Thêm ảnh".
- Gallery `.ow-gallery` → `.ow-gcell` → img + (edit mode) `.ow-gcell__acts` with ★ and `.ow-gcell__del` (🗑).
- Ride button `.ow-card__ride` (start the small journey for this trip).
- Actions `.ow-card__actions` (+`.ow-danger` for delete).
Empty/edit states must be designed.

### 6.4 Journey controls — `.ow-journey` (two instances)
Rendered per journey: **big** `.ow-journey--big`, **small** `.ow-journey--small` (rose, scaled, sits above the big one). Each: `.ow-journey__badge` (+`__badge-ic`) ("Mốc lớn · Chuyến đi" / "Mốc nhỏ · Trong chuyến"), `.ow-journey__exit` ("✕ Thoát"), `.ow-journey__mute` (🎵/🔇), `.ow-journey__center` → `.ow-journey__step` ("Chặng X / Y · chạm timeline để tới chặng khác") + `.ow-journey__status` (current or "Đang đến {next}"), and either `.ow-journey__next` ("Tiếp →" / "Kết thúc") or `.ow-journey__moving` ("Đang đi…"). Plus the **mobile detail toggle** `.ow-jdetail-btn` ("▸ Chi tiết" / "▾ Ẩn chi tiết").

### 6.5 Map layers (Leaflet)
- **Vehicle** divIcon `.ow-veh` → `.ow-bob` (idle bob) wrapping the vehicle SVG (`iconSize 78×50`, anchor 39,28). FX layer `.ow-fx` holds smoke/cloud puff nodes.
- Trip markers: cover-thumbnail circle divIcon (44×44). Cluster bubble (52×52, gold gradient, shows count). Place markers: `.ow-placemk` (36×36, active state when selected).
- Route polylines: big = gold `#e9b872` dashed; small = rose `#d98695` dashed.
- Base layers: satellite (Esri World Imagery + boundaries/places reference overlay) OR light (CARTO Voyager).

### 6.6 Modals & overlays
- Face cropper: `.ow-modal` / `.ow-modal__box` / `.ow-faces` / `.ow-faceslot` / `.ow-faceslot__preview` / `.ow-crop*` (240 px canvas, 100 px circular crop, drag + zoom range → PNG data-URL).
- Music: `.ow-modal__box` / `.ow-tracklist` / `.ow-track`(+`--active`) / `.ow-track__pick` / `.ow-track__name` / `.ow-track__upload` / `.ow-empty`.
- Unplaced: `.ow-modal__box--wide` / `.ow-unplaced-grid` / `.ow-unplaced-cell`(+`--sel`) / `.ow-unplaced-check` / `.ow-unplaced-actions`; placing banner `.ow-placing` / `.ow-placing__dot` (portaled to `<body>` to escape the top bar's backdrop-filter containing block).
- Upload toast: `.ow-uptoast` (page-level).
- Lightbox: `.ow-lightbox` / `__img` / `__top` / `__topacts` / `__counter` / `__btn` / `__arrow`(`--l`/`--r`).
- Login: `.ow-login`.

---

## 7. Journey mechanics (behavioral truth — restyle the feel, keep the shape)

Two independent Zustand stores (`journeyStore.ts`): `useBigJourney` (mode `trips`) and `useSmallJourney` (mode `places`). Shared `useFaces`. State per journey: `playing, stops[], index, target, phase ('paused'|'moving'), progress`.

- **Start:** "Chuyến đi" prefetches all trip details (cached), builds big stops (trips sorted by time), `start()` → playing, index 0, paused.
- **Auto small:** when the big journey pauses on a trip whose cached detail has **>1 places**, the small journey auto-starts to tour those places. Only one vehicle is drawn at a time — the small journey owns it while it plays.
- **Advance:** `next()` → `phase='moving', target=index+1`. On animation end, `arrive()` → `index=target`, paused.
- **Jump / "travel to":** tapping a timeline bead calls `travelTo(i)` → `phase='moving', target=i` → the vehicle animates **from the current stop directly to stop i** (may be far). This replaced an earlier numeric picker. (Design the timeline so it clearly reads as the journey selector during play.)
- **Camera** (owned exclusively by the journey while playing — see §8):
  - *Paused:* `flyTo(stop, STOP_ZOOM)` — STOP_ZOOM = **15** (big) / **16** (small, street level).
  - *Moving:* `flyToBounds(from→to, { maxZoom: 16, paddingTopLeft:[leftPad, ≥90], paddingBottomRight:[padX, ≥190] })` — frames both endpoints and stays static while the vehicle slides across (this was intentional to avoid tile-thrash lag; do NOT design a continuous follow-cam).
  - `padFor`: padX/padY = 22% of viewport; leftPad = padX on mobile, ≥430 px on desktop (to keep the vehicle clear of the left-docked card).
- **Motion:** vehicle tween ≈ 2.6 s + up to ~2.4 s more for far legs; ease-in-out; idle bob (`owBob`). FX: smoke puffs (bike/car, `owSmoke`) / clouds (plane, `owCloud`) spawn from the rear, drift back-up-fade; **only during "moving."**
- **Vehicle choice by leg distance** (`vehicleForDistance`): **bike < 25 km, car < 250 km, plane ≥ 250 km.**
- **Music:** shared soundtrack; `startMusic()` plays the active uploaded track (looped, vol 0.7) or, if none, a generated WebAudio arpeggio (C–G–Am–F, triangle osc, soft delay); mute toggle; stops when both journeys stop.
- **Faces** composited into the vehicle's two circular slots (see §12).
- *Note:* `.ow-tlvehicle` (a timeline-riding vehicle) exists in CSS but the current build rides the **map** vehicle only; the timeline shows an active-bead highlight instead. If you want the twin timeline-vehicle back, call it out.

---

## 8. Camera ownership & tap-safety (don't regress)
While **any** journey plays, the journey controller owns the camera. Therefore: map **marker taps and focus changes are ignored during a journey** (`FocusController` early-returns; marker click handlers bail). This fixed a bug where a stray tap yanked the camera and "threw the user out" of the journey. Keep this: during play, only the timeline beads (travelTo), Tiếp, Thoát, mute, and the detail toggle are interactive.

---

## 9. Placing / unplaced flow (attach photos to a mốc)
`startPlacing(ids)` sets `placingPhotoIds`. While placing, four drop targets all attach the whole selection:
- **Empty map point** → `POST /api/photos/:id/locate {lat,lng}` → geocode + auto-cluster.
- **Trip marker** (map) or **timeline bead** → `locate {tripId}` → joins the trip's nearest-in-time place (or creates one).
- **Place marker** (map, level 2) → `locate {memoryId}` → adds straight into that place.
After attach, the app refreshes (a `window 'ow:refresh'` event). Beads show a dashed `--placing` hint. Banner is portaled to `<body>`.

---

## 10. Design tokens (current — please refine, keep the names)
From `:root` in `globals.css`:
```
--ink:#0e1410            /* map/page bg */
--surface:rgba(16,22,18,.62)      --surface-solid:rgba(20,26,21,.9)
--line:rgba(240,235,220,.14)
--cream:#f4ebe2 (text)  --muted:#b7c2b8  --muted-2:#8d978c
--gold:#e9b872 (accent) --rose:#d98695 (accent 2)
--shadow:0 12px 30px rgba(0,0,0,.4)   --shadow-lg:0 30px 70px rgba(0,0,0,.55)
--serif: Spectral/Georgia    --sans: Be Vietnam Pro/system-ui
--topbar-h:60px   --tlbar-h:150px (→116px on mobile)
```
Gradients heavily used: `linear-gradient(135deg, var(--gold), var(--rose))` for primary buttons/active states. Motion keyframes: `owBob, owSmoke, owCloud, wwhUp, wwhFade, wwhPulse`.
**Please deliver:** refined palette (primary/accent/surface-glass/text/success-danger + a visited-province gold if you propose the scratch overlay), a type scale (serif headings vs sans body, sizes/weights, Vietnamese-diacritic-safe fonts), radii scale, shadow scale, spacing rhythm, and motion specs. It must stay legible over satellite imagery (glass panels need enough opacity/contrast).

---

## 11. Responsive — the big ask (current state + what to design)

**Only breakpoint today:** `@media (max-width: 767px)`. Desktop is the unmediated base. We want a **complete responsive system** (propose breakpoints, e.g. phone / tablet / desktop / wide) covering every state below. The app toggles **layout via body/root state classes** — design each:

- `.ow-app` — base (desktop): card is a **left drawer** (`.ow-card` top:92px, width 400px); timeline is a centered bar bottom:18px; journey controls float centered above the timeline; top bar full (brand + all chips).
- `.ow-app--journey` — a journey is playing. **Mobile:** top bar hidden; card hidden; timeline becomes a **compact strip** (head hidden, `bottom:74px`, shorter track) so its beads stay tappable as the stop selector; journey control bar docks at `bottom:10px`; the **"▸ Chi tiết" toggle** (`.ow-jdetail-btn`) docks **top-center**. **Desktop:** timeline + controls both visible as normal (no hiding).
- `.ow-app--smalljourney` — a *place* (small) journey is active. **Mobile:** the big-trip timeline strip is hidden (the small ride doesn't use it).
- `.ow-app--jdetail` — the mobile detail sheet is open during a journey: `.ow-card` becomes a **top sheet** (`top:52px`, `max-height:46vh`, scrolls) under the toggle. (`.ow-jdetail-btn` is `display:none` on desktop — the card is always visible there.)

**Current mobile specifics to preserve/redesign:**
- Top bar: brand `flex-shrink:0` (never covered), right chips **wrap** to a new row; `.ow-stat__l` labels hidden (number-only); `.ow-otd` hidden; route button icon-only; unplaced/menu compacted.
- Memory card: **bottom sheet** (full width, `max-height:62vh`, rounded top, grabber handle via `.ow-card::before`).
- Journey bars: slim single row; badges/mute hidden; small bar stacks at `bottom:66px`.
- Modals go near-full-width; unplaced grid → 3 columns (4 on desktop); lightbox arrows smaller.

**We want the designer to:** (1) make the phone layout genuinely great (this is the primary device and has been the pain point), (2) define tablet behavior (currently falls into desktop — likely wrong), (3) keep desktop's left-drawer card but make it feel intentional, (4) ensure every state class above has a clean, non-overlapping layout at each breakpoint. Deliverables should include mobile + tablet + desktop mockups for: main map, a journey stop (both with and without the detail sheet), the memory card, and the placing/unplaced flow.

---

## 12. Vehicle artwork (please draw — SVG)
Three vehicles chosen by leg distance (bike/car/plane, thresholds in §7). Built in `src/components/vehicles.ts`, `viewBox="0 -6 72 52"` (6 units of top headroom so faces don't clip), `overflow:visible`, faces right (mirrored in code for leftward travel — keep faces mirror-readable). Two **circular face slots** per vehicle (couple's cropped PNG faces composite in), current coords:
- **bike:** A `(cx23, cy11, r11)`, B `(cx48, cy10, r11)`
- **car:** A `(cx25, cy13, r11)`, B `(cx47, cy13, r11)`
- **plane:** A `(cx28, cy18, r9.5)`, B `(cx46, cy18, r9.5)`
Provide: clean cute SVGs for each; a **default face** (used when no photo is set); **FX shapes** — smoke puffs (bike/car) and clouds (plane) as separate animatable nodes with keyframes (drift `--dx`, rise, fade; cadence ~140 ms bike/car, ~240 ms plane); optional idle bob/wheel-spin. Keep the palette + cute-but-tasteful tone. You may adjust slot coords/viewBox — just document the new anchors/size.

---

## 13. Deliverables checklist
1. Design-system doc (tokens/hex/px, type, spacing, radii, shadows, motion).
2. Per-component redlines keyed to the class names in §6.
3. **Responsive system** across §11 states + breakpoints, with mobile/tablet/desktop mockups.
4. Vehicle SVGs (3) + default face + FX shapes (§12).
5. Optional: proposal for the visited-province "scratch" overlay (currently unbuilt).

## 14. Out of scope (keep as-is)
Data model, clustering, journey/camera logic, upload/worker pipeline, geocoding, auth. This is **visual + layout + responsive**; keep every documented behavior and reachable state — restyle and re-lay-out, don't rip out functionality.
