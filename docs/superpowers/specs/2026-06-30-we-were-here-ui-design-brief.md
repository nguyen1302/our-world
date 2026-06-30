# "We Were Here" — UI/UX Design Brief

> **For the design agent:** Produce a cohesive visual design (color system, typography, spacing, per-component redlines, and vehicle artwork). Output should map to the existing CSS variables + class names listed here so the engineer can implement it directly. You don't need to write code — describe values (hex, px, radii, shadows, font sizes/weights) and provide SVG artwork for the vehicles. Mockups (PNG/Figma/ASCII) welcome.

## 1. What the product is
A private "memory map" for a couple. A satellite map of Vietnam (iPhone-Find style) with photo "memories" pinned as markers. A bottom **timeline axis** of memory beads. A **Play** mode replays the journey: a little vehicle drives stop-to-stop on both the map and the timeline, pausing at each memory to show its photos. Tone: **romantic, warm, cute, nostalgic — but tasteful and modern, not childish or cluttered.**

The current implementation works but the visual design is weak (engineer's words: monotone, layout not quite right, vehicles too plain). We want a designer to elevate it.

## 2. Hard constraints (must design within these)
- **Basemap is satellite imagery** (greens, earth, blue water) with a place-label overlay. UI chrome floats on top of this, so panels need enough contrast/legibility over busy imagery.
- **Map library is Leaflet.** Markers, popups, polylines are Leaflet primitives we style via CSS/divIcons.
- **Mobile-first matters** (used on iPhone Safari). Must be fully responsive; primary device is a phone.
- Keep it **lightweight** (no heavy image assets that hurt load; SVG/CSS preferred). Works offline-ish.
- Name shown in UI: **"We Were Here ♥"**.

## 3. Current screens & components (with the class names to redline)
Screenshots in repo root: `ow3-desktop.png`, `ow3-mobile.png`, `ow6-journey.png` (current state).

| Component | Class hooks | Notes / current problems |
|---|---|---|
| App shell | `.ow-app`, `.ow-map` | full-screen map behind floating UI |
| Top bar | `.ow-topbar`, `.ow-brand` | brand + stats + play + menu in one frosted bar; feels generic |
| Stat chips | `.ow-stats`, `.ow-stat`, `.ow-stat__i/__n/__l` | 💛 kỷ niệm / 🖼️ ảnh / 📍 tỉnh / 🌏 quốc gia. On mobile only icon+number show |
| Play button | `.ow-play` | starts journey |
| Menu | `.ow-menu`, `.ow-menu__btn`, `.ow-menu__pop`, `.ow-menu__item` | import / route toggle / faces / logout |
| On This Day | `.ow-onthisday`, `.ow-onthisday__badge/__item` | banner for same-day past-year memories |
| Timeline bar | `.ow-tlbar`, `.ow-tlbar__track`, axis line `::before` | bottom "x-axis" |
| Timeline node | `.ow-tlnode`, `.ow-tlnode__thumb`, `.ow-tlnode__labels/__date/__title`, `.ow-tlyear` | circular photo bead on the axis; date (+title on desktop) below; year chips floating above |
| Memory card | `.ow-card`, `.ow-card__title/__meta/__date/__place/__desc`, `.ow-gallery`, `.ow-card__actions` | right drawer; opens at each stop |
| Markers | `.ow-pin2`, `.ow-pin2--active` | circular cover-thumbnail with ring |
| Preview popup | `.ow-pop`, `.ow-pop__img/__t/__hint` | bubble shown when previewing from timeline |
| Journey controls | `.ow-journey`, `.ow-journey__exit/__mute/__count/__next` | floating pill while playing |
| Vehicles | built in `src/components/vehicles.ts` as SVG | **needs full art redesign** (see §6) |
| Face modal | `.ow-modal`, `.ow-faces`, `.ow-faceslot`, `.ow-crop` | crop two faces to put on the vehicle |
| Login | `.ow-login` | |

## 4. Design tokens to (re)define
Currently in `src/app/globals.css` `:root`. Please give us a refined set (keep names, change values as needed):
`--blue, --blue-soft, --sky, --amber, --amber-soft, --honey, --ink, --muted, --line, --glass, --shadow`.

Direction we want (not binding — improve it): soft, harmonious, warm. Earlier attempts with saturated amber `#f59e0b` + strong blue `#2563eb` clashed. We currently use softer honey `#e0a13c` + muted blue `#2d6cdf` over satellite. **Please propose a palette that feels cute + premium and reads well on satellite imagery.** Specify: primary, accent, surface/glass, text, success/danger, and the visited-province "scratch" gold.

Also specify: **typography** (we currently use system sans; suggest a web-safe or lightweight Google font for headings vs body, with sizes/weights), **radii scale**, **shadow scale**, **spacing rhythm**.

## 5. Component-level asks
- **Top bar / layout:** make the hierarchy feel intentional. Brand should feel like a logo (maybe a small mark + wordmark). Decide what belongs in the bar vs the menu on mobile vs desktop. Consider a subtle logo heart/pin mark.
- **Timeline:** the centerpiece. Make the beads + axis feel delightful (hover/active states, the "current" bead, year separators). Keep it readable on mobile (labels overlap was a past bug — date-only on mobile is fine).
- **Memory card:** a warm "memory" feel — date chip, place, photo gallery grid, description as a little story. Define empty states.
- **On This Day:** a small moment of delight (a tasteful sparkle/heart), not gaudy.
- **Markers & preview popup:** cute pin treatment for cover-photo markers; clear active state; nice popup card.
- **Journey controls:** a friendly "now playing" pill (progress, mute, next, exit).
- **Micro-interactions:** specify gentle motion (bead bob, marker drop-in, card slide, button hover lift). Keep performant.

## 6. Vehicle artwork (important — please draw these)
The journey vehicle changes by segment distance: **motorbike (<25km), car (<250km), airplane (≥250km)**. We need **cute, characterful SVG artwork** for each, side-view, facing right (we mirror in code for leftward travel). Requirements:
- Each vehicle has **two circular "face slots"** (cx, cy, r) where the couple's cropped face photos are composited (riders on the bike, two windows in car/plane). Provide exact slot coordinates in the SVG viewBox.
- Provide a **default cute face** (when no photo set).
- Design **motion FX**: exhaust **smoke puffs** for bike/car and **clouds** for the plane, as separate elements we can animate (give us the shapes + suggested keyframe motion: drift, rise, fade).
- Deliver as clean SVG (viewBox ~`0 0 72 46`, but you may resize — just tell us the anchor/size). Style should match the palette and the cute tone.
- Bonus: a tiny idle bob/wheel-spin suggestion.

## 6b. Journey movement (the motion the artwork lives in)
This is how the vehicle actually moves — design the FX/timing to fit it.

**Replay flow.** User taps ▶ Play. The journey visits memories in chronological order, stop by stop. At each stop it **pauses** (map zoomed into that memory, detail card open, music playing); user taps **Tiếp →** to go to the next stop, or **✕ Thoát** to quit. So motion happens only during the "moving" phase between two stops.

**Per-segment motion (current implementation — restyle the feel, keep the shape):**
1. **Zoom out** to frame both the current and next stop (`flyToBounds`, gentle easing). The farther apart, the more it zooms out. This was added to fix lag — do NOT design a continuous pan that follows the vehicle while zoomed in.
2. **Travel:** while the map sits still (framed), the vehicle slides along a straight line from stop A to stop B (~2.6s + longer for far segments). The same motion mirrors on the **timeline axis**: a matching vehicle glides from bead A to bead B in sync (progress 0→1).
3. **Zoom in** to the arrival stop and pause.

**What the designer controls / should specify:**
- The **vehicle facing**: artwork faces right; we mirror horizontally for leftward travel. Make sure faces/details still read when mirrored (or give a mirror-safe design).
- **FX during travel only**: smoke puffs (bike/car) / clouds (plane) emit from the rear and drift back + up + fade. Give keyframes (duration, easing, opacity, spawn cadence). FX should stop when paused.
- **Speed feel**: suggest easing for the travel tween (e.g., ease-in-out vs linear) and whether the vehicle should bob/tilt slightly.
- **Map ↔ timeline sync**: both vehicles share one 0→1 progress; design both so they feel like the same trip.
- **Transitions** for the camera zoom-out/in (we use ~1.4–1.6s) — advise if a different pacing feels better, but keep it lag-safe (shallower zoom = fewer satellite tiles = smoother).

Hooks: map vehicle is a Leaflet divIcon built in `src/components/WorldMap.tsx` (`JourneyController`); timeline vehicle is `.ow-tlvehicle` in `TimelineBar.tsx`; controls are `.ow-journey*`.

## 7. Deliverables
1. A **design system** doc: tokens (hex/px), typography, spacing, radii, shadows, motion.
2. **Per-component redlines** (reference the class names in §3) — enough for the engineer to translate to CSS.
3. **Vehicle SVGs** (3) + default face + FX shapes (§6).
4. Optional: mockups for desktop + mobile of the main map view, a journey stop, and the memory card.

## 8. Out of scope
Functionality/behavior is built and fine — this brief is **visual/UX only**. Don't redesign data flows, the map library, or the journey logic; restyle what's there.
