/**
 * HSL-математика для 5.5 Color Palette Generator — без внешних либ.
 * Спека упоминала `colorthief` как пример ("например через `colorthief`"),
 * не как обязательную зависимость — извлечение доминирующих цветов из
 * картинки реализовано напрямую через canvas pixel sampling ниже, чтобы не
 * тащить ещё один пакет ради ~30 строк квантования.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = 60 * (((g - b) / d) % 6);
        break;
      case g:
        h = 60 * ((b - r) / d + 2);
        break;
      default:
        h = 60 * ((r - g) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return [h, s * 100, l * 100];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number] = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}

export type PaletteScheme = "complementary" | "analogous" | "triadic";

export const PALETTE_SCHEMES: { key: PaletteScheme; label: string }[] = [
  { key: "analogous", label: "Аналоговая" },
  { key: "complementary", label: "Комплементарная" },
  { key: "triadic", label: "Триадная" },
];

/** 5 гармоничных цветов от базового — угол сдвига по кругу оттенков задаёт
 * схема, светлота/насыщенность остальных плашек слегка варьируется, чтобы
 * палитра не выглядела как пять точек ровно на одном тоне. */
export function generateHarmoniousPalette(baseHex: string, scheme: PaletteScheme): string[] {
  const [h, s, l] = rgbToHsl(...hexToRgb(baseHex));
  const angleSets: Record<PaletteScheme, number[]> = {
    complementary: [0, 180, 30, 210, -30],
    analogous: [0, 30, 60, -30, -60],
    triadic: [0, 120, 240, 60, 300],
  };
  return angleSets[scheme].map((delta, i) => {
    const hue = (((h + delta) % 360) + 360) % 360;
    const lightness = i === 0 ? l : Math.min(88, Math.max(18, l + (i % 2 === 0 ? 1 : -1) * 10 * ((i + 1) / 5)));
    const saturation = i === 0 ? s : Math.min(95, Math.max(25, s));
    return rgbToHex(...hslToRgb(hue, saturation, lightness));
  });
}

/**
 * Доминирующие цвета картинки: сэмплируем уменьшенную копию (иначе на
 * больших фото getImageData считается заметно дольше), квантуем каждый
 * пиксель в бакет по 32 уровня на канал и берём центры самых частых
 * бакетов — простое, но достаточно устойчивое приближение k-means для 5
 * цветов.
 */
export function extractDominantColors(img: HTMLImageElement, count = 5): string[] {
  const canvas = document.createElement("canvas");
  const w = (canvas.width = Math.max(1, Math.min(200, img.naturalWidth || img.width)));
  const h = (canvas.height = Math.max(1, Math.min(200, img.naturalHeight || img.height)));
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const step = 32;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue; // прозрачные пиксели не в счёт
    const key = `${(r / step) | 0}-${(g / step) | 0}-${(b / step) | 0}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, count);
  const colors = sorted.map((b) => rgbToHex(b.r / b.count, b.g / b.count, b.b / b.count));
  // Мало уникальных бакетов (почти монохромная картинка) — не оставляем
  // палитру короче 5-и, достраиваем вариациями светлоты последнего цвета.
  while (colors.length > 0 && colors.length < count) {
    const [hh, ss, ll] = rgbToHsl(...hexToRgb(colors[colors.length - 1]));
    colors.push(rgbToHex(...hslToRgb(hh, ss, Math.max(10, Math.min(90, ll + (colors.length % 2 === 0 ? 15 : -15))))));
  }
  return colors;
}
