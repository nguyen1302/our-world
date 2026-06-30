"use client";
import { useRef, useState } from "react";

export default function UploadButton({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleFiles(files: FileList) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      alert("Chỉ hỗ trợ ảnh (image/*) ở phiên bản này.");
      return;
    }
    setBusy(true);
    try {
      setProgress(`Đang xin link upload (${images.length})…`);
      const presign = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: images.map((f) => ({ filename: f.name, contentType: f.type })) }),
      }).then((r) => r.json());

      if (!presign.items) {
        alert(presign.error || "Lỗi presign");
        return;
      }

      const keys: { key: string; contentType: string }[] = [];
      for (let i = 0; i < images.length; i++) {
        const item = presign.items[i];
        setProgress(`Đang tải ảnh ${i + 1}/${images.length}…`);
        const res = await fetch(item.url, {
          method: "PUT",
          headers: { "Content-Type": item.contentType },
          body: images[i],
        });
        if (res.ok) keys.push({ key: item.key, contentType: item.contentType });
      }

      setProgress("Đang xử lý…");
      await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });

      // Poll a few times to let the worker process.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        onUploaded();
      }
    } finally {
      setBusy(false);
      setProgress("");
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
