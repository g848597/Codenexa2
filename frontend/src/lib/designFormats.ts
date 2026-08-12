export interface SizePreset {
  key: string;
  label: string;
  width: number;
  height: number;
}

/** Готовые размеры из 5.1 — "селект с готовыми размерами". */
export const BANNER_FORMATS: SizePreset[] = [
  { key: "channel_cover", label: "Обложка канала (1520×400)", width: 1520, height: 400 },
  { key: "post", label: "Пост (1080×1080)", width: 1080, height: 1080 },
  { key: "story", label: "Сторис (1080×1920)", width: 1080, height: 1920 },
];

export const AVATAR_SIZE: SizePreset = { key: "avatar", label: "Аватар (512×512)", width: 512, height: 512 };

/** 5.4 Resize — "заданные ширина/высота или пресет (для аватара, баннера,
 * сторис)". */
export const RESIZE_PRESETS: SizePreset[] = [AVATAR_SIZE, ...BANNER_FORMATS];

export const CORNER_POSITIONS: { key: string; label: string }[] = [
  { key: "top-left", label: "Слева сверху" },
  { key: "top-right", label: "Справа сверху" },
  { key: "bottom-left", label: "Слева снизу" },
  { key: "bottom-right", label: "Справа снизу" },
];

/** 5.6 — "позиция (9 точек grid)". */
export const GRID_POSITIONS: { key: string; label: string }[] = [
  { key: "top-left", label: "↖" },
  { key: "top-center", label: "↑" },
  { key: "top-right", label: "↗" },
  { key: "middle-left", label: "←" },
  { key: "middle-center", label: "•" },
  { key: "middle-right", label: "→" },
  { key: "bottom-left", label: "↙" },
  { key: "bottom-center", label: "↓" },
  { key: "bottom-right", label: "↘" },
];
