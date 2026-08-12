/**
 * Общие canvas-хелперы для раздела «Дизайн» (Этап 5, 05-design.md).
 *
 * Спека предлагала fabric.js/konva для canvas-редактора — мы сознательно
 * обошлись без них: весь функционал (перетаскиваемый текстовый слой,
 * автоподбор размера шрифта, экспорт в PNG/JPG через `canvas.toBlob`) не
 * требует полноценного canvas-фреймворка, а лишняя зависимость увеличивает
 * бандл и площадь для багов на мобильном WebView (см. DoD Этапа 5 — именно
 * там частые проблемы с `canvas.toBlob`). Все 6 модулей раздела используют
 * этот файл вместо повторения одной и той же логики загрузки/экспорта.
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // crossOrigin не нужен (и мешает) для data: URL — только для внешних
    // ссылок (например, logo_url из Brand Kit, если он на S3).
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    img.src = src;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Размер данных под base64 data URL в килобайтах — для "превью до/после
 * с указанием нового размера в КБ" (5.4). */
export function dataUrlSizeKb(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = (base64.length * 3) / 4 - padding;
  return Math.max(1, Math.round(bytes / 1024));
}

/** Рисует изображение с object-fit: cover в прямоугольник (x, y, w, h) —
 * используется под фон баннера при "загрузка своей картинки" (5.1) и под
 * исходник в Resize/Crop (5.4), чтобы не растягивать пропорции. */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string[] {
  ctx.font = font;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Подбор наибольшего размера шрифта (с переносом строк), при котором текст
 * помещается в прямоугольник maxWidth×maxHeight — бинарный поиск, так как
 * между размером шрифта и итоговой высотой (после переноса) нет простой
 * формулы для произвольного шрифта/текста. Реализует "текст — с
 * автоподбором размера шрифта под контейнер" из 5.1.
 */
export function fitTextToBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  weight: string,
  maxWidth: number,
  maxHeight: number,
  minSize = 12,
  maxSize = 200,
): { fontSize: number; lines: string[]; lineHeight: number } {
  let lo = minSize;
  let hi = maxSize;
  let best = { fontSize: minSize, lines: wrapText(ctx, text, `${weight} ${minSize}px ${fontFamily}`, maxWidth) };
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const font = `${weight} ${mid}px ${fontFamily}`;
    const lines = wrapText(ctx, text, font, maxWidth);
    const lineHeight = mid * 1.25;
    if (lines.length * lineHeight <= maxHeight) {
      best = { fontSize: mid, lines };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return { ...best, lineHeight: best.fontSize * 1.25 };
}

/** Позиция прямоугольника contentW×contentH внутри boxW×boxH по одной из 9
 * точек grid (5.6) или 4 углов (5.1/5.2) — ключ вида "top-left"/"bottom-right"
 * либо просто "top"/"bottom"/"center" по вертикали и "left"/"right"/"center"
 * по горизонтали. */
export function anchorPosition(
  position: string,
  boxW: number,
  boxH: number,
  contentW: number,
  contentH: number,
  margin: number,
): { x: number; y: number } {
  const [v, h] = position.split("-");
  let x = margin;
  if (h === "center") x = (boxW - contentW) / 2;
  else if (h === "right") x = boxW - contentW - margin;
  let y = margin;
  if (v === "middle" || v === "center") y = (boxH - contentH) / 2;
  else if (v === "bottom") y = boxH - contentH - margin;
  return { x, y };
}

/** Экспорт canvas в PNG/JPEG data URL — canvas.toBlob иногда капризничает в
 * мобильном WebView Telegram (см. DoD Этапа 5), toDataURL синхронный и
 * работает надёжнее там, где это уже проверялось на практике. */
export function exportCanvas(canvas: HTMLCanvasElement, format: "png" | "jpeg", quality = 0.92): string {
  return format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
}
