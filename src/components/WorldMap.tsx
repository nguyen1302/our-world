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

function heartIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "ow-marker",
    html: `<div class="ow-pin ${selected ? "ow-pin--active" : ""}">♥</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function ClusterLayer({ memories }: { memories: MemoryMarker[] }) {
  const map = useMap();
  const select = useMapStore((s) => s.select);
  const selectedId = useMapStore((s) => s.selectedId);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({ maxClusterRadius: 45 });
    for (const m of memories) {
      const marker = L.marker([m.lat, m.lng], { icon: heartIcon(m.id === selectedId) });
      marker.on("click", () => select(m.id));
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, memories, selectedId, select]);

  return null;
}

function FocusController() {
  const map = useMap();
  const focus = useMapStore((s) => s.focus);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.8 });
  }, [map, focus]);
  return null;
}

function ScratchOverlay() {
  const scratchCodes = useMapStore((s) => s.scratchCodes);
  const set = new Set(scratchCodes);
  // keyed by join so it re-renders when the set changes
  return (
    <GeoJSON
      key={scratchCodes.slice().sort().join(",")}
      data={(globalThis as any).__VN_GEO__}
      style={(feature) => {
        const visited = feature && set.has(feature.properties.code);
        return {
          color: visited ? "#e0529c" : "#cbd5e1",
          weight: visited ? 1.2 : 0.6,
          fillColor: "#e0529c",
          fillOpacity: visited ? 0.35 : 0.04,
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geo ? <ScratchOverlay /> : null}
      {showRoute && routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: "#e0529c", weight: 2, dashArray: "6 6" }} />
      ) : null}
      <ClusterLayer memories={memories} />
      <FocusController />
    </MapContainer>
  );
}
