"use client";
import { useEffect, useRef, useState } from "react";
import { setMusicTrack } from "./journeyMusic";

interface Track {
  id: string;
  name: string;
  isActive: boolean;
}

export default function MusicModal({ onClose }: { onClose: () => void }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const d = await fetch("/api/music").then((r) => r.json());
    setTracks(d.tracks ?? []);
    setMusicTrack(d.activeUrl ?? null);
  }
  useEffect(() => {
    load();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      alert("Chỉ hỗ trợ file nhạc (mp3, m4a, …).");
      return;
    }
    setBusy("Đang tải nhạc lên…");
    try {
      const presign = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presign", contentType: file.type, filename: file.name }),
      }).then((r) => r.json());
      if (!presign.url) {
        alert(presign.error || "Lỗi presign");
        return;
      }
      await fetch(presign.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", key: presign.key, name: file.name.replace(/\.[^.]+$/, "") }),
      });
      await load();
    } finally {
      setBusy("");
    }
  }

  async function setActive(id: string) {
    await fetch(`/api/music/${id}`, { method: "PATCH" });
    await load();
  }
  async function remove(id: string) {
    await fetch(`/api/music/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="ow-modal" onClick={onClose}>
      <div className="ow-modal__box" onClick={(e) => e.stopPropagation()}>
        <button className="ow-card__close" onClick={onClose}>
          ✕
        </button>
        <h3>Nhạc nền hành trình 🎵</h3>
        <p className="ow-modal__desc">
          Tải bài hát của hai đứa (mp3/m4a) để phát khi xem lại hành trình. Chưa có bài thì dùng giai điệu mặc định.
        </p>

        <div className="ow-tracklist">
          {tracks.length === 0 && <p className="ow-empty">Chưa có bài nào.</p>}
          {tracks.map((t) => (
            <div className={`ow-track ${t.isActive ? "ow-track--active" : ""}`} key={t.id}>
              <button className="ow-track__pick" onClick={() => setActive(t.id)} title="Chọn làm nhạc nền">
                {t.isActive ? "🎵" : "▷"}
              </button>
              <span className="ow-track__name">{t.name}</span>
              <button className="ow-link" onClick={() => remove(t.id)}>
                Xoá
              </button>
            </div>
          ))}
        </div>

        <button className="ow-primary ow-track__upload" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy || "+ Tải bài hát lên"}
        </button>
        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
      </div>
    </div>
  );
}
