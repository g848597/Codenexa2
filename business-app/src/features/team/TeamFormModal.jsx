import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Glass from "../../components/ui/Glass";
import { TEAM_ROLES } from "../../data/teamData";
import { genId, colorForName } from "../../utils/helpers";

export default function TeamFormModal({ open, initial, onClose, onSubmit }) {
  const isEdit = !!initial;
  const emptyForm = () => ({
    name: initial?.name || "",
    role: initial?.role || TEAM_ROLES[0],
    salary: initial?.salary != null ? String(initial.salary) : "",
  });
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setForm(emptyForm()); setTouched(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;
  const nameTrimmed = form.name.trim();
  const nameError = touched && !nameTrimmed ? "Укажите имя сотрудника" : null;

  function update(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  function handleSubmit() {
    setTouched(true);
    if (!nameTrimmed) return;
    const salary = Number(String(form.salary).replace(/[^\d]/g, "")) || 0;
    if (isEdit) {
      onSubmit({ ...initial, name: nameTrimmed, role: form.role, salary });
    } else {
      onSubmit({
        id: genId("u"), name: nameTrimmed, role: form.role, salary,
        kpi: 0, tasks: 0, color: colorForName(nameTrimmed), kpiHistory: [],
      });
    }
  }

  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-modal-title">{isEdit ? "Редактировать сотрудника" : "Новый сотрудник"}</div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cnb-modal-body">
          <div className="cnb-field">
            <label>Имя *</label>
            <input className={`cnb-input ${nameError ? "invalid" : ""}`} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Имя и фамилия" />
            {nameError && <div className="cnb-field-error">{nameError}</div>}
          </div>
          <div className="cnb-field">
            <label>Роль</label>
            <select className="cnb-input cnb-select" value={form.role} onChange={(e) => update("role", e.target.value)}>
              {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="cnb-field">
            <label>Зарплата, ₸ <span style={{ color: "#7A7E88", fontWeight: 400 }}>(видна только с подтверждением доступа)</span></label>
            <input className="cnb-input mono" value={form.salary} onChange={(e) => update("salary", e.target.value.replace(/[^\d]/g, ""))} placeholder="0" inputMode="numeric" />
          </div>
        </div>
        <div className="cnb-modal-actions">
          <button className="cnb-btn-secondary" onClick={onClose}>Отмена</button>
          <button className="cnb-btn-primary" onClick={handleSubmit}>{isEdit ? "Сохранить" : "Добавить сотрудника"}</button>
        </div>
      </Glass>
    </div>
  );
}
