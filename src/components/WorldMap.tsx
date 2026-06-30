"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster";
import { useMapStore, type MemoryMarker } from "./mapStore";
import { useJourney, vehicleForDistance, haversineKm } from "./journeyStore";
import { vehicleSvg, type VehicleType } from "./vehicles";

const VN_CENTER: [number, number] = [16.2, 107.2];
const VN_ZOOM = 6;
const GOLD = "#e9b872";
const ROSE = "#d98695";

function markerHtml(m: MemoryMarker, active: boolean): string {
  const glow = active
    ? `0 6px 20px rgba(0,0,0,.6),0 0 24px ${GOLD}`
    : `0 4px 14px rgba(0,0,0,.6),0 0 16px ${GOLD}66`;
  return (
    `<div class="wwh-mk"><div class="wwh-mk-inner" style="width:44px;height:44px;border-radius:50%;padding:2px;` +
    `background:linear-gradient(135deg,${GOLD},${ROSE});box-shadow:${glow};transform:scale(${active ? 1.32 : 1})">` +
    `<img src="${m.coverThumbUrl ?? ""}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;border:2px solid #11160F;"></div></div>`
  );
}

function ClusterLayer({ memories }: { memories: MemoryMarker[] }) {
  const map = useMap();
  const open = useMapStore((s) => s.open);
  const selectedId = useMapStore((s) => s.selectedId);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({
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
        icon: L.divIcon({ className: "", iconSize: [44, 44], iconAnchor: [22, 22], html: markerHtml(m, m.id === selectedId) }),
      });
      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        open(m.id);
      });
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, memories, selectedId, open]);

  return null;
}

function FocusController() {
  const map = useMap();
  const focus = useMapStore((s) => s.focus);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1.2, easeLinearity: 0.22 });
  }, [map, focus]);
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
  const fxRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipRef = useRef(1);

  // FX layer inside the map container
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
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
    } else {
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

  useEffect(() => {
    if (!playing && markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
      if (fxRef.current) fxRef.current.innerHTML = "";
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
      map.flyTo([s.lat, s.lng], index === 0 ? 12 : 12, { duration: 1.4, easeLinearity: 0.2 });
      place(s.lat, s.lng, segVehicle(stops, Math.max(0, index - 1)), false);
      return;
    }

    setSelected(null);
    const from = stops[index];
    const to = stops[index + 1];
    if (!to) return;
    const km = haversineKm(from, to);
    const type = vehicleForDistance(km);
    const flip = to.lng < from.lng;

    map.flyToBounds(L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]), {
      paddingTopLeft: [80, 130],
      paddingBottomRight: [420, 180],
      maxZoom: 10,
      duration: 1.5,
      easeLinearity: 0.2,
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
        setProgress(t);
        const lat = from.lat + (to.lat - from.lat) * e;
        const lng = from.lng + (to.lng - from.lng) * e;
        markerRef.current?.setLatLng([lat, lng]);
        if (now - lastSpawn > (type === "plane" ? 240 : 140)) {
          lastSpawn = now;
          spawnFX(lat, lng, type);
        }
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else arrive();
      };
      rafRef.current = requestAnimationFrame(step);
    }, 1650);

    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, index, stops, faces, map]);

  return null;
}

export default function WorldMap() {
  const memories = useMapStore((s) => s.memories);
  const showRoute = useMapStore((s) => s.showRoute);

  const routePoints = useMemo(
    () =>
      [...memories]
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((m) => [m.lat, m.lng] as [number, number]),
    [memories],
  );

  return (
    <MapContainer
      center={VN_CENTER}
      zoom={VN_ZOOM}
      className="ow-map"
      scrollWheelZoom
      zoomControl={false}
      preferCanvas
    >
      <TileLayer
        attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={18}
        keepBuffer={6}
        updateWhenZooming={false}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={18}
        opacity={0.9}
        keepBuffer={6}
        updateWhenZooming={false}
      />
      {showRoute && routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: GOLD, weight: 2.4, opacity: 0.65, dashArray: "1 9", lineCap: "round" }} />
      ) : null}
      <ClusterLayer memories={memories} />
      <FocusController />
      <JourneyController />
    </MapContainer>
  );
}
