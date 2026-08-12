import { useEffect, useState } from "react";
import { getBrandKit, listProjects, type BrandKit } from "./api";
import { isInsideTelegram } from "./telegram";

/**
 * Раздел «Контент» (Этап 4) зависит от Brand Kit — все модули используют
 * tone_of_voice как дефолт тона и brand_emojis как источник фирменных
 * эмодзи (см. 04-content.md). Этот хук инкапсулирует уже существующий
 * паттерн "найти активный проект" (см. BioGenerator.tsx/MarkdownBuilder.tsx
 * из Этапов 2-3) и добавляет к нему подгрузку самого Brand Kit — чтобы не
 * повторять две последовательные загрузки в каждой из 6 страниц раздела.
 */
export function useActiveBrandKit() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);

  useEffect(() => {
    if (!isInsideTelegram()) return;
    let cancelled = false;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (!active || cancelled) return null;
        setProjectId(active.id);
        return getBrandKit(active.id);
      })
      .then((res) => {
        if (res && !cancelled) setBrandKit(res.brand_kit);
      })
      .catch(() => {
        /* нет активного проекта/не авторизован — тон просто останется дефолтным,
           а сохранение в историю будет недоступно (как и в Этапах 2-3) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { projectId, brandKit };
}
