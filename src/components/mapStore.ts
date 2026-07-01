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

export interface PlacePhoto {
  id: string;
  thumbUrl: string | null;
}
export interface Place {
  id: string;
  title: string;
  description: string | null;
  placeName: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
  photos: PlacePhoto[];
}
export interface TripDetail {
  trip: {
    id: string;
    title: string;
    description: string | null;
    city: string | null;
    country: string | null;
    startAt: string;
    endAt: string;
  };
  places: Place[];
}

export interface Stats {
  memories: number;
  photos: number;
  videos: number;
  provinces: number;
  countries: number;
}

interface FocusPoint {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}
interface FocusBounds {
  points: [number, number][];
  nonce: number;
}

interface MapState {
  memories: MemoryMarker[]; // trips (level 1)
  scratchCodes: string[];
  stats: Stats | null;
  showRoute: boolean;

  focusedTripId: string | null; // level 2 = inside this trip
  tripDetail: TripDetail | null;
  selectedPlaceId: string | null;
  pendingEnterTripId: string | null; // request to enter a trip (page fetches detail)

  focusPoint: FocusPoint | null;
  focusBounds: FocusBounds | null;

  setMemories: (m: MemoryMarker[]) => void;
  setScratch: (codes: string[]) => void;
  setStats: (s: Stats) => void;
  toggleRoute: () => void;

  requestEnterTrip: (id: string) => void;
  enterTrip: (detail: TripDetail) => void;
  exitTrip: () => void;
  selectPlace: (id: string) => void;
  backToTrip: () => void;
  updatePlaceLocal: (id: string, patch: Partial<Place>) => void;
  updateTripLocal: (patch: Partial<TripDetail["trip"]>) => void;
}

let _n = 1;
const nonce = () => _n++;

export const useMapStore = create<MapState>((set, get) => ({
  memories: [],
  scratchCodes: [],
  stats: null,
  showRoute: true,
  focusedTripId: null,
  tripDetail: null,
  selectedPlaceId: null,
  pendingEnterTripId: null,
  focusPoint: null,
  focusBounds: null,

  setMemories: (m) => set({ memories: m }),
  setScratch: (codes) => set({ scratchCodes: codes }),
  setStats: (s) => set({ stats: s }),
  toggleRoute: () => set((s) => ({ showRoute: !s.showRoute })),

  requestEnterTrip: (id) => set({ pendingEnterTripId: id }),
  enterTrip: (detail) => {
    set({
      focusedTripId: detail.trip.id,
      tripDetail: detail,
      selectedPlaceId: null,
      pendingEnterTripId: null,
      focusBounds: { points: detail.places.map((p) => [p.lat, p.lng]), nonce: nonce() },
    });
  },
  exitTrip: () => {
    set({
      focusedTripId: null,
      tripDetail: null,
      selectedPlaceId: null,
      focusBounds: { points: get().memories.map((m) => [m.lat, m.lng]), nonce: nonce() },
    });
  },
  selectPlace: (id) => {
    const p = get().tripDetail?.places.find((x) => x.id === id);
    set({ selectedPlaceId: id });
    if (p) set({ focusPoint: { lat: p.lat, lng: p.lng, zoom: 14, nonce: nonce() } });
  },
  backToTrip: () => {
    const d = get().tripDetail;
    set({
      selectedPlaceId: null,
      focusBounds: d ? { points: d.places.map((p) => [p.lat, p.lng]), nonce: nonce() } : null,
    });
  },
  updatePlaceLocal: (id, patch) =>
    set((s) =>
      s.tripDetail
        ? { tripDetail: { ...s.tripDetail, places: s.tripDetail.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) } }
        : {},
    ),
  updateTripLocal: (patch) =>
    set((s) => (s.tripDetail ? { tripDetail: { ...s.tripDetail, trip: { ...s.tripDetail.trip, ...patch } } } : {})),
}));
