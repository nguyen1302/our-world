"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useMapStore } from "@/components/mapStore";
import { useBigJourney, useSmallJourney, useFaces } from "@/components/journeyStore";
import { setMusicTrack } from "@/components/journeyMusic";
import { ApiBaseProvider } from "@/components/apiBase";
import Stats from "@/components/Stats";
import TimelineBar from "@/components/TimelineBar";
import MemoryCard from "@/components/MemoryCard";
import JourneyControls from "@/components/JourneyControls";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

// Read-only public viewer for a shared journey. Reuses the same components as the
// authed app but with isAdmin=false, data from /api/public/<token>/*, and the
// couple's faces taken from the share record (not localStorage).
export default function PublicHome({ token }: { token: string }) {
  const base = `/api/public/${token}`;

  const setMemories = useMapStore((s) => s.setMemories);
  const setScratch = useMapStore((s) => s.setScratch);
  const setStats = useMapStore((s) => s.setStats);
  const showRoute = useMapStore((s) => s.showRoute);
  const toggleRoute = useMapStore((s) => s.toggleRoute);
  const pendingEnterTripId = useMapStore((s) => s.pendingEnterTripId);
  const enterTrip = useMapStore((s) => s.enterTrip);
  const setFaces = useFaces((s) => s.setFaces);

  const bigPlaying = useBigJourney((s) => s.playing);
  const smallPlaying = useSmallJourney((s) => s.playing);
  const journeyActive = bigPlaying || smallPlaying;
  const journeyDetailOpen = useMapStore((s) => s.journeyDetailOpen);

  const [title, setTitle] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [m, sc, st] = await Promise.all([
      fetch(`${base}/memories`).then((r) => r.json()),
      fetch(`${base}/scratch`).then((r) => r.json()),
      fetch(`${base}/stats`).then((r) => r.json()),
    ]);
    if (m.memories) setMemories(m.memories);
    if (sc.provinceCodes) setScratch(sc.provinceCodes);
    if (st && typeof st.memories === "number") setStats(st);
  }, [base, setMemories, setScratch, setStats]);

  useEffect(() => {
    fetch(base)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTitle(d.title ?? null);
        if (d.faces) setFaces(d.faces);
      });
    fetch(`${base}/music`).then((r) => (r.ok ? r.json() : null)).then((d) => setMusicTrack(d?.activeUrl ?? null));
    refresh();
  }, [base, refresh, setFaces]);

  useEffect(() => {
    if (!pendingEnterTripId) return;
    fetch(`${base}/memories/${pendingEnterTripId}`)
      .then((r) => r.json())
      .then((d) => enterTrip(d))
      .catch(() => {});
  }, [base, pendingEnterTripId, enterTrip]);

  return (
    <ApiBaseProvider base={base}>
      <div className={`ow-app ${journeyActive ? "ow-app--journey" : ""} ${smallPlaying ? "ow-app--smalljourney" : ""} ${journeyActive && journeyDetailOpen ? "ow-app--jdetail" : ""}`}>
        <WorldMap />

        <header className="ow-topbar">
          <div className="ow-brand">
            <div className="ow-brand__dot" />
            <div>
              <div className="ow-brand__name">We Were Here</div>
              <div className="ow-brand__sub">{title || "Bản đồ ký ức"}</div>
            </div>
          </div>

          <div className="ow-topright">
            <Stats />
            <button className={`ow-pillbtn ${showRoute ? "ow-pillbtn--on" : ""}`} onClick={toggleRoute}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="5" r="2.4" /><path d="M8 17.5C12 15 9 9 13.5 6.5" /></svg>
              <span>Tuyến đường</span>
            </button>
          </div>
        </header>

        <MemoryCard isAdmin={false} onChanged={refresh} onAddToPlace={() => {}} />
        <JourneyControls />
        <TimelineBar />
      </div>
    </ApiBaseProvider>
  );
}
