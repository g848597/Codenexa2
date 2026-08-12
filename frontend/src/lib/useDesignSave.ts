import { useState } from "react";
import { saveToHistory, uploadDesignAsset } from "./api";

export type SaveStatus = "idle" | "saving" | "done" | "error";

/**
 * "Сохранить в проект" — общий для всех canvas-модулей Этапа 5: загружает
 * data URL в S3 (через POST /api/tools/design-upload, app/api/design.py),
 * затем пишет result_url в Smart History тем же универсальным
 * POST /api/projects/:id/history, что и Этапы 2-4 (см. DoD 05-design.md,
 * "Файлы сохраняются в S3, ссылки корректно отдаются в историю").
 */
export function useDesignSave(projectId: number | null, moduleKey: string) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const save = async (dataUrl: string, filename: string, title?: string, payload: unknown = {}) => {
    if (!projectId) {
      setStatus("error");
      setErrorMessage("Нет активного проекта — выберите или создайте проект в приложении");
      return;
    }
    setStatus("saving");
    setErrorMessage(null);
    try {
      const { url } = await uploadDesignAsset(projectId, moduleKey, filename, dataUrl);
      await saveToHistory(projectId, { module_key: moduleKey, title, payload, result_url: url });
      setSavedUrl(url);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMessage("Не удалось сохранить файл — попробуйте ещё раз");
    }
  };

  const reset = () => {
    setStatus("idle");
    setSavedUrl(null);
    setErrorMessage(null);
  };

  return { status, savedUrl, errorMessage, save, reset };
}
