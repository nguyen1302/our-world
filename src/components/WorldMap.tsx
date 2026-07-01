"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster";
import { useMapStore } from "./mapStore";
import { useBigJourney, useSmallJourney, useFaces, vehicleForDistance, haversineKm } from "./journeyStore";
import { vehicleSvg, type VehicleType } from "./vehicles";

const VN_CENTER: [number, number] = [16.2, 107.2];
const VN_ZOOM = 6;
const GOLD = "#e9b872";
const ROSE = "#d98695";

function markerHtml(cover: string | null, active: boolean, size = 44): string {
  const glow = active ? `0 6px 20px rgba(0,0,0,.6),0 0 24px ${GOLD}` : `0 4px 14px rgba(0,0,0,.6),0 0 16px ${GOLD}66`;
  return (
    `<div class="wwh-mk"><div class="wwh-mk-inner" style="width:${size}px;height:${size}px;border-radius:50%;padding:2px;` +
    `background:linear-gradient(135deg,${GOLD},${ROSE});box-shadow:${glow};transform:scale(${active ? 1.32 : 1})">` +
    `<img src="${cover ?? ""}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;border:2px solid #11160F;"></div></div>`
  );
}

function padFor(map: L.Map) {
  const sz = map.getSize();
  const padX = Math.round(sz.x * 0.22);
  const padY = Math.round(sz.y * 0.22);
  const leftPad = sz.x < 768 ? padX : Math.max(padX, 430);
  return { padX, padY, leftPad };
}

function MarkersLayer() {
  const map = useMap();
  const memories = useMapStore((s) => s.memories);
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const tripDetail = useMapStore((s) => s.tripDetail);
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const requestEnterTrip = useMapStore((s) => s.requestEnterTrip);
  const selectPlace = useMapStore((s) => s.selectPlace);

  const level2 = !!focusedTripId && !!tripDetail;

  useEffect(() => {
    // Big mốc = trip markers (always shown, even while riding inside a trip).
    const tripGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 46,
      showCoverageOnHover: false,
      iconCreateFunction: (c: any) =>
        L.divIcon({
          className: "",
          iconSize: [52, 52],
          html:
            `<div style="width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;` +
            `background:radial-gradient(circle at 32% 28%, ${GOLD}, ${ROSE});color:#1a1310;font-family:var(--serif);font-weight:600;font-size:20px;` +
            `box-shadow:0 0 0 6px ${GOLD}29,0 8px 24px rgba(0,0,0,0.55);">${c.getChildCount()}</div>`,
        }),
    });
    for (const m of memories) {
      const marker = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ className: "", iconSize: [44, 44], iconAnchor: [22, 22], html: markerHtml(m.coverThumbUrl, m.id === focusedTripId, 44) }),
      });
      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        requestEnterTrip(m.id);
      });
      tripGroup.addLayer(marker);
    }
    map.addLayer(tripGroup);

    // Small mốc = place markers of the current trip, overlaid on top (not clustered).
    let placeGroup: L.LayerGroup | null = null;
    if (level2) {
      placeGroup = L.layerGroup();
      for (const p of tripDetail!.places) {
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "ow-placemk", iconSize: [36, 36], iconAnchor: [18, 18], html: markerHtml((p.coverPhotoId ? p.photos.find((x) => x.id === p.coverPhotoId) : null)?.thumbUrl ?? p.photos[0]?.thumbUrl ?? null, p.id === selectedPlaceId, 36) }),
          zIndexOffset: 500,
        });
        marker.on("click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          selectPlace(p.id);
        });
        placeGroup.addLayer(marker);
      }
      map.addLayer(placeGroup);
    }

    return () => {
      map.removeLayer(tripGroup);
      if (placeGroup) map.removeLayer(placeGroup);
    };
  }, [map, memories, tripDetail, focusedTripId, selectedPlaceId, level2, requestEnterTrip, selectPlace]);

  return null;
}

function FocusController() {
  const map = useMap();
  const focusPoint = useMapStore((s) => s.focusPoint);
  const focusBounds = useMapStore((s) => s.focusBounds);

  useEffect(() => {
    if (focusPoint) map.flyTo([focusPoint.lat, focusPoint.lng], focusPoint.zoom, { duration: 1.1, easeLinearity: 0.25 });
  }, [map, focusPoint]);

  useEffect(() => {
    if (!focusBounds) return;
    if (focusBounds.points.length === 0) {
      map.flyTo(VN_CENTER, VN_ZOOM, { duration: 1.1 });
      return;
    }
    const { padX, padY, leftPad } = padFor(map);
    map.flyToBounds(L.latLngBounds(focusBounds.points), {
      paddingTopLeft: [leftPad, Math.max(padY, 90)],
      paddingBottomRight: [padX, Math.max(padY, 190)],
      maxZoom: 15,
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [map, focusBounds]);

  return null;
}

// When "placing" a no-GPS photo, a map click assigns its location.
function PlacingLayer({ onPlaced }: { onPlaced: () => void }) {
  const placingPhotoIds = useMapStore((s) => s.placingPhotoIds);
  const cancelPlacing = useMapStore((s) => s.cancelPlacing);
  useMapEvents({
    async click(e) {
      if (placingPhotoIds.length === 0) return;
      const { lat, lng } = e.latlng;
      const ids = placingPhotoIds;
      cancelPlacing();
      // place all selected photos at the clicked spot
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/photos/${id}/locate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          }).catch(() => null),
        ),
      );
      onPlaced();
    },
  });
  return null;
}

