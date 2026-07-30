import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Glass from "../../components/ui/Glass";
import { TASK_COLUMNS } from "../../data/tasksData";
import { genId, colorForName } from "../../utils/helpers";

export default function TaskFormModal({ open, initial, projects, onClose, onSubmit }) {
  const isEdit = !!initial;
  const projectNames = (projects || []).map((p) => p.name);

  const emptyForm = () => ({
    title: initial?.title || "",
    project: initial?.project || projectNames[0] || "",
    status: initial?.status || TASK_COLUMNS[0],
    due: initial?.due ? initial.due.slice(0, 10) : "",
  });
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setForm(emptyForm()); setTouched(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  const titleTrimmed = form.title.trim();
  const titleError = touched && !titleTrimmed ? "Укажите название задачи" : null;

  function update(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  function handleSubmit() {
    setTouched(true);
    if (!titleTrimmed) return;
    const due = form.due ? new Date(`${form.due}T12:00:00`).toISOString() : null;
    if (isEdit) {
      onSubmit({ ...initial, title: titleTrimmed, project: form.project, status: form.status, due });
    } else {
      onSubmit({
        id: genId("t"), title: titleTrimmed, project: form.project, status: form.status,
        due, tag: colorForName(form.project || titleTrimmed),
      });
    }
  }

  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-modal-title">{isEdit ? "Редактировать задачу" : "Новая задача"}</div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cnb-modal-body">
          <div className="cnb-field">
            <label>Название *</label>
            <input className={`cnb-input ${titleError ? "invalid" : ""}`} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Что нужно сделать" />
            {titleError && <div className="cnb-field-error">{titleError}</div>}
          </div>
          <div className="cnb-field">
            <label>Проект</label>
            {projectNames.length ? (
              <select className="cnb-input cnb-select" value={form.project} onChange={(e) => update("project", e.target.value)}>
                {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input className="cnb-input" value={form.project} onChange={(e) => update("project", e.target.value)} placeholder="Название проекта" />
            )}
          </div>
          <div className="cnb-field-row">
            <div className="cnb-field">
              <label>Колонка</label>
              <select className="cnb-input cnb-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
                {TASK_COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="cnb-field">
              <label>Срок</label>
              <input type="date" className="cnb-input" value={form.due} onChange={(e) => update("due", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="cnb-modal-actions">
          <button className="cnb-btn-secondary" onClick={onClose}>Отмена</button>
          <button className="cnb-btn-primary" onClick={handleSubmit}>{isEdit ? "Сохранить" : "Добавить задачу"}</button>
        </div>
      </Glass>
    </div>
  );
}
