"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMapStore } from "@/components/mapStore";
import Stats from "@/components/Stats";
import OnThisDay from "@/components/OnThisDay";
import Timeline from "@/components/Timeline";
import UploadButton from "@/components/UploadButton";
import MemoryCard from "@/components/MemoryCard";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const setMemories = useMapStore((s) => s.setMemories);
  const setScratch = useMapStore((s) => s.setScratch);
  const setStats = useMapStore((s) => s.setStats);
  const showRoute = useMapStore((s) => s.showRoute);
  const toggleRoute = useMapStore((s) => s.toggleRoute);

  const [geo, setGeo] = useState<unknown>(null);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);

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
    refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isAdmin = role === "admin";

  return (
    <div className="ow-app">
      <WorldMap geo={geo} />

      <div className="ow-panel">
        <h1>
          Our World ♥<small>Bản đồ ký ức của hai người</small>
        </h1>
        <Stats />
        <OnThisDay />
        <div className="ow-toolbar">
          {isAdmin && <UploadButton onUploaded={refresh} />}
          <button className="ow-ghost" onClick={toggleRoute}>
            {showRoute ? "Ẩn hành trình" : "Hiện hành trình"}
          </button>
          <button className="ow-ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
        <Timeline />
      </div>

      <MemoryCard isAdmin={isAdmin} onChanged={refresh} />
    </div>
  );
}