function segVehicle(stops: { lat: number; lng: number }[], i: number): VehicleType {
  const a = stops[i];
  const b = stops[i + 1];
  if (!a || !b) return "bike";
  return vehicleForDistance(haversineKm(a, b));
}

// A single vehicle at any moment. The ACTIVE journey = small when it is playing
// (we're riding places inside a trip), otherwise the big journey. Only the active
// journey owns the vehicle + camera, so the two never fight and only one vehicle shows.
function JourneyController() {
  const map = useMap();
  const markPlace = useMapStore((s) => s.markPlace);
  const enterTripById = useMapStore((s) => s.enterTripById);
  const tripCache = useMapStore((s) => s.tripCache);
  const faces = useFaces((s) => s.faces);

  const bigPlaying = useBigJourney((s) => s.playing);
  const bigPhase = useBigJourney((s) => s.phase);
  const bigIndex = useBigJourney((s) => s.index);
  const bigStops = useBigJourney((s) => s.stops);
  const smallPlaying = useSmallJourney((s) => s.playing);
  const smallPhase = useSmallJourney((s) => s.phase);
  const smallIndex = useSmallJourney((s) => s.index);
  const smallStops = useSmallJourney((s) => s.stops);

  const markerRef = useRef<L.Marker | null>(null);
  const fxRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipRef = useRef(1);
  const autoTripRef = useRef<string | null>(null);

  useEffect(() => {
    const c = map.getContainer();
    const fx = document.createElement("div");
    fx.className = "ow-fx";
    c.appendChild(fx);
    fxRef.current = fx;
    return () => {
      fx.remove();
      fxRef.current = null;
    };
  }, [map]);

  function place(lat: number, lng: number, type: VehicleType, flip: boolean) {
    flipRef.current = flip ? -1 : 1;
    const svg = vehicleSvg(type, faces, { id: "mapv" });
    const html = `<div class="ow-bob" style="width:100%;height:100%;transform:scaleX(${flipRef.current})">${svg}</div>`;
    const icon = L.divIcon({ className: "ow-veh", html, iconSize: [78, 50], iconAnchor: [39, 28] });
    if (!markerRef.current) markerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
    else {
      markerRef.current.setIcon(icon);
      markerRef.current.setLatLng([lat, lng]);
    }
  }

  function spawnFX(lat: number, lng: number, type: VehicleType) {
    const fx = fxRef.current;
    if (!fx) return;
    const p = map.latLngToContainerPoint([lat, lng]);
    const left = flipRef.current === -1;
    const rx = p.x + (left ? 22 : -22);
    const ry = p.y + 8;
    const dx = left ? 30 : -30;
    const node = document.createElement("div");
    if (type === "plane") {
      node.style.cssText = `position:absolute;left:${rx}px;top:${ry}px;width:24px;height:15px;border-radius:13px;background:rgba(255,255,255,0.9);filter:blur(0.4px);--dx:${dx}px;animation:owCloud 1.6s ease-out forwards;`;
    } else {
      const s = 7 + ((p.x * 13) % 5);
      node.style.cssText = `position:absolute;left:${rx}px;top:${ry}px;width:${s}px;height:${s}px;border-radius:50%;background:rgba(238,230,218,0.62);--dx:${dx}px;animation:owSmoke 1.1s ease-out forwards;`;
    }
    node.addEventListener("animationend", () => node.remove());
    fx.appendChild(node);
  }

  const anyPlaying = bigPlaying || smallPlaying;
  useEffect(() => {
    if (!anyPlaying) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (fxRef.current) fxRef.current.innerHTML = "";
      autoTripRef.current = null;
    }
  }, [anyPlaying, map]);

  useEffect(() => {
    const cancel = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    if (!anyPlaying) return;

    // active journey: small takes over the vehicle whenever it is playing
    const isSmall = smallPlaying;
    const stops = isSmall ? smallStops : bigStops;
    const phase = isSmall ? smallPhase : bigPhase;
    const index = isSmall ? smallIndex : bigIndex;
    if (stops.length === 0) return;

    const STOP_ZOOM = isSmall ? 16 : 15; // arrive close (street level)

    if (phase === "paused") {
      const s = stops[index];
      if (!s) return;
      if (isSmall) markPlace(s.id);
      else {
        enterTripById(s.id);
        const d = tripCache[s.id];
        if (d && d.places.length > 1 && !smallPlaying && autoTripRef.current !== s.id) {
          autoTripRef.current = s.id;
          const placeStops = d.places.map((p) => ({ id: p.id, tripId: d.trip.id, lat: p.lat, lng: p.lng, title: p.placeName || p.title }));
          useSmallJourney.getState().start(placeStops);
        }
      }
      map.flyTo([s.lat, s.lng], STOP_ZOOM, { duration: 1.1, easeLinearity: 0.25 });
      place(s.lat, s.lng, segVehicle(stops, Math.max(0, index - 1)), false);
      return;
    }

    const from = stops[index];
    const to = stops[index + 1];
    if (!to) return;
    const km = haversineKm(from, to);
    const type = vehicleForDistance(km);
    const flip = to.lng < from.lng;

    // Frame BOTH endpoints (static during travel) so the destination is always
    // visible and the vehicle visibly crosses the screen. maxZoom caps how close
    // near hops get (so a short trip still shows a nice visible path).
    const bounds = L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]);
    const { padX, padY, leftPad } = padFor(map);
    map.flyToBounds(bounds, {
      paddingTopLeft: [leftPad, Math.max(padY, 100)],
      paddingBottomRight: [padX, Math.max(padY, 200)],
      maxZoom: 16, // near legs zoom in enough to spread the two points out
      duration: 1.2,
      easeLinearity: 0.25,
    });
    place(from.lat, from.lng, type, flip);

    timerRef.current = setTimeout(() => {
      const dur = 2600 + Math.min(km * 3, 2400);
      const startTs = performance.now();
      let lastSpawn = 0;
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const step = (now: number) => {
        const t = Math.min(1, (now - startTs) / dur);
        const e = ease(t);
        (isSmall ? useSmallJourney : useBigJourney).getState().setProgress(t);
        const lat = from.lat + (to.lat - from.lat) * e;
        const lng = from.lng + (to.lng - from.lng) * e;
        markerRef.current?.setLatLng([lat, lng]);
        if (now - lastSpawn > (type === "plane" ? 240 : 140)) {
          lastSpawn = now;
          spawnFX(lat, lng, type);
        }
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else (isSmall ? useSmallJourney : useBigJourney).getState().arrive();
      };
      rafRef.current = requestAnimationFrame(step);
    }, 1400); // let the frame-both fly finish before the vehicle sets off

    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyPlaying, bigPlaying, bigPhase, bigIndex, bigStops, smallPlaying, smallPhase, smallIndex, smallStops, faces, map]);

  return null;
}

