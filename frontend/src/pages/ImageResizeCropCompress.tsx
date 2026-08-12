import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { dataUrlSizeKb, downloadDataUrl, drawImageCover, exportCanvas, loadImage, readFileAsDataUrl } from "../lib/canvasUtils";
import { RESIZE_PRESETS } from "../lib/designFormats";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { useDesignSave } from "../lib/useDesignSave";
import { DesignSaveBar } from "../components/DesignSaveBar";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type Mode = "resize" | "crop" | "compress";

export function ImageResizeCropCompress() {
  const { projectId } = useActiveBrandKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const [mode, setMode] = useState<Mode>("resize");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Resize
  const [presetKey, setPresetKey] = useState<string>(RESIZE_PRESETS[0].key);
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1080);
  const [useCustomSize, setUseCustomSize] = useState(false);

  // Crop
  const [cropAspect, setCropAspect] = useState<"free" | "1:1" | "4:5" | "16:9">("1:1");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Compress
  const [quality, setQuality] = useState(0.8);
  const [targetSizeKb, setTargetSizeKb] = useState<number | "">("");

  const [outputDataUrl, setOutputDataUrl] = useState<string | null>(null);
  const [outputInfo, setOutputInfo] = useState<{ w: number; h: number; kb: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const { status, errorMessage, save } = useDesignSave(projectId, "image_resize_crop_compress");

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [sourceImage, cropAspect]);

  const cropDims = useCallback((): { w: number; h: number } => {
    if (!naturalSize) return { w: 1, h: 1 };
    if (cropAspect === "free") return naturalSize;
    const [rw, rh] = cropAspect.split(":").map(Number);
    // Крупнейший прямоугольник с соотношением rw:rh, вписанный в исходник.
    const ratio = rw / rh;
    const srcRatio = naturalSize.w / naturalSize.h;
    return srcRatio > ratio ? { w: naturalSize.h * ratio, h: naturalSize.h } : { w: naturalSize.w, h: naturalSize.w / ratio };
  }, [naturalSize, cropAspect]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    setSourceImage(dataUrl);
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setOutputDataUrl(null);
    setOutputInfo(null);
  };

  const relativePointer = (e: ReactPointerEvent, previewEl: HTMLElement) => {
    const rect = previewEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pos = relativePointer(e, e.currentTarget);
    dragRef.current = { startX: pos.x, startY: pos.y, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const pos = relativePointer(e, e.currentTarget);
    setPan({ x: dragRef.current.panX + (pos.x - dragRef.current.startX), y: dragRef.current.panY + (pos.y - dragRef.current.startY) });
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleProcess = async () => {
    if (!sourceImage) return;
    setBusy(true);
    try {
      const img = await loadImage(sourceImage);

      if (mode === "resize") {
        const preset = RESIZE_PRESETS.find((p) => p.key === presetKey);
        const w = useCustomSize ? customW : preset?.width ?? customW;
        const h = useCustomSize ? customH : preset?.height ?? customH;
        const canvas = canvasRef.current!;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        drawImageCover(ctx, img, 0, 0, w, h);
        const dataUrl = exportCanvas(canvas, "png");
        setOutputDataUrl(dataUrl);
        setOutputInfo({ w, h, kb: dataUrlSizeKb(dataUrl) });
      } else if (mode === "crop") {
        const { w: cw, h: ch } = cropDims();
        const canvas = canvasRef.current!;
        canvas.width = Math.round(cw);
        canvas.height = Math.round(ch);
        const ctx = canvas.getContext("2d")!;
        // pan/zoom заданы в координатах превью (240px) — переводим в масштаб
        // исходника через отношение canvas.width к ширине превью.
        const previewW = 240;
        const scale = canvas.width / previewW;
        const drawW = canvas.width * zoom;
        const drawH = canvas.height * zoom;
        const x = (canvas.width - drawW) / 2 + pan.x * scale;
        const y = (canvas.height - drawH) / 2 + pan.y * scale;
        drawImageCover(ctx, img, x, y, drawW, drawH);
        const dataUrl = exportCanvas(canvas, "png");
        setOutputDataUrl(dataUrl);
        setOutputInfo({ w: canvas.width, h: canvas.height, kb: dataUrlSizeKb(dataUrl) });
      } else {
        const canvas = canvasRef.current!;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        let finalQuality = quality;
        let dataUrl = exportCanvas(canvas, "jpeg", finalQuality);
        if (targetSizeKb && Number(targetSizeKb) > 0) {
          // Целевой размер — уменьшаем качество шагами, пока не впишемся
          // (или не упрёмся в минимум 0.1, чтобы не зациклиться).
          let guard = 0;
          while (dataUrlSizeKb(dataUrl) > Number(targetSizeKb) && finalQuality > 0.1 && guard < 25) {
            finalQuality -= 0.05;
            dataUrl = exportCanvas(canvas, "jpeg", finalQuality);
            guard += 1;
          }
        }
        setOutputDataUrl(dataUrl);
        setOutputInfo({ w: canvas.width, h: canvas.height, kb: dataUrlSizeKb(dataUrl) });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!outputDataUrl) return;
    downloadDataUrl(outputDataUrl, mode === "compress" ? "compressed.jpg" : `${mode}.png`);
  };

  const handleSave = () => {
    if (!outputDataUrl) return;
    save(outputDataUrl, mode === "compress" ? "compressed.jpg" : `${mode}.png`, undefined, { mode, ...outputInfo });
  };

  const sourceKb = sourceImage ? dataUrlSizeKb(sourceImage) : null;

  return (
    <ToolShell
      title="Resize / Crop / Compress"
      description="Подогнать картинку под нужный формат или вес — без внешних сервисов, всё на клиенте."
    >
      <Field label="Изображение">
        <input type="file" accept="image/*" onChange={handleUpload} className="text-sm text-muted" />
      </Field>

      {sourceImage && naturalSize && (
        <>
          <Field label="Режим">
            <div className="flex gap-2">
              {(["resize", "crop", "compress"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setOutputDataUrl(null);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${mode === m ? "border-accent text-accent" : "border-border text-muted"}`}
                >
                  {m === "resize" ? "Resize" : m === "crop" ? "Crop" : "Compress"}
                </button>
              ))}
            </div>
          </Field>

          {naturalSize.w * naturalSize.h > 4000 * 4000 && (
            <p className="text-xs text-muted">Большой файл ({naturalSize.w}×{naturalSize.h}) — обработка на устройстве может занять время</p>
          )}

          {mode === "resize" && (
            <>
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={useCustomSize} onChange={(e) => setUseCustomSize(e.target.checked)} />
                Свой размер вместо пресета
              </label>
              {useCustomSize ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ширина, px">
                    <input type="number" className={inputClass} value={customW} onChange={(e) => setCustomW(Number(e.target.value))} />
                  </Field>
                  <Field label="Высота, px">
                    <input type="number" className={inputClass} value={customH} onChange={(e) => setCustomH(Number(e.target.value))} />
                  </Field>
                </div>
              ) : (
                <Field label="Пресет">
                  <select className={inputClass} value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                    {RESIZE_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}

          {mode === "crop" && (
            <>
              <Field label="Соотношение сторон">
                <div className="flex flex-wrap gap-2">
                  {(["free", "1:1", "4:5", "16:9"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setCropAspect(a)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${cropAspect === a ? "border-accent text-accent" : "border-border text-muted"}`}
                    >
                      {a === "free" ? "Свободно" : a}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Масштаб">
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
              </Field>
              <div
                className="relative mx-auto overflow-hidden rounded-lg border border-border bg-surface-2"
                style={{ width: 240, height: 240 * (cropDims().h / cropDims().w), touchAction: "none", cursor: "grab" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <img
                  src={sourceImage}
                  alt="Кадрируемое изображение"
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: `${zoom * 100}%`,
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                  }}
                />
              </div>
              <p className="-mt-3 text-center text-xs text-muted">Перетащите, чтобы выбрать область кадрирования</p>
            </>
          )}

          {mode === "compress" && (
            <>
              <Field label={`Качество JPEG (${Math.round(quality * 100)}%)`}>
                <input type="range" min={0.1} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
              </Field>
              <Field label="Целевой размер, КБ (опционально)">
                <input
                  type="number"
                  className={inputClass}
                  placeholder="например, 300"
                  value={targetSizeKb}
                  onChange={(e) => setTargetSizeKb(e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
            </>
          )}

          <button
            type="button"
            onClick={handleProcess}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Обрабатываю…" : "Применить"}
          </button>

          {outputDataUrl && outputInfo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-card border border-border bg-surface p-3 text-center">
                <p className="text-xs uppercase text-muted">До</p>
                <img src={sourceImage} alt="До" className="mx-auto mt-2 max-h-40 rounded-lg object-contain" />
                <p className="mt-2 text-xs text-muted">
                  {naturalSize.w}×{naturalSize.h}px · {sourceKb} КБ
                </p>
              </div>
              <div className="rounded-card border border-border bg-surface p-3 text-center">
                <p className="text-xs uppercase text-muted">После</p>
                <img src={outputDataUrl} alt="После" className="mx-auto mt-2 max-h-40 rounded-lg object-contain" />
                <p className="mt-2 text-xs text-muted">
                  {outputInfo.w}×{outputInfo.h}px · {outputInfo.kb} КБ
                </p>
              </div>
            </div>
          )}

          {outputDataUrl && (
            <DesignSaveBar onDownload={handleDownload} onSave={handleSave} status={status} errorMessage={errorMessage} optional />
          )}
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </ToolShell>
  );
}
