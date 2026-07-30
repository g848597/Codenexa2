import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import Glass from "../../components/ui/Glass";
import { STATUS_LIST } from "../../data/statusConstants";
import { isValidEmail, isValidPhone } from "../../utils/helpers";

export default function ClientFormModal({ open, initial, existingClients, managers, onClose, onSubmit }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    contact: initial?.contact || "",
    phone: initial?.phone || "",
    email: initial?.email || "",
    tg: initial?.tg || "",
    manager: initial?.manager || managers[0] || "",
    status: initial?.status || STATUS_LIST[0],
    value: initial?.value != null ? String(initial.value) : "",
  }));
  const [dupConfirmed, setDupConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || "",
        contact: initial?.contact || "",
        phone: initial?.phone || "",
        email: initial?.email || "",
        tg: initial?.tg || "",
        manager: initial?.manager || managers[0] || "",
        status: initial?.status || STATUS_LIST[0],
        value: initial?.value != null ? String(initial.value) : "",
      });
      setDupConfirmed(false);
      setTouched(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const nameTrimmed = form.name.trim();
  const nameError = touched && !nameTrimmed ? "Укажите название компании" : null;
  const emailError = touched && !isValidEmail(form.email) ? "Проверьте формат email" : null;
  const phoneError = touched && !isValidPhone(form.phone) ? "Проверьте формат телефона" : null;
  const isDuplicate = nameTrimmed && (existingClients || []).some(
    (c) => c.name.trim().toLowerCase() === nameTrimmed.toLowerCase() && c.id !== initial?.id
  );

  function update(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleSubmit() {
    setTouched(true);
    if (!nameTrimmed || !isValidEmail(form.email) || !isValidPhone(form.phone)) return;
    if (isDuplicate && !dupConfirmed) return;

    const numericValue = Number(String(form.value).replace(/[^\d]/g, "")) || 0;

    if (isEdit) {
      onSubmit({
        ...initial,
        name: nameTrimmed,
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        tg: form.tg.trim(),
        manager: form.manager,
        status: form.status,
        value: numericValue,
      });
    } else {
      const now = new Date().toISOString();
      onSubmit({
        id: genId(),
        name: nameTrimmed,
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        tg: form.tg.trim(),
        manager: form.manager,
        status: form.status,
        value: numericValue,
        color: colorForName(nameTrimmed),
        createdAt: now,
        lastContactAt: now,
        documents: [],
        activity: [{ id: genId("a"), kind: "history", text: "Клиент добавлен в CRM", at: now, color: "#6E6AF6" }],
      });
    }
  }

  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-modal-title">{isEdit ? "Редактировать клиента" : "Новый клиент"}</div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="cnb-modal-body">
          <div className="cnb-field">
            <label>Компания *</label>
            <input className={`cnb-input ${nameError ? "invalid" : ""}`} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Название компании" />
            {nameError && <div className="cnb-field-error">{nameError}</div>}
          </div>

          {isDuplicate && (
            <div className="cnb-dup-warning">
              <AlertTriangle size={14} />
              <span>Клиент с похожим именем уже есть в базе.</span>
              <label className="cnb-checkbox-row">
                <input type="checkbox" checked={dupConfirmed} onChange={(e) => setDupConfirmed(e.target.checked)} />
                Это другая компания, сохранить всё равно
              </label>
            </div>
          )}

          <div className="cnb-field">
            <label>Контактное лицо</label>
            <input className="cnb-input" value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder="Имя и фамилия" />
          </div>

          <div className="cnb-field-row">
            <div className="cnb-field">
              <label>Телефон</label>
              <input className={`cnb-input ${phoneError ? "invalid" : ""}`} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+7 700 000 0000" />
              {phoneError && <div className="cnb-field-error">{phoneError}</div>}
            </div>
            <div className="cnb-field">
              <label>Email</label>
              <input className={`cnb-input ${emailError ? "invalid" : ""}`} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="mail@company.kz" />
              {emailError && <div className="cnb-field-error">{emailError}</div>}
            </div>
          </div>

          <div className="cnb-field">
            <label>Telegram</label>
            <input className="cnb-input" value={form.tg} onChange={(e) => update("tg", e.target.value)} placeholder="@username" />
          </div>

          <div className="cnb-field-row">
            <div className="cnb-field">
              <label>Менеджер</label>
              <select className="cnb-input cnb-select" value={form.manager} onChange={(e) => update("manager", e.target.value)}>
                {managers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="cnb-field">
              <label>Статус</label>
              <select className="cnb-input cnb-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
                {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="cnb-field">
            <label>Сумма сделки, ₸</label>
            <input className="cnb-input mono" value={form.value} onChange={(e) => update("value", e.target.value.replace(/[^\d]/g, ""))} placeholder="0" inputMode="numeric" />
          </div>
        </div>

        <div className="cnb-modal-actions">
          <button className="cnb-btn-secondary" onClick={onClose}>Отмена</button>
          <button className="cnb-btn-primary" onClick={handleSubmit}>{isEdit ? "Сохранить" : "Добавить клиента"}</button>
        </div>
      </Glass>
    </div>
  );
}