export default function WorldMap({ onPlaced }: { onPlaced?: () => void }) {
  const memories = useMapStore((s) => s.memories);
  const showRoute = useMapStore((s) => s.showRoute);
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const tripDetail = useMapStore((s) => s.tripDetail);
  const base = useMapStore((s) => s.baseLayer);

  // big route (gold) = journey between trips
  const routePoints = useMemo(
    () =>
      [...memories]
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((m) => [m.lat, m.lng] as [number, number]),
    [memories],
  );
  // small route (rose) = journey between the current trip's places
  const placeRoutePoints = useMemo(() => {
    if (!focusedTripId || !tripDetail) return [];
    return [...tripDetail.places]
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((p) => [p.lat, p.lng] as [number, number]);
  }, [focusedTripId, tripDetail]);

  return (
    <MapContainer center={VN_CENTER} zoom={VN_ZOOM} className="ow-map" scrollWheelZoom zoomControl={false} preferCanvas zoomAnimation>
      {base === "satellite" ? (
        <>
          <TileLayer
            attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
            keepBuffer={8}
            updateWhenIdle
            updateWhenZooming={false}
            className="ow-tiles"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
            opacity={0.9}
            keepBuffer={8}
            updateWhenIdle
            updateWhenZooming={false}
            pane="overlayPane"
          />
        </>
      ) : (
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          keepBuffer={8}
          updateWhenIdle
          updateWhenZooming={false}
          className="ow-tiles"
        />
      )}
      {showRoute && routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: GOLD, weight: 2.4, opacity: 0.65, dashArray: "1 9", lineCap: "round" }} />
      ) : null}
      {showRoute && placeRoutePoints.length > 1 ? (
        <Polyline positions={placeRoutePoints} pathOptions={{ color: ROSE, weight: 2.6, opacity: 0.8, dashArray: "1 8", lineCap: "round" }} />
      ) : null}
      <MarkersLayer />
      <FocusController />
      <JourneyController />
      <PlacingLayer onPlaced={() => onPlaced?.()} />
    </MapContainer>
  );
}
