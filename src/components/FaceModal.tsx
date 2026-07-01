"use client";
import { useEffect, useRef, useState } from "react";
import { useFaces } from "./journeyStore";

const BOX = 240;
const R = 100;

const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function CropStage({ src, onSave, onCancel }: { src: string; onSave: (d: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 }); // top-left of image, in BOX (css) px
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [range, setRange] = useState({ min: 0.1, max: 4, cover: 1 });
  const [err, setErr] = useState(false);

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, BOX, BOX);
    ctx.drawImage(img, posRef.current.x, posRef.current.y, img.width * scale, img.height * scale);
    // dim outside the circle
    ctx.save();
    ctx.fillStyle = "rgba(12,16,14,0.62)";
    ctx.beginPath();
    ctx.rect(0, 0, BOX, BOX);
    ctx.arc(BOX / 2, BOX / 2, R, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(BOX / 2, BOX / 2, R, 0, Math.PI * 2);
    ctx.stroke();
  }

  useEffect(() => {
    setErr(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const cover = Math.max(BOX / img.width, BOX / img.height); // fills the box
      const contain = Math.min(BOX / img.width, BOX / img.height); // whole image visible
      setRange({ min: contain * 0.6, max: cover * 6, cover });
      posRef.current = { x: (BOX - img.width * cover) / 2, y: (BOX - img.height * cover) / 2 };
      setScale(cover); // triggers redraw via effect
    };
    img.onerror = () => setErr(true); // e.g. HEIC that the browser can't decode
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(draw, [scale]);

  // zoom around the box center so it doesn't jump
  function zoomTo(next: number) {
    const cx = BOX / 2;
    const cy = BOX / 2;
    const u = (cx - posRef.current.x) / scale;
    const v = (cy - posRef.current.y) / scale;
    posRef.current = { x: cx - u * next, y: cy - v * next };
    setScale(next);
  }

  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
  }
  function onMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    posRef.current = { x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y };
    draw();
  }
  function onUp() {
    dragRef.current = null;
  }

  function save() {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = 240;
    out.height = 240;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";
    ctx.beginPath();
    ctx.arc(120, 120, 120, 0, Math.PI * 2);
    ctx.clip();
    // map the circle region (center R) of the stage into the 240px output
    const k = 240 / (2 * R);
    ctx.drawImage(
      img,
      posRef.current.x * k - (BOX / 2 - R) * k,
      posRef.current.y * k - (BOX / 2 - R) * k,
      img.width * scale * k,
      img.height * scale * k,
    );
    onSave(out.toDataURL("image/png"));
  }

  return (
    <div className="ow-crop">
      <p className="ow-crop__hint">Kéo để chỉnh vị trí · thanh trượt để phóng to / thu nhỏ.</p>
      {err ? (
        <p className="ow-crop__hint" style={{ color: "#ff9a9a" }}>
          Không đọc được ảnh này (có thể là HEIC). Hãy chọn ảnh JPG/PNG.
        </p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={BOX * DPR}
            height={BOX * DPR}
            style={{ width: BOX, height: BOX }}
            className="ow-crop__canvas"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
          />
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={(range.max - range.min) / 200}
            value={scale}
            onChange={(e) => zoomTo(Number(e.target.value))}
          />
        </>
      )}
      <div className="ow-crop__actions">
        <button onClick={onCancel}>Huỷ</button>
        <button className="ow-primary" onClick={save} disabled={err}>
          Lưu khuôn mặt
        </button>
      </div>
    </div>
  );
}

export default function FaceModal({ onClose }: { onClose: () => void }) {
  const faces = useFaces((s) => s.faces);
  const setFaces = useFaces((s) => s.setFaces);
  const [editing, setEditing] = useState<null | "a" | "b">(null);
  const [src, setSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<"a" | "b">("a");

  function pick(slot: "a" | "b") {
    pendingSlot.current = slot;
    fileRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setEditing(pendingSlot.current);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="ow-modal" onClick={onClose}>
      <div className="ow-modal__box" onClick={(e) => e.stopPropagation()}>
        <button className="ow-card__close" onClick={onClose}>
          ✕
        </button>
        <h3>Ghép khuôn mặt vào phương tiện 💕</h3>
        {editing && src ? (
          <CropStage
            src={src}
            onCancel={() => setEditing(null)}
            onSave={(d) => {
              setFaces({ ...faces, [editing]: d });
              setEditing(null);
              setSrc(null);
            }}
          />
        ) : (
          <>
            <p className="ow-modal__desc">
              Cắt khuôn mặt hai người để gắn lên xe/máy bay khi xem lại hành trình. Lưu trên trình duyệt này.
            </p>
            <div className="ow-faces">
              {(["a", "b"] as const).map((slot, i) => (
                <div className="ow-faceslot" key={slot}>
                  <div
                    className="ow-faceslot__preview"
                    style={faces[slot] ? { backgroundImage: `url('${faces[slot]}')` } : undefined}
                  >
                    {!faces[slot] && <span>Người {i + 1}</span>}
                  </div>
                  <button onClick={() => pick(slot)}>{faces[slot] ? "Đổi ảnh" : "Chọn ảnh"}</button>
                  {faces[slot] && (
                    <button className="ow-link" onClick={() => setFaces({ ...faces, [slot]: null })}>
                      Xoá
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </div>
  );
}
