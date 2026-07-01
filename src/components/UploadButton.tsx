"use client";
import { useEffect, useRef, useState } from "react";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function putWithRetry(url: string, file: File, contentType: string, tries = 4): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (res.ok) return true;
    } catch {
      /* network hiccup — retry */
    }
    await sleep(800 * (attempt + 1)); // backoff
  }
  return false;
}

// Run tasks with limited concurrency (gentle on mobile + the small server).
async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

export default function UploadButton({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const wakeRef = useRef<any>(null);

  // keep the screen awake while uploading; re-acquire when tab becomes visible again
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState === "visible" && busy) {
        try {
          wakeRef.current = await (navigator as any).wakeLock?.request("screen");
        } catch {}
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [busy]);

  async function handleFiles(files: FileList) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      alert("Chỉ hỗ trợ ảnh (image/*) ở phiên bản này.");
      return;
    }
    setBusy(true);
    try {
      try {
        wakeRef.current = await (navigator as any).wakeLock?.request("screen");
      } catch {}

      const total = images.length;
      let done = 0;
      let failed = 0;
      const CHUNK = 40; // presign limit is 80; keep requests small

      for (let c = 0; c < images.length; c += CHUNK) {
        const chunk = images.slice(c, c + CHUNK);
        const presign = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: chunk.map((f) => ({ filename: f.name, contentType: f.type })) }),
        }).then((r) => r.json());

        if (!presign.items) {
          alert(presign.error || "Lỗi xin link upload");
          return;
        }

        // upload 3 at a time; save EACH photo right after its bytes land (durable)
        await pool(chunk, 3, async (file, i) => {
          const item = presign.items[i];
          const ok = await putWithRetry(item.url, file, item.contentType);
          if (ok) {
            await fetch("/api/upload/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ keys: [{ key: item.key, contentType: item.contentType }] }),
            }).catch(() => {});
          } else {
            failed++;
          }
          done++;
          setProgress(`Đang tải ${done}/${total}…`);
        });
      }

      if (failed > 0) alert(`${failed}/${total} ảnh tải lỗi (mạng?) — thử lại các ảnh đó sau.`);

      // let the worker process, refresh the map a few times
      setProgress("Đang xử lý…");
      for (let i = 0; i < 8; i++) {
        await sleep(2500);
        onUploaded();
      }
    } finally {
      setBusy(false);
      setProgress("");
      try {
        await wakeRef.current?.release?.();
      } catch {}
      wakeRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="ow-upload">
      <button disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? progress || "Đang xử lý…" : "Import Photos"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
