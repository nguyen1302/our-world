"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMapStore } from "@/components/mapStore";
import { useBigJourney, useSmallJourney } from "@/components/journeyStore";
import { setMusicTrack } from "@/components/journeyMusic";
import Stats from "@/components/Stats";
import OnThisDay from "@/components/OnThisDay";
import TimelineBar from "@/components/TimelineBar";
import TopMenu from "@/components/TopMenu";
import MemoryCard from "@/components/MemoryCard";
import JourneyControls from "@/components/JourneyControls";
import FaceModal from "@/components/FaceModal";
import MusicModal from "@/components/MusicModal";
import ShareModal from "@/components/ShareModal";
import ThemePicker from "@/components/ThemePicker";
import ThemeController from "@/components/ThemeController";
import UnplacedPanel from "@/components/UnplacedPanel";
import Uploader, { type UploaderHandle } from "@/components/Uploader";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const setMemories = useMapStore((s) => s.setMemories);
  const setScratch = useMapStore((s) => s.setScratch);
  const setStats = useMapStore((s) => s.setStats);
  const showRoute = useMapStore((s) => s.showRoute);
  const toggleRoute = useMapStore((s) => s.toggleRoute);
  const pendingEnterTripId = useMapStore((s) => s.pendingEnterTripId);
  const enterTrip = useMapStore((s) => s.enterTrip);
  // NOTE: call both hooks unconditionally (|| would short-circuit the 2nd hook → Rules of Hooks crash)
  const bigPlaying = useBigJourney((s) => s.playing);
  const smallPlaying = useSmallJourney((s) => s.playing);
  const journeyActive = bigPlaying || smallPlaying;
  const journeyDetailOpen = useMapStore((s) => s.journeyDetailOpen);

  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [showFaces, setShowFaces] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const uploaderRef = useRef<UploaderHandle>(null);

  const refresh = useCallback(async () => {
    const [m, sc, st] = await Promise.all([
      fetch("/api/memories").then((r) => r.json()),
      fetch("/api/scratch").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]);
    if (m.memories) setMemories(m.memories);
    if (sc.provinceCodes) setScratch(sc.provinceCodes);
    if (st && typeof st.memories === "number") setStats(st);
    setDataVersion((v) => v + 1);
  }, [setMemories, setScratch, setStats]);

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((d) => setRole(d?.role ?? null));
    fetch("/api/music").then((r) => (r.ok ? r.json() : null)).then((d) => setMusicTrack(d?.activeUrl ?? null));
    refresh();
  }, [refresh]);

  // reload after attaching unplaced photos to a mốc from the map / timeline
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("ow:refresh", h);
    return () => window.removeEventListener("ow:refresh", h);
  }, [refresh]);

  // when a trip marker/bead is clicked, fetch its places and drill in
  useEffect(() => {
    if (!pendingEnterTripId) return;
    fetch(`/api/memories/${pendingEnterTripId}`)
      .then((r) => r.json())
      .then((d) => enterTrip(d))
      .catch(() => {});
  }, [pendingEnterTripId, enterTrip]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isAdmin = role === "admin";

  return (
    <div className={`ow-app ${journeyActive ? "ow-app--journey" : ""} ${smallPlaying ? "ow-app--smalljourney" : ""} ${journeyActive && journeyDetailOpen ? "ow-app--jdetail" : ""}`}>
      <ThemeController />
      <WorldMap onPlaced={refresh} />
      <Uploader ref={uploaderRef} onUploaded={refresh} />

      <header className="ow-topbar">
        <div className="ow-brand">
          <div className="ow-brand__dot" />
          <div>
            <div className="ow-brand__name">We Were Here</div>
            <div className="ow-brand__sub">Bản đồ ký ức</div>
          </div>
        </div>

        <div className="ow-topright">
          <Stats />
          <OnThisDay />
          <button className={`ow-pillbtn ${showRoute ? "ow-pillbtn--on" : ""}`} onClick={toggleRoute}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="5" r="2.4" /><path d="M8 17.5C12 15 9 9 13.5 6.5" /></svg>
            <span>Tuyến đường</span>
          </button>
          <ThemePicker />
          {isAdmin && <UnplacedPanel version={dataVersion} />}
          <TopMenu
            isAdmin={isAdmin}
            onUploaded={refresh}
            onLogout={logout}
            onFaces={() => setShowFaces(true)}
            onMusic={() => setShowMusic(true)}
            onImport={() => uploaderRef.current?.open()}
            onShare={() => setShowShare(true)}
          />
        </div>
      </header>

      <MemoryCard isAdmin={isAdmin} onChanged={refresh} onAddToPlace={(mid) => uploaderRef.current?.open(mid)} />
      <JourneyControls />
      <TimelineBar />

      {showFaces && <FaceModal onClose={() => setShowFaces(false)} />}
      {showMusic && <MusicModal onClose={() => setShowMusic(false)} />}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </div>
  );
}
