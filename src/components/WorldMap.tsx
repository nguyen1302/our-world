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
    <MapContainer center={VN_CENTER} zoom={VN_ZOOM} className="ow-map" scrollWheelZoom>
      {/* Satellite imagery (like the iPhone Find map) + a place-label overlay */}
      <TileLayer
        attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
        pane="overlayPane"
      />
      {geo ? <ScratchOverlay /> : null}
      {showRoute && routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: "#ffd98a", weight: 3, opacity: 0.9, dashArray: "2 9", lineCap: "round" }} />
      ) : null}
      <ClusterLayer memories={memories} />
      <PreviewController />
      <FocusController />
    </MapContainer>
  );
}
