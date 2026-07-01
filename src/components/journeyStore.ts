"use client";
import { create } from "zustand";

export interface Faces {
  a: string | null;
  b: string | null;
}
export interface Stop {
  id: string;
  tripId?: string | null;
  lat: number;
  lng: number;
  title: string;
}
export type JourneyMode = "trips" | "places";

function loadFaces(): Faces {
  if (typeof window === "undefined") return { a: null, b: null };
  try {
    const raw = localStorage.getItem("ow_faces");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { a: null, b: null };
}

// Faces are a single shared identity (the couple), not per-journey.
interface FacesState {
  faces: Faces;
  setFaces: (faces: Faces) => void;
}
export const useFaces = create<FacesState>((set) => ({
  faces: loadFaces(),
  setFaces: (faces) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ow_faces", JSON.stringify(faces));
      } catch {}
    }
    set({ faces });
  },
}));

export interface JourneyState {
  playing: boolean;
  mode: JourneyMode;
  stops: Stop[];
  index: number;
  phase: "paused" | "moving";
  progress: number;
  activePlaceId: string | null;

  start: (stops: Stop[]) => void;
  exit: () => void;
  next: () => void;
  jumpTo: (i: number) => void;
  setProgress: (p: number) => void;
  arrive: () => void;
  setActivePlace: (id: string | null) => void;
}

// Factory so we can run two fully independent journeys (big trips + small places).
function makeJourney(mode: JourneyMode) {
  return create<JourneyState>((set, get) => ({
    playing: false,
    mode,
    stops: [],
    index: 0,
    phase: "paused",
    progress: 0,
    activePlaceId: null,

    start: (stops) => set({ playing: true, stops, index: 0, phase: "paused", progress: 0, activePlaceId: null }),
    exit: () => set({ playing: false, phase: "paused", progress: 0, index: 0, activePlaceId: null }),
    next: () => {
      const { index, stops } = get();
      if (index >= stops.length - 1) set({ playing: false, phase: "paused", progress: 0, index: 0 });
      else set({ phase: "moving", progress: 0 });
    },
    // jump straight to any stop (resume at stage X / skip around); pause there so
    // the controller flies to it, then the user presses "Tiếp" to keep going.
    jumpTo: (i) =>
      set((s) => {
        const idx = Math.max(0, Math.min(i, s.stops.length - 1));
        return { playing: true, index: idx, phase: "paused", progress: 0 };
      }),
    setProgress: (p) => set({ progress: p }),
    arrive: () => set((s) => ({ index: s.index + 1, phase: "paused", progress: 0 })),
    setActivePlace: (id) => set({ activePlaceId: id }),
  }));
}

export const useBigJourney = makeJourney("trips");
export const useSmallJourney = makeJourney("places");

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function vehicleForDistance(km: number): "bike" | "car" | "plane" {
  if (km < 25) return "bike";
  if (km < 250) return "car";
  return "plane";
}
