import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { loadImage } from "../lib/canvasUtils";

/**
 * Общий QR-компонент (05-design.md, 5.3: "переиспользуется модулями Deep
 * Link Builder (Этап 2) и UTM Builder (Этап 3) — не дублировать логику,
 * вынести в `<QrGenerator />` как общий компонент"). До этого этапа оба
 * места (DeepLinkBuilder.tsx, UtmBuilder.tsx) генерировали QR инлайново
 * через `QRCode.toDataURL` — теперь оба переиспользуют этот компонент, а
 * сам QR Creator (5.3) — третье место использования.
 *
 * Логотип по центру (опция) поднимает уровень коррекции ошибок до 'H' и
 * рисуется поверх сгенерированного QR небольшим квадратом с белой
 * подложкой — иначе логотип на самом QR-паттерне ломает читаемость.
 */
export interface QrGeneratorProps {
  value: string;
  color?: string;
  size?: number;
  logoUrl?: string | null;
  onExport?: (pngDataUrl: string) => void;
}

export function QrGenerator({ value, color = "#000000", size = 240, logoUrl, onExport }: QrGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value.trim()) {
      setPngDataUrl(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        const canvas = document.createElement("canvas");
        await QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: logoUrl ? "H" : "M",
          color: { dark: color, light: "#ffffff" },
        });

        if (logoUrl) {
          const img = await loadImage(logoUrl);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // ~22% ширины — с error correction 'H' (до ~30% восстановимых
            // данных) остаётся заметный запас на читаемость.
            const logoSize = Math.round(canvas.width * 0.22);
            const x = (canvas.width - logoSize) / 2;
            const y = (canvas.height - logoSize) / 2;
            const pad = Math.round(logoSize * 0.12);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
            ctx.drawImage(img, x, y, logoSize, logoSize);
          }
        }

        if (cancelled) return;
        const dataUrl = canvas.toDataURL("image/png");
        setPngDataUrl(dataUrl);
        setError(null);
        onExport?.(dataUrl);

        const visible = canvasRef.current;
        if (visible) {
          visible.width = canvas.width;
          visible.height = canvas.height;
          const vctx = visible.getContext("2d");
          if (vctx) vctx.drawImage(canvas, 0, 0);
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось сгенерировать QR-код — проверьте значение");
          setPngDataUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, color, size, logoUrl]);

  if (!value.trim()) return null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-4">
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="rounded-lg" />
      {error && <span className="text-xs text-danger">{error}</span>}
      {pngDataUrl && !error && (
        <a
          href={pngDataUrl}
          download="qr-code.png"
          className="text-xs text-accent underline underline-offset-2"
        >
          Скачать PNG
        </a>
      )}
    </div>
  );
}

/** Экспорт в SVG (5.3: "экспорт PNG/SVG") — без логотипа, т.к. вставка
 * растрового изображения в SVG-QR потребовала бы встраивать его как
 * base64 внутрь `<image>`, а на 512×512 QR это делает файл тяжелее, чем
 * просто взять PNG-экспорт компонента выше. Для сценария "с лого" PNG —
 * основной формат. */
export async function generateQrSvg(value: string, color = "#000000"): Promise<string> {
  return QRCode.toString(value, { type: "svg", margin: 1, color: { dark: color, light: "#ffffff" } });
}
