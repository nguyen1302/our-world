"use client";
import { useEffect, useState } from "react";
import { useFaces } from "./journeyStore";

interface ShareInfo {
  id: string;
  token: string;
  url: string;
  includeMusic: boolean;
  viewCount: number;
}

export default function ShareModal({ onClose }: { onClose: () => void }) {
  const faces = useFaces((s) => s.faces);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    const d = await fetch("/api/share").then((r) => r.json());
    setShare(d.share ?? null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy("Đang tạo…");
    await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faces }),
    });
    setBusy("");
    await load();
  }

  async function patch(body: Record<string, unknown>) {
    if (!share) return;
    await fetch(`/api/share/${share.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function revoke() {
    if (!share) return;
    if (!confirm("Thu hồi link này? Người có link sẽ không xem được nữa.")) return;
    setBusy("Đang thu hồi…");
    await fetch(`/api/share/${share.id}/revoke`, { method: "POST" });
    setBusy("");
    await load();
  }

  function copy() {
    if (!share) return;
    navigator.clipboard?.writeText(share.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="ow-modal" onClick={onClose}>
      <div className="ow-modal__box" onClick={(e) => e.stopPropagation()}>
        <button className="ow-card__close" onClick={onClose}>✕</button>
        <h3>Chia sẻ hành trình 🔗</h3>

        {loading ? (
          <p className="ow-modal__desc">Đang tải…</p>
        ) : !share ? (
          <>
            <p className="ow-modal__desc">
              Tạo một link bí mật để người khác xem toàn bộ hành trình (chỉ xem, không sửa được).
              Link sẽ hiển thị vị trí các mốc. Bạn có thể thu hồi bất cứ lúc nào.
            </p>
            <button className="ow-primary" style={{ width: "100%" }} disabled={!!busy} onClick={create}>
              {busy || "Tạo link chia sẻ"}
            </button>
          </>
        ) : (
          <>
            <p className="ow-modal__desc">Ai có link này đều xem được hành trình. Đã xem {share.viewCount} lần.</p>
            <div className="ow-share-row">
              <input className="ow-share-url" readOnly value={share.url} onFocus={(e) => e.target.select()} />
              <button className="ow-minibtn" onClick={copy}>{copied ? "Đã chép ✓" : "Sao chép"}</button>
              <a className="ow-minibtn" href={share.url} target="_blank" rel="noreferrer">Mở</a>
            </div>

            <label className="ow-share-toggle">
              <input
                type="checkbox"
                checked={share.includeMusic}
                onChange={(e) => patch({ includeMusic: e.target.checked })}
              />
              Kèm nhạc nền
            </label>

            <div className="ow-share-actions">
              <button className="ow-minibtn" onClick={() => patch({ faces })}>Cập nhật khuôn mặt</button>
              <button className="ow-link" onClick={revoke} disabled={!!busy}>{busy || "Thu hồi link"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
