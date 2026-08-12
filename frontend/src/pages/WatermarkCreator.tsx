import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { anchorPosition, downloadDataUrl, exportCanvas, loadImage, readFileAsDataUrl } from "../lib/canvasUtils";
import { GRID_POSITIONS } from "../lib/designFormats";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { useDesignSave } from "../lib/useDesignSave";
import { DesignSaveBar } from "../components/DesignSaveBar";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type WatermarkType = "text" | "logo";

export function WatermarkCreator() {
  const { projectId, brandKit } = useActiveBrandKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>("text");
  const [text, setText] = useState("@mychannel");
  const [position, setPosition] = useState("bottom-right");
  const [opacity, setOpacity] = useState(0.6);
  const [size, setSize] = useState(0.08); // доля меньшей стороны изображения

  const { status, errorMessage, save } = useDesignSave(projectId, "watermark_creator");
  const fontFamily = brandKit?.font_family || "Inter, system-ui, sans-serif";

  useEffect(() => {
    if (!brandKit?.logo_url && watermarkType === "logo") setWatermarkType("text");
  }, [brandKit, watermarkType]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const src = await loadImage(sourceImage);
    canvas.width = src.naturalWidth;
    canvas.height = src.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0);

    const minSide = Math.min(canvas.width, canvas.height);
    const margin = Math.round(minSide * 0.04);
    ctx.globalAlpha = opacity;

    if (watermarkType === "logo" && brandKit?.logo_url) {
      try {
        const logo = await loadImage(brandKit.logo_url);
        const box = Math.round(minSide * size * 2);
        const { x, y } = anchorPosition(position, canvas.width, canvas.height, box, box, margin);
        ctx.drawImage(logo, x, y, box, box);
      } catch {
        /* лого недоступно — водяной знак не применяется, но фото сохраняется */
      }
    } else {
      const fontSize = Math.round(minSide * size);
      ctx.font = `600 ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = Math.max(1, fontSize * 0.05);
      const metrics = ctx.measureText(text);
      const { x, y } = anchorPosition(position, canvas.width, canvas.height, metrics.width, fontSize, margin);
      ctx.textBaseline = "top";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  }, [sourceImage, watermarkType, text, position, opacity, size, brandKit, fontFamily]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceImage(await readFileAsDataUrl(file));
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(exportCanvas(canvas, "png"), "watermarked.png");
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    save(exportCanvas(canvas, "png"), "watermarked.png", undefined, { watermark_type: watermarkType, position });
  };

  return (
    <ToolShell
      title="Watermark Creator"
      description="Наложить текстовый или фирменный водяной знак на изображение перед публикацией."
    >
      <Field label="Изображение">
        <input type="file" accept="image/*" onChange={handleUpload} className="text-sm text-muted" />
      </Field>

      {sourceImage && (
        <>
          <Field label="Тип водяного знака">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWatermarkType("text")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${watermarkType === "text" ? "border-accent text-accent" : "border-border text-muted"}`}
              >
                Текст
              </button>
              <button
                type="button"
                onClick={() => brandKit?.logo_url && setWatermarkType("logo")}
                disabled={!brandKit?.logo_url}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${watermarkType === "logo" ? "border-accent text-accent" : "border-border text-muted"}`}
              >
                Лого из Brand Kit
              </button>
            </div>
          </Field>

          {watermarkType === "text" && (
            <Field label="Текст">
              <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}

          <Field label="Позиция">
            <div className="grid grid-cols-3 gap-1.5">
              {GRID_POSITIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPosition(p.key)}
                  className={`rounded-lg border py-2 text-sm ${position === p.key ? "border-accent text-accent" : "border-border text-muted"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Прозрачность (${Math.round(opacity * 100)}%)`}>
            <input type="range" min={0.1} max={1} step={0.01} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Размер">
            <input type="range" min={0.03} max={0.2} step={0.005} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" />
          </Field>

          <div className="overflow-hidden rounded-card border border-border bg-surface-2 p-2">
            <canvas ref={canvasRef} style={{ width: "100%", height: "auto" }} className="rounded-lg" />
          </div>

          <DesignSaveBar onDownload={handleDownload} onSave={handleSave} status={status} errorMessage={errorMessage} optional />
        </>
      )}
    </ToolShell>
  );
}
