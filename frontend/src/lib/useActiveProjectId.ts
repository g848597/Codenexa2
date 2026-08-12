import { useEffect, useState } from "react";
import { listProjects } from "./api";
import { isInsideTelegram } from "./telegram";

/**
 * Общий хук "id активного проекта" — вынесен из повторяющегося кода
 * (см. UrlShortener.tsx, Этап 3: "listProjects → найти is_active_default")
 * для разделов, которым не нужен весь Brand Kit целиком (в отличие от
 * useActiveBrandKit.ts, Этап 4). Раздел «Рост» (Этап 6) использует его во
 * всех 4 модулях — контент-плану, календарю, генератору идей и генератору
 * опросов/викторин нужен только projectId, без tone_of_voice/brand_emojis.
 */
export function useActiveProjectId(): number | null {
  const [projectId, setProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (!isInsideTelegram()) return;
    let cancelled = false;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (active && !cancelled) setProjectId(active.id);
      })
      .catch(() => {
        /* нет активного проекта/не авторизован — модули просто останутся
           доступны только для чтения-без-сохранения, как и в Этапах 2-5 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return projectId;
}
