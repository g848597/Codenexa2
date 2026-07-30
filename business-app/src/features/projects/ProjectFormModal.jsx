import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Glass from "../../components/ui/Glass";
import { TEAM } from "../../data/teamData";
import { PROJECT_STATUS_LIST } from "../../data/statusConstants";
import { genId, colorForName } from "../../utils/helpers";

export default function ProjectFormModal({ open, initial, managers, onClose, onSubmit }) {
  const isEdit = !!initial;
  const teamOptions = TEAM.map((m) => ({ code: m.name[0], name: m.name.split(" ")[0] }));

  function buildForm() {
    return {
      name: initial?.name || "",
      client: initial?.client || "",
      manager: initial?.manager || managers[0] || "",
      status: initial?.status || PROJECT_STATUS_LIST[0],
      budget: initial?.budget != null ? String(initial.budget) : "",
      deadline: initial?.deadline ? initial.deadline.slice(0, 10) : "",
      progress: initial?.progress != null ? String(initial.progress) : "0",
      team: initial?.team ? [...initial.team] : [],
    };
  }

  const [form, setForm] = useState(buildForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setForm(buildForm()); setTouched(false); }
  }, [open, initial]);

  if (!open) return null;

  const nameTrimmed = form.name.trim();
  const clientTrimmed = form.client.trim();
  const nameError = touched && !nameTrimmed ? "Укажите название проекта" : null;
  const clientError = touched && !clientTrimmed ? "Укажите клиента" : null;
  const deadlineError = touched && !form.deadline ? "Укажите срок сдачи" : null;

  function update(field, val) { setForm((f) => ({ ...f, [field]: val })); }
  function toggleTeam(code) {
    setForm((f) => ({ ...f, team: f.team.includes(code) ? f.team.filter((c) => c !== code) : [...f.team, code] }));
  }

  function handleSubmit() {
    setTouched(true);
    if (!nameTrimmed || !clientTrimmed || !form.deadline) return;

    const budgetValue = Number(String(form.budget).replace(/[^\d]/g, "")) || 0;
    const progressValue = Math.max(0, Math.min(100, Number(form.progress) || 0));
    const deadlineIso = new Date(form.deadline).toISOString();

    if (isEdit) {
      onSubmit({
        ...initial,
        name: nameTrimmed, client: clientTrimmed, manager: form.manager, status: form.status,
        budget: budgetValue, deadline: deadlineIso, progress: progressValue, team: form.team,
      });
    } else {
      const now = new Date().toISOString();
      onSubmit({
        id: genId("p"), name: nameTrimmed, client: clientTrimmed, manager: form.manager, status: form.status,
        budget: budgetValue, deadline: deadlineIso, progress: progressValue, team: form.team,
        color: colorForName(nameTrimmed), createdAt: now, transactions: [], documents: [],
        activity: [{ id: genId("a"), kind: "history", text: "Проект создан", at: now, color: "#6E6AF6" }],
      });
    }
  }

  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-modal-title">{isEdit ? "Редактировать проект" : "Новый проект"}</div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="cnb-modal-body">
          <div className="cnb-field">
            <label>Название проекта *</label>
            <input className={`cnb-input ${nameError ? "invalid" : ""}`} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Например, Rebrand OS" />
            {nameError && <div className="cnb-field-error">{nameError}</div>}
          </div>

          <div className="cnb-field">
            <label>Клиент *</label>
            <input className={`cnb-input ${clientError ? "invalid" : ""}`} value={form.client} onChange={(e) => update("client", e.target.value)} placeholder="Название компании-клиента" />
            {clientError && <div className="cnb-field-error">{clientError}</div>}
          </div>

          <div className="cnb-field-row">
            <div className="cnb-field">
              <label>Ответственный</label>
              <select className="cnb-input cnb-select" value={form.manager} onChange={(e) => update("manager", e.target.value)}>
                {managers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="cnb-field">
              <label>Статус</label>
              <select className="cnb-input cnb-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
                {PROJECT_STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="cnb-field-row">
            <div className="cnb-field">
              <label>Бюджет, ₸</label>
              <input className="cnb-input mono" value={form.budget} onChange={(e) => update("budget", e.target.value.replace(/[^\d]/g, ""))} placeholder="0" inputMode="numeric" />
            </div>
            <div className="cnb-field">
              <label>Срок сдачи *</label>
              <input type="date" className={`cnb-input ${deadlineError ? "invalid" : ""}`} value={form.deadline} onChange={(e) => update("deadline", e.target.value)} />
              {deadlineError && <div className="cnb-field-error">{deadlineError}</div>}
            </div>
          </div>

          <div className="cnb-field">
            <label>Прогресс — {form.progress}%</label>
            <input type="range" min="0" max="100" className="cnb-range" value={form.progress} onChange={(e) => update("progress", e.target.value)} />
          </div>

          <div className="cnb-field">
            <label>Команда проекта</label>
            <div className="cnb-filter-row" style={{ marginBottom: 0, flexWrap: "wrap" }}>
              {teamOptions.map((t) => (
                <button key={t.code} type="button" className={`cnb-filter-chip ${form.team.includes(t.code) ? "active" : ""}`} onClick={() => toggleTeam(t.code)}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="cnb-modal-actions">
          <button className="cnb-btn-secondary" onClick={onClose}>Отмена</button>
          <button className="cnb-btn-primary" onClick={handleSubmit}>{isEdit ? "Сохранить" : "Создать проект"}</button>
        </div>
      </Glass>
    </div>
  );
}

