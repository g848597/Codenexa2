import type { SaveStatus } from "../lib/useDesignSave";

export function DesignSaveBar({
  onDownload,
  onSave,
  status,
  errorMessage,
  disabled,
  optional = false,
}: {
  onDownload: () => void;
  onSave?: () => void;
  status: SaveStatus;
  errorMessage: string | null;
  disabled?: boolean;
  /** 5.4/5.6 — сохранение в проект опционально (по кнопке), формулировка
   * кнопки отличается, чтобы не путать с обязательным сохранением 5.1/5.2/5.3. */
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={disabled}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text
                     transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Скачать
        </button>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled || status === "saving"}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                       hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "saving" ? "Сохраняю…" : "Сохранить в проект"}
          </button>
        )}
      </div>
      {status === "done" && <p className="text-xs text-accent-2">Сохранено в историю проекта</p>}
      {status === "error" && errorMessage && <p className="text-xs text-danger">{errorMessage}</p>}
      {optional && status === "idle" && <p className="text-xs text-muted">Сохранение в проект опционально — файл уже можно скачать выше</p>}
    </div>
  );
}
