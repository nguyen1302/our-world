"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { useMapStore, type MemoryMarker } from "./mapStore";

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

function FocusController() {
  const map = useMap();
  const focus = useMapStore((s) => s.focus);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.7 });
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
          color: visited ? "#2563eb" : "#cbd5e1",
          weight: visited ? 1.1 : 0.5,
          fillColor: visited ? "#3b82f6" : "#94a3b8",
          fillOpacity: visited ? 0.22 : 0.03,
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
    <MapContainer center={VN_CENTER} zoom={VN_ZOOM} className="ow-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {geo ? <ScratchOverlay /> : null}
      {showRoute && routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: "#2563eb", weight: 2.5, opacity: 0.7, dashArray: "2 8", lineCap: "round" }} />
      ) : null}
      <ClusterLayer memories={memories} />
      <PreviewController />
      <FocusController />
    </MapContainer>
  );
}
