import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  deleteContentPlanItem,
  listContentPlan,
  updateContentPlanItem,
  type ContentPlanItem,
} from "../lib/api";
import { useActiveProjectId } from "../lib/useActiveProjectId";
import { CONTENT_PLAN_STATUSES, statusDotClass, statusLabel } from "../lib/contentPlanStatuses";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Сетка месяца — недели с понедельника, дни соседних месяцев для
 * заполнения первой/последней недели идут как null (пустая ячейка), а не
 * как реальные даты чужого месяца — проще для этого MVP, чем тянуть их
 * publications тоже. */
function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=Вс..6=Сб -> переводим на неделю с понедельника (0=Пн..6=Вс)
  const firstWeekday = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function ContentCalendar() {
  const projectId = useActiveProjectId();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11

  const [items, setItems] = useState<ContentPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ContentPlanItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState("idea");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    listContentPlan(projectId, { withDateOnly: true })
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? String(err.message) : "Не удалось загрузить календарь"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const byDate = useMemo(() => {
    const map = new Map<string, ContentPlanItem[]>();
    for (const item of items) {
      if (!item.planned_date) continue;
      const key = item.planned_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const goPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const openEdit = (item: ContentPlanItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditStatus(item.status);
    setEditDate(item.planned_date ?? "");
  };

  const closeEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!projectId || !editing || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await updateContentPlanItem(projectId, editing.id, {
        title: editTitle.trim(),
        status: editStatus,
        ...(editDate ? { planned_date: editDate } : { clear_planned_date: true }),
      });
      setItems((prev) => prev.map((it) => (it.id === res.item.id ? res.item : it)).filter((it) => it.planned_date));
      closeEdit();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEdit = async () => {
    if (!projectId || !editing) return;
    setSaving(true);
    try {
      await deleteContentPlanItem(projectId, editing.id);
      setItems((prev) => prev.filter((it) => it.id !== editing.id));
      closeEdit();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось удалить карточку");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ToolShell
      title="Календарь публикаций"
      description="Тот же контент-план, только по датам — клик по карточке открывает редактирование."
    >
      <Link to="/tools/content-plan" className="text-xs font-medium text-accent hover:underline">
        ← К канбан-доске
      </Link>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}
      {!projectId && (
        <ConsolePanel tone="neutral">Календарь доступен внутри Telegram Mini App с активным проектом.</ConsolePanel>
      )}
      {loading && <p className="text-sm text-muted">Загружаю…</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-text"
        >
          ←
        </button>
        <span className="text-sm font-medium text-text">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-text"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              const key = day ? toDateKey(year, month, day) : null;
              const dayItems = key ? byDate.get(key) ?? [] : [];
              return (
                <div
                  key={di}
                  className={`min-h-[64px] rounded-lg border p-1 text-left ${
                    day ? "border-border bg-surface" : "border-transparent"
                  }`}
                >
                  {day && <div className="mb-1 text-[11px] text-muted">{day}</div>}
                  <div className="flex flex-col gap-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex items-center gap-1 truncate rounded bg-surface-2 px-1 py-0.5 text-left text-[10px] text-text
                                   hover:opacity-80"
                        title={item.title}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(item.status)}`} />
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-muted">+{dayItems.length - 3} ещё</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {editing && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Редактирование карточки</span>
            <button type="button" onClick={closeEdit} className="text-xs text-muted hover:text-text">
              ✕ Закрыть
            </button>
          </div>

          <Field label="Название">
            <input className={inputClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </Field>

          <Field label="Статус">
            <select className={inputClass} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              {CONTENT_PLAN_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Дата публикации">
            <input type="date" className={inputClass} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </Field>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                         hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={handleDeleteEdit}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted
                         transition-colors hover:border-danger hover:text-danger disabled:opacity-40"
            >
              Удалить
            </button>
          </div>
          <p className="text-xs text-muted">Текущий статус: {statusLabel(editing.status)}</p>
        </div>
      )}
    </ToolShell>
  );
}
