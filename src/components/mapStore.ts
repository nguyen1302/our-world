"use client";
import { create } from "zustand";

export interface MemoryMarker {
  id: string;
  title: string;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
  provinceCode: string | null;
  city: string | null;
  coverThumbUrl: string | null;
  photoCount: number;
}

export interface Stats {
  memories: number;
  photos: number;
  videos: number;
  provinces: number;
  countries: number;
}

interface FocusTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

interface MapState {
  memories: MemoryMarker[];
  scratchCodes: string[];
  stats: Stats | null;
  selectedId: string | null;
  showRoute: boolean;
  focus: FocusTarget | null;

  setMemories: (m: MemoryMarker[]) => void;
  setScratch: (codes: string[]) => void;
  setStats: (s: Stats) => void;
  select: (id: string | null) => void;
  toggleRoute: () => void;
  focusOn: (lat: number, lng: number, zoom?: number) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  memories: [],
  scratchCodes: [],
  stats: null,
  selectedId: null,
  showRoute: true,
  focus: null,

  setMemories: (m) => set({ memories: m }),
  setScratch: (codes) => set({ scratchCodes: codes }),
  setStats: (s) => set({ stats: s }),
  select: (id) => {
    set({ selectedId: id });
    if (id) {
      const m = get().memories.find((x) => x.id === id);
      if (m) set({ focus: { lat: m.lat, lng: m.lng, zoom: 12, nonce: Date.now() } });
    }
  },
  toggleRoute: () => set((s) => ({ showRoute: !s.showRoute })),
  focusOn: (lat, lng, zoom = 11) => set({ focus: { lat, lng, zoom, nonce: Date.now() } }),
}));
