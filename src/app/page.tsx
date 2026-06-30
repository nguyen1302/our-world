"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMapStore } from "@/components/mapStore";
import { useJourney } from "@/components/journeyStore";
import Stats from "@/components/Stats";
import OnThisDay from "@/components/OnThisDay";
import TimelineBar from "@/components/TimelineBar";
import TopMenu from "@/components/TopMenu";
import MemoryCard from "@/components/MemoryCard";
import JourneyControls from "@/components/JourneyControls";
import FaceModal from "@/components/FaceModal";
import MusicModal from "@/components/MusicModal";
import { setMusicTrack } from "@/components/journeyMusic";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const setMemories = useMapStore((s) => s.setMemories);
  const setScratch = useMapStore((s) => s.setScratch);
  const setStats = useMapStore((s) => s.setStats);
  const memories = useMapStore((s) => s.memories);

  const startJourney = useJourney((s) => s.start);
  const playing = useJourney((s) => s.playing);

  const [geo, setGeo] = useState<unknown>(null);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [showFaces, setShowFaces] = useState(false);
  const [showMusic, setShowMusic] = useState(false);

  const refresh = useCallback(async () => {
    const [m, sc, st] = await Promise.all([
      fetch("/api/memories").then((r) => r.json()),
      fetch("/api/scratch").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]);
    if (m.memories) setMemories(m.memories);
    if (sc.provinceCodes) setScratch(sc.provinceCodes);
    if (st && typeof st.memories === "number") setStats(st);
  }, [setMemories, setScratch, setStats]);

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((d) => setRole(d?.role ?? null));
    fetch("/vn-provinces.geojson").then((r) => r.json()).then(setGeo).catch(() => setGeo(null));
    fetch("/api/music").then((r) => (r.ok ? r.json() : null)).then((d) => setMusicTrack(d?.activeUrl ?? null));
    refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isAdmin = role === "admin";
  const canPlay = memories.length > 1;

  return (
    <div className="ow-app">
      <WorldMap geo={geo} />

      <header className="ow-topbar">
        <div className="ow-brand">
          We Were Here <span>♥</span>
        </div>
        <Stats />
        {canPlay && !playing && (
          <button className="ow-play" title="Xem lại hành trình" onClick={() => startJourney(memories.length)}>
            ▶
          </button>
        )}
        <TopMenu
          isAdmin={isAdmin}
          onUploaded={refresh}
          onLogout={logout}
          onFaces={() => setShowFaces(true)}
          onMusic={() => setShowMusic(true)}
        />
      </header>

      <OnThisDay />

      <TimelineBar />

      <MemoryCard isAdmin={isAdmin} onChanged={refresh} />
      <JourneyControls />

      {showFaces && <FaceModal onClose={() => setShowFaces(false)} />}
      {showMusic && <MusicModal onClose={() => setShowMusic(false)} />}
    </div>
  );
}
