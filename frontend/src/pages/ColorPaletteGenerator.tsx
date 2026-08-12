import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  PALETTE_SCHEMES,
  extractDominantColors,
  generateHarmoniousPalette,
  hexToRgb,
  type PaletteScheme,
} from "../lib/colorUtils";
import { loadImage, readFileAsDataUrl } from "../lib/canvasUtils";
import { updateBrandKit } from "../lib/api";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type Source = "base_color" | "image";

export function ColorPaletteGenerator() {
  const { projectId, brandKit } = useActiveBrandKit();
  const [source, setSource] = useState<Source>("base_color");
  const [baseColor, setBaseColor] = useState("#4c56ff");
  const [scheme, setScheme] = useState<PaletteScheme>("analogous");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => {
    if (brandKit?.primary_color) setBaseColor(brandKit.primary_color);
  }, [brandKit]);

  useEffect(() => {
    if (source === "base_color") {
      setPalette(generateHarmoniousPalette(baseColor, scheme));
    }
  }, [source, baseColor, scheme]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setImageDataUrl(dataUrl);
    setSource("image");
    const img = await loadImage(dataUrl);
    setPalette(extractDominantColors(img, 5));
  };

  const handleCopy = async (hex: string, index: number) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((i) => (i === index ? null : i)), 1200);
    } catch {
      /* буфер обмена недоступен (нет разрешения/не HTTPS) — свотч всё равно виден */
    }
  };

  const handleSaveToBrandKit = async () => {
    if (!projectId || palette.length < 3) return;
    setSaveStatus("saving");
    try {
      // Brand Kit хранит только 3 именованных цвета (primary/secondary/
      // accent) — берём первые 3 плашки палитры по порядку, остальные 2
      // остаются доступны только тут для копирования по клику.
      await updateBrandKit(projectId, {
        primary_color: palette[0],
        secondary_color: palette[1],
        accent_color: palette[2],
      });
      setSaveStatus("done");
    } catch {
      setSaveStatus("error");
    }
  };

  return (
    <ToolShell
      title="Color Palette Generator"
      description="5 гармоничных цветов от базового оттенка Brand Kit или из загруженной картинки."
    >
      <Field label="Источник">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSource("base_color")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${source === "base_color" ? "border-accent text-accent" : "border-border text-muted"}`}
          >
            Базовый цвет
          </button>
          <button
            type="button"
            onClick={() => imageDataUrl && setSource("image")}
            disabled={!imageDataUrl}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${source === "image" ? "border-accent text-accent" : "border-border text-muted"}`}
          >
            Из картинки
          </button>
        </div>
      </Field>

      {source === "base_color" ? (
        <>
          <Field label="Базовый цвет">
            <input type="color" value={baseColor} onChange={(e) => setBaseColor(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface" />
          </Field>
          <Field label="Схема">
            <select className={inputClass} value={scheme} onChange={(e) => setScheme(e.target.value as PaletteScheme)}>
              {PALETTE_SCHEMES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <Field label="Картинка">
          <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-muted" />
        </Field>
      )}

      {imageDataUrl && source === "image" && (
        <img src={imageDataUrl} alt="Источник палитры" className="mx-auto max-h-48 rounded-card border border-border object-contain" />
      )}

      {palette.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {palette.map((hex, i) => {
            const [r, g, b] = hexToRgb(hex);
            return (
              <button
                key={`${hex}-${i}`}
                type="button"
                onClick={() => handleCopy(hex, i)}
                className="flex flex-col items-stretch overflow-hidden rounded-lg border border-border text-left"
                title="Скопировать HEX"
              >
                <div className="h-16 w-full" style={{ backgroundColor: hex }} />
                <div className="bg-surface px-1.5 py-1 text-center">
                  <p className="text-[11px] font-medium text-text">{copiedIndex === i ? "Скопировано" : hex}</p>
                  <p className="text-[9px] text-muted">
                    {r}, {g}, {b}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {palette.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSaveToBrandKit}
            disabled={!projectId || saveStatus === "saving"}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Сохраняю…" : "Сохранить эту палитру в Brand Kit"}
          </button>
          {saveStatus === "done" && <p className="text-xs text-accent-2">Первые 3 цвета сохранены как primary/secondary/accent в Brand Kit</p>}
          {saveStatus === "error" && <p className="text-xs text-danger">Не удалось сохранить — попробуйте ещё раз</p>}
        </div>
      )}
    </ToolShell>
  );
}
