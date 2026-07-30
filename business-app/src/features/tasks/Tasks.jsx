import { useEffect, useMemo, useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import ListSkeleton from "../../components/ui/ListSkeleton";
import Glass from "../../components/ui/Glass";
import TopBar from "../../components/layout/TopBar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TaskFormModal from "./TaskFormModal";
import { TASK_COLUMNS } from "../../data/tasksData";
import { loadTasks, persistTask, persistTasksIndex, deleteTask } from "../../storage/tasksStorage";
import { haptic } from "../../utils/telegram";
import { daysUntil } from "../../utils/helpers";

function dueLabel(due, status) {
  if (!due) return "Без срока";
  if (status === "Готово") return "Завершено";
  const d = daysUntil(due);
  if (d === 0) return "Сегодня";
  if (d === 1) return "Завтра";
  if (d < 0) return `Просрочено на ${Math.abs(d)} дн.`;
  return new Date(due).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }).replace(".", "");
}
function dueColor(due, status) {
  if (status === "Готово") return "#17D896";
  if (!due) return "#9A9EA6";
  const d = daysUntil(due);
  if (d < 0) return "#FF5C5C";
  if (d <= 2) return "#F2B84B";
  return "#9A9EA6";
}

export default function Tasks({ onBack, projects }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items } = await loadTasks();
      if (!cancelled) { setTasks(items); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const columns = useMemo(() => {
    const map = Object.fromEntries(TASK_COLUMNS.map((c) => [c, []]));
    tasks.forEach((t) => { (map[t.status] || (map[t.status] = [])).push(t); });
    return map;
  }, [tasks]);

  function updateTask(id, patch) {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) persistTask(updated);
      return next;
    });
  }

  function moveTask(id, newStatus) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;
    updateTask(id, { status: newStatus });
    haptic("light");
  }

  function createTask(task) {
    setTasks((prev) => {
      const next = [task, ...prev];
      persistTask(task);
      persistTasksIndex(next);
      return next;
    });
    setShowForm(false);
  }

  function saveEditedTask(patch) {
    updateTask(patch.id, patch);
    setEditingTask(null);
  }

  function confirmDelete() {
    if (!deletingTask) return;
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== deletingTask.id);
      persistTasksIndex(next);
      return next;
    });
    deleteTask(deletingTask.id);
    setDeletingTask(null);
    haptic("warning");
  }

  return (
    <div className="cnb-screen">
      <TopBar title="Задачи" subtitle="Канбан-доска" onBack={onBack} />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="cnb-kanban">
          {TASK_COLUMNS.map((col) => (
            <div
              key={col}
              className={`cnb-kanban-col ${dragOverCol === col ? "cnb-kanban-col-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
              onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => { e.preventDefault(); if (dragId) moveTask(dragId, col); setDragOverCol(null); setDragId(null); }}
            >
              <div className="cnb-kanban-head">{col} <span className="cnb-kanban-count">{(columns[col] || []).length}</span></div>
              {(columns[col] || []).map((t) => (
                <Glass
                  key={t.id}
                  className="cnb-task-card"
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => setEditingTask(t)}
                >
                  <div className="cnb-task-card-top">
                    <div className="cnb-dot" style={{ background: t.tag }} />
                    <button
                      className="cnb-task-delete"
                      onClick={(e) => { e.stopPropagation(); setDeletingTask(t); }}
                      title="Удалить задачу"
                    ><Trash2 size={12} /></button>
                  </div>
                  <div className="cnb-task-title">{t.title}</div>
                  <div className="cnb-task-meta">{t.project}</div>
                  <div className="cnb-task-due" style={{ color: dueColor(t.due, t.status) }}>
                    <Clock size={11} /> {dueLabel(t.due, t.status)}
                  </div>
                </Glass>
              ))}
              {(columns[col] || []).length === 0 && <div className="cnb-kanban-empty">Пусто</div>}
            </div>
          ))}
        </div>
      )}

      {!loading && <button className="cnb-fab" onClick={() => setShowForm(true)}><Plus size={22} /></button>}

      <TaskFormModal open={showForm} initial={null} projects={projects} onClose={() => setShowForm(false)} onSubmit={createTask} />
      <TaskFormModal open={!!editingTask} initial={editingTask} projects={projects} onClose={() => setEditingTask(null)} onSubmit={saveEditedTask} />
      <ConfirmDialog
        open={!!deletingTask}
        title={`Удалить задачу «${deletingTask?.title}»?`}
        message="Это действие необратимо."
        confirmLabel="Удалить"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTask(null)}
      />

      <div style={{ height: 40 }} />
    </div>
  );
}
