import { useEffect, useState } from "react";
import {
  ApiError,
  createContentPlanItem,
  deleteHistoryItem,
  listHistory,
  toggleHistoryFavorite,
  type HistoryItem,
} from "../lib/api";
import { useActiveProjectId } from "../lib/useActiveProjectId";
import { ConsolePanel } from "../components/ConsolePanel";
import { ToolShell } from "../components/ToolShell";

/**
 * Smart History (Этап 1, app/api/history.py) была реализована только на
 * бэкенде — фронтенд-страницы для неё не заводили ни в одном из Этапов 2-5
 * (каждый модуль пишет в историю через POST, но ничего её не читает). DoD
 * Этапа 6 явно требует "из Smart History можно одним действием создать
 * запись в контент-плане", для чего нужен хотя бы минимальный браузер
 * истории — добавлен здесь как часть Этапа 6, а не как отдельный "Этап 1.1",
 * чтобы не блокировать раздел «Рост» на доработке чужого этапа.
 */
export function SmartHistory() {
  const projectId = useActiveProjectId();

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    listHistory(projectId, { favorites: favoritesOnly })
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? String(err.message) : "Не удалось загрузить историю"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, favoritesOnly]);

  const handleToggleFavorite = async (item: HistoryItem) => {
    if (!projectId) return;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, is_favorite: !it.is_favorite } : it)));
    try {
      await toggleHistoryFavorite(projectId, item.id, !item.is_favorite);
    } catch {
      load();
    }
  };

  const handleDelete = async (item: HistoryItem) => {
    if (!projectId) return;
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    try {
      await deleteHistoryItem(projectId, item.id);
    } catch {
      load();
    }
  };

  const handleAddToPlan = async (item: HistoryItem) => {
    if (!projectId) return;
    try {
      await createContentPlanItem(projectId, {
        title: item.title?.trim() || item.module_key,
        status: "idea",
        linked_generated_item_id: item.id,
      });
      setAddedIds((prev) => new Set(prev).add(item.id));
    } catch {
      /* не критично для UX */
    }
  };

  return (
    <ToolShell title="История" description="Все сохранённые результаты по проекту — из любого модуля тулкита.">
      <label className="flex w-fit items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(e) => setFavoritesOnly(e.target.checked)}
          className="accent-accent"
        />
        Только избранное
      </label>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}
      {!projectId && (
        <ConsolePanel tone="neutral">История доступна внутри Telegram Mini App с активным проектом.</ConsolePanel>
      )}
      {loading && <p className="text-sm text-muted">Загружаю…</p>}
      {!loading && projectId && items.length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ConsolePanel
            key={item.id}
            copyValue={item.result_text ?? undefined}
            meta={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted">{item.module_key}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(item)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {item.is_favorite ? "★ В избранном" : "☆ В избранное"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddToPlan(item)}
                    disabled={!projectId}
                    className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                  >
                    {addedIds.has(item.id) ? "✓ В плане" : "В контент-план"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-xs font-medium text-muted hover:text-danger"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            }
          >
            {item.result_text ?? item.title ?? "(без текстового результата)"}
            {item.result_url && (
              <>
                {"\n"}
                <a href={item.result_url} target="_blank" rel="noreferrer" className="text-accent underline">
                  {item.result_url}
                </a>
              </>
            )}
          </ConsolePanel>
        ))}
      </div>
    </ToolShell>
  );
}
