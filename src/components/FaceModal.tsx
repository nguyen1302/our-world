"use client";
import { useEffect, useRef, useState } from "react";
import { useJourney } from "./journeyStore";

const BOX = 240;
const R = 100;

function CropStage({ src, onSave, onCancel }: { src: string; onSave: (d: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, BOX, BOX);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, posRef.current.x, posRef.current.y, w, h);
    // dim outside the circle
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,0.5)";
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
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const fit = Math.max(BOX / img.width, BOX / img.height);
      setScale(fit);
      posRef.current = { x: (BOX - img.width * fit) / 2, y: (BOX - img.height * fit) / 2 };
      draw();
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(draw, [scale]);

  function onDown(e: React.PointerEvent) {
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement("canvas");
    out.width = 200;
    out.height = 200;
    const ctx = out.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(canvas, BOX / 2 - R, BOX / 2 - R, 2 * R, 2 * R, 0, 0, 200, 200);
    onSave(out.toDataURL("image/png"));
  }

  return (
    <div className="ow-crop">
      <p className="ow-crop__hint">Kéo để chỉnh vị trí, dùng thanh trượt để phóng to khuôn mặt.</p>
      <canvas
        ref={canvasRef}
        width={BOX}
        height={BOX}
        className="ow-crop__canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
      <input
        type="range"
        min={0.2}
        max={4}
        step={0.01}
        value={scale}
        onChange={(e) => setScale(Number(e.target.value))}
      />
      <div className="ow-crop__actions">
        <button onClick={onCancel}>Huỷ</button>
        <button className="ow-primary" onClick={save}>
          Lưu khuôn mặt
        </button>
      </div>
    </div>
  );
}

export default function FaceModal({ onClose }: { onClose: () => void }) {
  const faces = useJourney((s) => s.faces);
  const setFaces = useJourney((s) => s.setFaces);
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
