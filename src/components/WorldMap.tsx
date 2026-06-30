"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { useMapStore, type MemoryMarker } from "./mapStore";
import { useJourney, vehicleForDistance, haversineKm } from "./journeyStore";
import { vehicleSvg, type VehicleType } from "./vehicles";

const VN_CENTER: [number, number] = [16.0, 107.8];
const VN_ZOOM = 6;

function thumbIcon(m: MemoryMarker, active: boolean): L.DivIcon {
  const bg = m.coverThumbUrl ? `background-image:url('${m.coverThumbUrl}')` : "";
  return L.divIcon({
    className: "ow-pin2-wrap",
    html: `<div class="ow-pin2 ${active ? "ow-pin2--active" : ""}" style="${bg}"></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function ClusterLayer({ memories }: { memories: MemoryMarker[] }) {
  const map = useMap();
  const open = useMapStore((s) => s.open);
  const previewId = useMapStore((s) => s.previewId);
  const selectedId = useMapStore((s) => s.selectedId);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({ maxClusterRadius: 50, showCoverageOnHover: false });
    for (const m of memories) {
      const active = m.id === previewId || m.id === selectedId;
      const marker = L.marker([m.lat, m.lng], { icon: thumbIcon(m, active) });
      marker.on("click", () => open(m.id));
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, memories, previewId, selectedId, open]);

  return null;
}

function PreviewController() {
  const map = useMap();
  const memories = useMapStore((s) => s.memories);
  const previewId = useMapStore((s) => s.previewId);
  const selectedId = useMapStore((s) => s.selectedId);
  const open = useMapStore((s) => s.open);

  useEffect(() => {
    // Only a timeline preview (no detail open yet) shows the bubble.
    if (!previewId || previewId === selectedId) return;
    const m = memories.find((x) => x.id === previewId);
    if (!m) return;
    const cover = m.coverThumbUrl
      ? `<div class="ow-pop__img" style="background-image:url('${m.coverThumbUrl}')"></div>`
      : `<div class="ow-pop__img ow-pop__img--empty">♥</div>`;
    const popup = L.popup({ closeButton: false, className: "ow-pop", offset: [0, -18] })
      .setLatLng([m.lat, m.lng])
      .setContent(
        `<div class="ow-pop__inner" data-id="${m.id}">${cover}` +
          `<div class="ow-pop__t">${m.title}</div>` +
          `<div class="ow-pop__hint">Bấm vào mốc để xem chi tiết →</div></div>`,
      )
      .openOn(map);
    const el = popup.getElement()?.querySelector(".ow-pop__inner");
    el?.addEventListener("click", () => open(m.id));
    return () => {
      map.closePopup(popup);
    };
  }, [map, memories, previewId, selectedId, open]);

  return null;
}

function orderedStops(memories: MemoryMarker[]): MemoryMarker[] {
  return [...memories].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

function segVehicle(stops: MemoryMarker[], i: number): VehicleType {
  const a = stops[i];
  const b = stops[i + 1];
  if (!a || !b) return "bike";
  return vehicleForDistance(haversineKm(a, b));
}

/** Drives the journey camera + vehicle on the map: zoom-out to frame the segment,
 *  move the vehicle on the static map, then zoom-in to the arrival stop. */
function JourneyController() {
  const map = useMap();
  const memories = useMapStore((s) => s.memories);
  const setSelected = useMapStore((s) => s.setSelected);
  const playing = useJourney((s) => s.playing);
  const phase = useJourney((s) => s.phase);
  const index = useJourney((s) => s.index);
  const faces = useJourney((s) => s.faces);
  const setProgress = useJourney((s) => s.setProgress);
  const arrive = useJourney((s) => s.arrive);

  const stops = useMemo(() => orderedStops(memories), [memories]);
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function place(lat: number, lng: number, type: VehicleType, flip: boolean) {
    const html = vehicleSvg(type, faces, { flip, size: 66, id: "mapv" });
    const icon = L.divIcon({ className: "ow-vehicle", html, iconSize: [66, 42], iconAnchor: [33, 30] });
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
    } else {
      markerRef.current.setIcon(icon);
      markerRef.current.setLatLng([lat, lng]);
    }
  }

  useEffect(() => {
    if (!playing && markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [playing, map]);

  useEffect(() => {
    if (!playing || stops.length === 0) return;
    const cancel = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    if (phase === "paused") {
      const s = stops[index];
      if (!s) return;
      setSelected(s.id);
      map.flyTo([s.lat, s.lng], index === 0 ? 11 : 12, { duration: 1.4, easeLinearity: 0.2 });
      place(s.lat, s.lng, segVehicle(stops, Math.max(0, index - 1)), false);
      return;
    }

    // moving: index -> index+1
    setSelected(null);
    const from = stops[index];
    const to = stops[index + 1];
    if (!to) return;
    const km = haversineKm(from, to);
    const type = vehicleForDistance(km);
    const flip = to.lng < from.lng;

    map.flyToBounds(L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]), {
      paddingTopLeft: [80, 130],
      paddingBottomRight: [400, 170],
      maxZoom: 10,
      duration: 1.5,
      easeLinearity: 0.2,
    });
    place(from.lat, from.lng, type, flip);

    timerRef.current = setTimeout(() => {
      const dur = 2600 + Math.min(km * 3, 2600);
      const startTs = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - startTs) / dur);
        setProgress(p);
        markerRef.current?.setLatLng([from.lat + (to.lat - from.lat) * p, from.lng + (to.lng - from.lng) * p]);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
        else arrive();
      };
      rafRef.current = requestAnimationFrame(step);
    }, 1600);

    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, index, stops, faces, map]);

  return null;
}

function FocusController() {
  const map = useMap();
  const focus = useMapStore((s) => s.focus);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1.1, easeLinearity: 0.25 });
  }, [map, focus]);
  return null;
}

function ScratchOverlay() {
  const scratchCodes = useMapStore((s) => s.scratchCodes);
  const set = new Set(scratchCodes);
  return (
    <GeoJSON
      key={scratchCodes.slice().sort().join(",")}
      data={(globalThis as any).__VN_GEO__}
      style={(feature) => {
        const visited = feature && set.has(feature.properties.code);
        return {
          color: visited ? "#f3b14e" : "#ffffff",
          weight: visited ? 1.4 : 0.4,
          fillColor: "#f3b14e",
          fillOpacity: visited ? 0.28 : 0,
        };
      }}
    />
  );
}

export default function WorldMap({ geo }: { geo: unknown }) {
  const memories = useMapStore((s) => s.memories);
  const showRoute = useMapStore((s) => s.showRoute);

  (globalThis as any).__VN_GEO__ = geo;

  const routePoints = memories
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((m) => [m.lat, m.lng] as [number, number]);

  return (
    <MapContainer
      center={VN_CENTER}
      zoom={VN_ZOOM}
      className="ow-map"
      scrollWheelZoom
      preferCanvas
      zoomControl
    >
      {/* Satellite imagery (like the iPhone Find map) + a place-label overlay */}
      <TileLayer
        attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        keepBuffer={6}
        updateWhenZooming={false}
        updateWhenIdle
      />
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
        pane="overlayPane"
        keepBuffer={6}
        updateWhenZooming={false}
        updateWhenIdle
      />
      {geo ? <ScratchOverlay /> : null}
      {showRoute && routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: "#ffd98a", weight: 3, opacity: 0.9, dashArray: "2 9", lineCap: "round" }} />
      ) : null}
      <ClusterLayer memories={memories} />
      <PreviewController />
      <FocusController />
      <JourneyController />
    </MapContainer>
  );
}
