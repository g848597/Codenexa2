import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  createContentPlanItem,
  deleteContentPlanItem,
  listContentPlan,
  updateContentPlanItem,
  type ContentPlanItem,
} from "../lib/api";
import { useActiveProjectId } from "../lib/useActiveProjectId";
import { CONTENT_PLAN_STATUSES } from "../lib/contentPlanStatuses";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

/**
 * Канбан 6.1. Drag-and-drop заявлен в спеке как основной способ, но по
 * самой же спеке "мобильно — можно селектом статуса вместо drag" — это
 * Telegram Mini App, то есть мобильный WebView почти всегда, поэтому
 * решили обойтись только селектом статуса на карточке (см. решение про
 * Pointer Events вместо drag-библиотеки в BannerCreator.tsx, Этап 5:
 * там перетаскивание оправдано визуальным позиционированием слоя, здесь
 * же это просто смена одного из 4 значений — селект надёжнее на
 * touch-устройствах и не требует доп. кода).
 */
export function ContentPlanBoard() {
  const projectId = useActiveProjectId();

  const [items, setItems] = useState<ContentPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    listContentPlan(projectId)
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? String(err.message) : "Не удалось загрузить контент-план"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleCreate = async () => {
    if (!projectId || !newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await createContentPlanItem(projectId, {
        title: newTitle.trim(),
        status: "idea",
        planned_date: newDate || null,
      });
      setItems((prev) => [res.item, ...prev]);
      setNewTitle("");
      setNewDate("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось создать карточку");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (item: ContentPlanItem, status: string) => {
    if (!projectId) return;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: status as ContentPlanItem["status"] } : it)));
    try {
      await updateContentPlanItem(projectId, item.id, { status });
    } catch {
      load(); // рассинхрон с сервером — перезагружаем список
    }
  };

  const handleDelete = async (item: ContentPlanItem) => {
    if (!projectId) return;
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    try {
      await deleteContentPlanItem(projectId, item.id);
    } catch {
      load();
    }
  };

  return (
    <ToolShell
      title="Контент-план"
      description="Канбан-доска для планирования публикаций: идея → в работе → готово → опубликовано."
    >
      <div className="flex items-center justify-between gap-3">
        <Link to="/tools/content-calendar" className="text-xs font-medium text-accent hover:underline">
          Открыть календарь →
        </Link>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          disabled={!projectId}
          title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity
                     hover:opacity-90 disabled:opacity-40"
        >
          {showForm ? "Отмена" : "+ Новая карточка"}
        </button>
      </div>

      {showForm && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <Field label="Название">
            <input
              className={inputClass}
              placeholder="например: анонс распродажи"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </Field>
          <Field label="Дата публикации (опционально)">
            <input type="date" className={inputClass} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                       hover:opacity-90 disabled:opacity-40"
          >
            {creating ? "Создаю…" : "Создать карточку"}
          </button>
        </div>
      )}

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}
      {!projectId && (
        <ConsolePanel tone="neutral">Доска доступна внутри Telegram Mini App с активным проектом.</ConsolePanel>
      )}
      {loading && <p className="text-sm text-muted">Загружаю…</p>}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {CONTENT_PLAN_STATUSES.map((col) => {
          const colItems = items.filter((it) => it.status === col.key);
          return (
            <div key={col.key} className="flex w-[240px] shrink-0 flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dotClass}`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted">{col.label}</span>
                <span className="ml-auto text-xs text-muted">{colItems.length}</span>
              </div>

              <div className="flex flex-col gap-2">
                {colItems.map((item) => (
                  <div key={item.id} className="rounded-card border border-border bg-surface p-3">
                    <p className="text-sm text-text">{item.title}</p>
                    {item.planned_date && (
                      <p className="mt-1 text-xs text-muted">{item.planned_date}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text
                                   focus:border-accent focus:outline-none"
                        value={item.status}
                        onChange={(e) => handleStatusChange(item, e.target.value)}
                      >
                        {CONTENT_PLAN_STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        title="Удалить карточку"
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted
                                   transition-colors hover:border-danger hover:text-danger"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <p className="rounded-card border border-dashed border-border p-3 text-center text-xs text-muted">
                    Пусто
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}
