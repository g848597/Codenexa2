import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { drawImageCover, exportCanvas, loadImage, readFileAsDataUrl } from "../lib/canvasUtils";
import { AVATAR_SIZE } from "../lib/designFormats";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { useDesignSave } from "../lib/useDesignSave";
import { DesignSaveBar } from "../components/DesignSaveBar";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type Source = "upload" | "initials";
type CropShape = "circle" | "square";
type CropRatio = "fixed" | "free"; // fixed = 1:1, free = произвольное позиционирование/масштаб по осям

const SIZE = AVATAR_SIZE.width; // 512

export function AvatarCreator() {
  const { projectId, brandKit } = useActiveBrandKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const [source, setSource] = useState<Source>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [initials, setInitials] = useState("АБ");
  const [bgColor, setBgColor] = useState("#4c56ff");
  const [cropShape, setCropShape] = useState<CropShape>("circle");
  const [cropRatio, setCropRatio] = useState<CropRatio>("fixed");
  const [zoom, setZoom] = useState(1);
  const [zoomY, setZoomY] = useState(1); // используется только в режиме "free"
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const { status, errorMessage, save } = useDesignSave(projectId, "avatar_creator");
  const fontFamily = brandKit?.font_family || "Inter, system-ui, sans-serif";

  useEffect(() => {
    if (brandKit?.primary_color) setBgColor(brandKit.primary_color);
  }, [brandKit]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setZoomY(1);
  }, [uploadedImage, cropRatio]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);

    ctx.save();
    if (cropShape === "circle") {
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    if (source === "initials") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(SIZE * 0.42)}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((initials || "").slice(0, 2).toUpperCase(), SIZE / 2, SIZE / 2 + SIZE * 0.02);
    } else if (uploadedImage) {
      try {
        const img = await loadImage(uploadedImage);
        const sx = zoom;
        const sy = cropRatio === "free" ? zoomY : zoom;
        const w = SIZE * sx;
        const h = SIZE * sy;
        const x = (SIZE - w) / 2 + pan.x;
        const y = (SIZE - h) / 2 + pan.y;
        drawImageCover(ctx, img, x, y, w, h);
      } catch {
        ctx.fillStyle = "#e4e7ee";
        ctx.fillRect(0, 0, SIZE, SIZE);
      }
    } else {
      ctx.fillStyle = "#e4e7ee";
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
    ctx.restore();

    if (cropShape === "square") {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    }
  }, [source, uploadedImage, initials, bgColor, cropShape, cropRatio, zoom, zoomY, pan, fontFamily]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImage(await readFileAsDataUrl(file));
    setSource("upload");
  };

  const relativePointer = (e: ReactPointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (source !== "upload" || !uploadedImage) return;
    const pos = relativePointer(e);
    dragRef.current = { startX: pos.x, startY: pos.y, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const pos = relativePointer(e);
    setPan({ x: dragRef.current.panX + (pos.x - dragRef.current.startX), y: dragRef.current.panY + (pos.y - dragRef.current.startY) });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = exportCanvas(canvas, "png");
    a.download = "avatar-512x512.png";
    a.click();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    save(exportCanvas(canvas, "png"), "avatar-512x512.png", source === "initials" ? initials : "Аватар", {
      source,
      crop_shape: cropShape,
    });
  };

  return (
    <ToolShell
      title="Avatar Creator"
      description="Аватар из фото или инициалов на фирменном цвете, круглая маска — как превью в Telegram."
    >
      <Field label="Источник">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSource("upload")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${source === "upload" ? "border-accent text-accent" : "border-border text-muted"}`}
          >
            Загрузить фото
          </button>
          <button
            type="button"
            onClick={() => setSource("initials")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${source === "initials" ? "border-accent text-accent" : "border-border text-muted"}`}
          >
            Инициалы
          </button>
        </div>
      </Field>

      {source === "upload" ? (
        <>
          <Field label="Изображение">
            <input type="file" accept="image/*" onChange={handleUpload} className="text-sm text-muted" />
          </Field>
          <Field label="Соотношение обрезки">
            <div className="flex gap-2">
              <button type="button" onClick={() => setCropRatio("fixed")} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${cropRatio === "fixed" ? "border-accent text-accent" : "border-border text-muted"}`}>
                1:1
              </button>
              <button type="button" onClick={() => setCropRatio("free")} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${cropRatio === "free" ? "border-accent text-accent" : "border-border text-muted"}`}>
                Свободное
              </button>
            </div>
          </Field>
          <Field label={cropRatio === "free" ? "Масштаб по ширине" : "Масштаб"}>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
          </Field>
          {cropRatio === "free" && (
            <Field label="Масштаб по высоте">
              <input type="range" min={1} max={3} step={0.01} value={zoomY} onChange={(e) => setZoomY(Number(e.target.value))} className="w-full" />
            </Field>
          )}
        </>
      ) : (
        <>
          <Field label="Инициалы (1-2 буквы)">
            <input className={inputClass} maxLength={2} value={initials} onChange={(e) => setInitials(e.target.value)} />
          </Field>
          <Field label="Цвет фона">
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface" />
          </Field>
        </>
      )}

      <Field label="Форма обрезки">
        <div className="flex gap-2">
          <button type="button" onClick={() => setCropShape("circle")} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${cropShape === "circle" ? "border-accent text-accent" : "border-border text-muted"}`}>
            Круг
          </button>
          <button type="button" onClick={() => setCropShape("square")} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${cropShape === "square" ? "border-accent text-accent" : "border-border text-muted"}`}>
            Квадрат
          </button>
        </div>
      </Field>

      <div className="flex justify-center rounded-card border border-border bg-surface-2 p-4">
        <canvas
          ref={canvasRef}
          style={{ width: 220, height: 220, touchAction: "none", cursor: source === "upload" ? "grab" : "default" }}
          className={cropShape === "circle" ? "rounded-full" : "rounded-lg"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      {source === "upload" && <p className="-mt-3 text-center text-xs text-muted">Перетащите фото, чтобы сдвинуть кадр</p>}

      <DesignSaveBar onDownload={handleDownload} onSave={handleSave} status={status} errorMessage={errorMessage} />
    </ToolShell>
  );
}
