import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { anchorPosition, drawImageCover, exportCanvas, fitTextToBox, loadImage, readFileAsDataUrl } from "../lib/canvasUtils";
import { BANNER_FORMATS, CORNER_POSITIONS } from "../lib/designFormats";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { useDesignSave } from "../lib/useDesignSave";
import { DesignSaveBar } from "../components/DesignSaveBar";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type BgMode = "color" | "gradient" | "image";

const LOGO_BOX_RATIO = 0.12; // логотип — до ~12% меньшей стороны канваса

export function BannerCreator() {
  const { projectId, brandKit } = useActiveBrandKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  const [formatKey, setFormatKey] = useState(BANNER_FORMATS[0].key);
  const [bgMode, setBgMode] = useState<BgMode>("color");
  const [bgColor, setBgColor] = useState("#4c56ff");
  const [bgColor2, setBgColor2] = useState("#0ea394");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [title, setTitle] = useState("Мой канал");
  const [subtitle, setSubtitle] = useState("");
  const [logoPosition, setLogoPosition] = useState("top-left");
  const [textOffset, setTextOffset] = useState({ x: 0, y: 0 });

  const { status, errorMessage, save } = useDesignSave(projectId, "banner_creator");
  const format = BANNER_FORMATS.find((f) => f.key === formatKey) ?? BANNER_FORMATS[0];
  const fontFamily = brandKit?.font_family || "Inter, system-ui, sans-serif";

  useEffect(() => {
    if (brandKit?.primary_color) setBgColor(brandKit.primary_color);
    if (brandKit?.secondary_color) setBgColor2(brandKit.secondary_color);
  }, [brandKit]);

  // Смена формата сбрасывает ручной сдвиг текстового блока — старое
  // смещение может выбросить текст за пределы канваса другой пропорции.
  useEffect(() => setTextOffset({ x: 0, y: 0 }), [formatKey]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = format.width;
    canvas.height = format.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- фон ---
    if (bgMode === "color") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgMode === "gradient") {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, bgColor);
      gradient.addColorStop(1, bgColor2);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgMode === "image" && bgImage) {
      try {
        const img = await loadImage(bgImage);
        drawImageCover(ctx, img, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; // затемнение, чтобы текст читался поверх фото
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } catch {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- логотип ---
    if (brandKit?.logo_url) {
      try {
        const logo = await loadImage(brandKit.logo_url);
        const box = Math.round(Math.min(canvas.width, canvas.height) * LOGO_BOX_RATIO);
        const margin = Math.round(box * 0.5);
        const { x, y } = anchorPosition(logoPosition, canvas.width, canvas.height, box, box, margin);
        ctx.drawImage(logo, x, y, box, box);
      } catch {
        /* лого недоступно — баннер всё равно рендерится без него */
      }
    }

    // --- текст (заголовок + подзаголовок), перетаскиваемый блок ---
    const padding = Math.round(canvas.width * 0.08);
    const boxW = canvas.width - padding * 2;
    const boxH = canvas.height * 0.6;
    const boxX = padding + textOffset.x;
    const boxY = (canvas.height - boxH) / 2 + textOffset.y;
    textBoxRef.current = { x: boxX, y: boxY, w: boxW, h: boxH };

    const titleFit = fitTextToBox(ctx, title || " ", fontFamily, "700", boxW, boxH * (subtitle ? 0.7 : 1));
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.font = `700 ${titleFit.fontSize}px ${fontFamily}`;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    let cursorY = boxY;
    for (const line of titleFit.lines) {
      ctx.fillText(line, boxX, cursorY);
      cursorY += titleFit.lineHeight;
    }

    if (subtitle) {
      const subtitleFit = fitTextToBox(ctx, subtitle, fontFamily, "400", boxW, boxH * 0.3, 10, Math.round(titleFit.fontSize * 0.6));
      ctx.font = `400 ${subtitleFit.fontSize}px ${fontFamily}`;
      cursorY += titleFit.lineHeight * 0.3;
      for (const line of subtitleFit.lines) {
        ctx.fillText(line, boxX, cursorY);
        cursorY += subtitleFit.lineHeight;
      }
    }
    ctx.shadowBlur = 0;
  }, [format, bgMode, bgColor, bgColor2, bgImage, title, subtitle, logoPosition, textOffset, brandKit, fontFamily]);

  useEffect(() => {
    draw();
  }, [draw]);

  const relativePointer = (e: ReactPointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  const handlePointerDown = (e: ReactPointerEvent) => {
    const pos = relativePointer(e);
    dragRef.current = { startX: pos.x, startY: pos.y, offsetX: textOffset.x, offsetY: textOffset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const pos = relativePointer(e);
    const dx = pos.x - dragRef.current.startX;
    const dy = pos.y - dragRef.current.startY;
    setTextOffset({ x: dragRef.current.offsetX + dx, y: dragRef.current.offsetY + dy });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleBgImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgImage(await readFileAsDataUrl(file));
    setBgMode("image");
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = exportCanvas(canvas, "png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `banner-${formatKey}.png`;
    a.click();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    save(exportCanvas(canvas, "png"), `banner-${formatKey}.png`, title || format.label, {
      format: formatKey,
      bg_mode: bgMode,
      title,
      subtitle,
    });
  };

  return (
    <ToolShell
      title="Banner Creator"
      description="Баннер для обложки канала, поста или сторис — фон, текст и лого из Brand Kit подставляются по умолчанию."
    >
      <Field label="Формат">
        <select className={inputClass} value={formatKey} onChange={(e) => setFormatKey(e.target.value)}>
          {BANNER_FORMATS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Фон">
        <div className="flex gap-2">
          {(["color", "gradient", "image"] as BgMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setBgMode(mode)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                bgMode === mode ? "border-accent text-accent" : "border-border text-muted hover:text-text"
              }`}
            >
              {mode === "color" ? "Цвет" : mode === "gradient" ? "Градиент" : "Картинка"}
            </button>
          ))}
        </div>
      </Field>

      {bgMode !== "image" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={bgMode === "gradient" ? "Цвет 1" : "Цвет фона"}>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface" />
          </Field>
          {bgMode === "gradient" && (
            <Field label="Цвет 2">
              <input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface" />
            </Field>
          )}
        </div>
      )}
      {bgMode === "image" && (
        <Field label="Своя картинка">
          <input type="file" accept="image/*" onChange={handleBgImageUpload} className="text-sm text-muted" />
        </Field>
      )}

      <Field label="Заголовок">
        <textarea className={inputClass} rows={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок баннера" />
      </Field>
      <Field label="Подзаголовок (опционально)">
        <input className={inputClass} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Короткая подпись" />
      </Field>

      <Field label="Позиция логотипа">
        <select className={inputClass} value={logoPosition} onChange={(e) => setLogoPosition(e.target.value)}>
          {CORNER_POSITIONS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        {!brandKit?.logo_url && <span className="text-xs text-muted">Лого не задано в Brand Kit — баннер рендерится без него</span>}
      </Field>

      <div ref={wrapperRef} className="overflow-hidden rounded-card border border-border bg-surface-2 p-2">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", touchAction: "none", cursor: "grab" }}
          className="rounded-lg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <p className="-mt-3 text-xs text-muted">Перетащите текст на превью, чтобы сдвинуть его по баннеру</p>

      <DesignSaveBar onDownload={handleDownload} onSave={handleSave} status={status} errorMessage={errorMessage} />
    </ToolShell>
  );
}
