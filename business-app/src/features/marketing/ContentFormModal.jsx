import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Glass from "../../components/ui/Glass";
import { CONTENT_TYPES, CONTENT_STATUSES } from "../../data/marketingData";
import { genId } from "../../utils/helpers";

const TYPE_COLOR = { Instagram: "#6E6AF6", Telegram: "#22B8FF", Email: "#F2B84B", Reels: "#FF5C5C" };
const TYPE_ICON_KEY = { Instagram: "instagram", Telegram: "telegram", Email: "email", Reels: "reels" };

export default function ContentFormModal({ open, initial, onClose, onSubmit }) {
  const isEdit = !!initial;
  const emptyForm = () => ({
    title: initial?.title || "",
    type: initial?.type || CONTENT_TYPES[0],
    status: initial?.status || CONTENT_STATUSES[0],
  });
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setForm(emptyForm()); setTouched(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;
  const titleTrimmed = form.title.trim();
  const titleError = touched && !titleTrimmed ? "Опишите идею" : null;

  function update(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  function handleSubmit() {
    setTouched(true);
    if (!titleTrimmed) return;
    if (isEdit) {
      onSubmit({ ...initial, title: titleTrimmed, type: form.type, status: form.status, color: TYPE_COLOR[form.type], iconKey: TYPE_ICON_KEY[form.type] });
    } else {
      onSubmit({ id: genId("m"), title: titleTrimmed, type: form.type, status: form.status, color: TYPE_COLOR[form.type], iconKey: TYPE_ICON_KEY[form.type] });
    }
  }

  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-modal-title">{isEdit ? "Редактировать идею" : "Новая идея контента"}</div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cnb-modal-body">
          <div className="cnb-field">
            <label>Идея *</label>
            <input className={`cnb-input ${titleError ? "invalid" : ""}`} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Например: разбор кейса клиента" />
            {titleError && <div className="cnb-field-error">{titleError}</div>}
          </div>
          <div className="cnb-field-row">
            <div className="cnb-field">
              <label>Канал</label>
              <select className="cnb-input cnb-select" value={form.type} onChange={(e) => update("type", e.target.value)}>
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="cnb-field">
              <label>Статус</label>
              <select className="cnb-input cnb-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
                {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="cnb-modal-actions">
          <button className="cnb-btn-secondary" onClick={onClose}>Отмена</button>
          <button className="cnb-btn-primary" onClick={handleSubmit}>{isEdit ? "Сохранить" : "Добавить идею"}</button>
        </div>
      </Glass>
    </div>
  );
}
