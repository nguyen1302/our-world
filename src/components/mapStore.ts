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
  /** Highlighted on the map + preview bubble shown (e.g. from the timeline). */
  previewId: string | null;
  /** Opened in the detail card (only by clicking the map marker). */
  selectedId: string | null;
  showRoute: boolean;
  focus: FocusTarget | null;

  setMemories: (m: MemoryMarker[]) => void;
  setScratch: (codes: string[]) => void;
  setStats: (s: Stats) => void;
  /** Timeline: fly to the marker and preview it, but do NOT open detail. */
  preview: (id: string | null) => void;
  /** Map marker: open the detail card. */
  open: (id: string) => void;
  closeDetail: () => void;
  setSelected: (id: string | null) => void;
  toggleRoute: () => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  memories: [],
  scratchCodes: [],
  stats: null,
  previewId: null,
  selectedId: null,
  showRoute: true,
  focus: null,

  setMemories: (m) => set({ memories: m }),
  setScratch: (codes) => set({ scratchCodes: codes }),
  setStats: (s) => set({ stats: s }),

  preview: (id) => {
    set({ previewId: id });
    if (id) {
      const m = get().memories.find((x) => x.id === id);
      if (m) set({ focus: { lat: m.lat, lng: m.lng, zoom: 12, nonce: Date.now() } });
    }
  },
  open: (id) => {
    const m = get().memories.find((x) => x.id === id);
    set({ selectedId: id, previewId: id });
    if (m) set({ focus: { lat: m.lat, lng: m.lng, zoom: 13, nonce: Date.now() } });
  },
  closeDetail: () => set({ selectedId: null }),
  /** Show the detail card without moving the camera (journey controls the map). */
  setSelected: (id) => set({ selectedId: id }),
  toggleRoute: () => set((s) => ({ showRoute: !s.showRoute })),
}));
