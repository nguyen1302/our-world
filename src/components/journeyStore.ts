"use client";
import { create } from "zustand";

export interface Faces {
  a: string | null; // data URL (cropped circular face)
  b: string | null;
}

function loadFaces(): Faces {
  if (typeof window === "undefined") return { a: null, b: null };
  try {
    const raw = localStorage.getItem("ow_faces");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { a: null, b: null };
}

interface JourneyState {
  playing: boolean;
  total: number;
  index: number; // current stop (paused) or source stop (moving)
  phase: "paused" | "moving";
  progress: number; // 0..1 within the current moving segment
  faces: Faces;

  start: (total: number) => void;
  exit: () => void;
  next: () => void;
  setProgress: (p: number) => void;
  arrive: () => void;
  setFaces: (faces: Faces) => void;
}

export const useJourney = create<JourneyState>((set, get) => ({
  playing: false,
  total: 0,
  index: 0,
  phase: "paused",
  progress: 0,
  faces: loadFaces(),

  start: (total) => set({ playing: true, total, index: 0, phase: "paused", progress: 0 }),
  exit: () => set({ playing: false, phase: "paused", progress: 0, index: 0 }),
  next: () => {
    const { index, total } = get();
    if (index >= total - 1) {
      set({ playing: false, phase: "paused", progress: 0, index: 0 });
    } else {
      set({ phase: "moving", progress: 0 });
    }
  },
  setProgress: (p) => set({ progress: p }),
  arrive: () => set((s) => ({ index: s.index + 1, phase: "paused", progress: 0 })),
  setFaces: (faces) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ow_faces", JSON.stringify(faces));
      } catch {}
    }
    set({ faces });
  },
}));

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pick the vehicle for a segment based on great-circle distance (km). */
export function vehicleForDistance(km: number): "bike" | "car" | "plane" {
  if (km < 25) return "bike";
  if (km < 250) return "car";
  return "plane";
}
