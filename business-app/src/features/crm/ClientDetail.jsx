import { useState } from "react";
import {
  Phone, Mail, Send, FileText, Plus, Trash2, Edit3, PhoneCall, FileSignature,
} from "lucide-react";
import Glass from "../../components/ui/Glass";
import Avatar from "../../components/ui/Avatar";
import SectionTitle from "../../components/ui/SectionTitle";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TopBar from "../../components/layout/TopBar";
import ClientFormModal from "./ClientFormModal";
import { STATUS_LIST, STATUS_COLOR } from "../../data/statusConstants";
import { fmt, formatRelative } from "../../utils/helpers";
import { haptic } from "../../utils/telegram";

const CLIENT_TABS = [
  { key: "overview", label: "Обзор" },
  { key: "finance", label: "Финансы" },
  { key: "history", label: "История" },
  { key: "documents", label: "Документы" },
  { key: "comments", label: "Комментарии" },
];

const QUICK_LOG_ACTIONS = [
  { label: "Звонок", icon: PhoneCall, color: "#6E6AF6", text: "Совершён звонок клиенту" },
  { label: "Email", icon: Mail, color: "#22B8FF", text: "Отправлено письмо на email" },
  { label: "Telegram", icon: Send, color: "#17D896", text: "Написали в Telegram" },
  { label: "КП отправлено", icon: FileSignature, color: "#F2B84B", text: "Отправлено коммерческое предложение" },
];

export default function ClientDetail({ client, managers, allClients, onBack, onUpdate, onDelete, onLogActivity, onAddDocument, onAddComment }) {
  const [tab, setTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [newComment, setNewComment] = useState("");

  if (!client) return null;

  const activity = client.activity || [];
  const historyEntries = activity.filter((a) => a.kind === "history").sort((a, b) => new Date(b.at) - new Date(a.at));
  const commentEntries = activity.filter((a) => a.kind === "comment").sort((a, b) => new Date(b.at) - new Date(a.at));
  const documents = client.documents || [];

  function handleStatusChange(newStatus) {
    if (newStatus === client.status) return;
    onUpdate({ status: newStatus });
    onLogActivity("history", `Статус изменён на «${newStatus}»`, STATUS_COLOR[newStatus]);
    haptic("select");
  }

  function submitDoc() {
    const name = newDocName.trim();
    if (!name) return;
    onAddDocument(name);
    setNewDocName("");
    setAddingDoc(false);
  }

  function submitComment() {
    const text = newComment.trim();
    if (!text) return;
    onAddComment(text);
    setNewComment("");
  }

  return (
    <div className="cnb-screen">
      <TopBar title={client.name} subtitle={client.status} onBack={onBack} />

      <Glass className="cnb-detail-hero">
        <Avatar label={client.name[0]} color={client.color} size={56} />
        <div style={{ marginTop: 10, fontWeight: 600, fontSize: 17 }}>{client.contact || "Контакт не указан"}</div>
        <div style={{ color: "#9A9EA6", fontSize: 13 }}>Ответственный: {client.manager}</div>
      </Glass>

      <div className="cnb-tabs">
        {CLIENT_TABS.map((t) => (
          <button key={t.key} className={`cnb-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <SectionTitle>Статус сделки</SectionTitle>
          <Glass className="cnb-info-list">
            <select className="cnb-input cnb-select" value={client.status} onChange={(e) => handleStatusChange(e.target.value)}>
              {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Glass>

          <SectionTitle>Контакты</SectionTitle>
          <Glass className="cnb-info-list">
            {client.phone ? (
              <a className="cnb-info-row cnb-info-row-link" href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}>
                <Phone size={14} color="#9A9EA6" /> {client.phone}
              </a>
            ) : (
              <div className="cnb-info-row cnb-info-row-muted"><Phone size={14} color="#9A9EA6" /> Телефон не указан</div>
            )}
            {client.email ? (
              <a className="cnb-info-row cnb-info-row-link" href={`mailto:${client.email}`}>
                <Mail size={14} color="#9A9EA6" /> {client.email}
              </a>
            ) : (
              <div className="cnb-info-row cnb-info-row-muted"><Mail size={14} color="#9A9EA6" /> Email не указан</div>
            )}
            {client.tg ? (
              <a className="cnb-info-row cnb-info-row-link" href={`https://t.me/${client.tg.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
                <Send size={14} color="#9A9EA6" /> {client.tg}
              </a>
            ) : (
              <div className="cnb-info-row cnb-info-row-muted"><Send size={14} color="#9A9EA6" /> Telegram не указан</div>
            )}
          </Glass>

          <div className="cnb-detail-actions" style={{ marginTop: 4 }}>
            <button className="cnb-btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(true)}><Edit3 size={14} /> Редактировать</button>
            <button className="cnb-btn-danger" style={{ flex: 1 }} onClick={() => setShowDelete(true)}><Trash2 size={14} /> Удалить</button>
          </div>
        </>
      )}

      {tab === "finance" && (
        <>
          <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Glass className="cnb-metric-card">
              <div className="cnb-metric-label">Сумма сделки</div>
              <div className="cnb-metric-value mono" style={{ fontSize: 19 }}>{fmt(client.value)} ₸</div>
            </Glass>
            <Glass className="cnb-metric-card">
              <div className="cnb-metric-label">Документы</div>
              <div className="cnb-metric-value mono" style={{ fontSize: 19 }}>{documents.length}</div>
            </Glass>
          </div>
          <Glass className="cnb-info-list">
            <div className="cnb-info-row" style={{ color: "#9A9EA6" }}>Сумму сделки можно изменить в разделе «Редактировать» на вкладке Обзор.</div>
          </Glass>
        </>
      )}

      {tab === "history" && (
        <>
          <SectionTitle>Зафиксировать контакт</SectionTitle>
          <div className="cnb-quick-log-row">
            {QUICK_LOG_ACTIONS.map((q) => (
              <button key={q.label} className="cnb-quick-log-chip" style={{ color: q.color, borderColor: `${q.color}44` }} onClick={() => onLogActivity("history", q.text, q.color)}>
                <q.icon size={13} /> {q.label}
              </button>
            ))}
          </div>

          <SectionTitle>История общения</SectionTitle>
          {historyEntries.length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Пока нет истории — зафиксируйте первый контакт выше.</div></Glass>
          ) : (
            <Glass className="cnb-info-list">
              {historyEntries.map((h) => (
                <div key={h.id} className="cnb-history-row">
                  <span className="cnb-dot" style={{ background: h.color || "#6E6AF6" }} /> {h.text}
                  <span className="cnb-history-time">{formatRelative(h.at)}</span>
                </div>
              ))}
            </Glass>
          )}
        </>
      )}

      {tab === "documents" && (
        <>
          <SectionTitle action={<button className="cnb-link-btn" onClick={() => setAddingDoc((v) => !v)}><Plus size={13} /> Добавить</button>}>
            Файлы и документы
          </SectionTitle>

          {addingDoc && (
            <Glass className="cnb-add-inline">
              <input className="cnb-input" autoFocus placeholder="Название документа (например, Счёт №12.pdf)" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitDoc()} />
              <div className="cnb-modal-actions" style={{ marginTop: 10 }}>
                <button className="cnb-btn-secondary" onClick={() => { setAddingDoc(false); setNewDocName(""); }}>Отмена</button>
                <button className="cnb-btn-primary" onClick={submitDoc}>Добавить</button>
              </div>
            </Glass>
          )}

          {documents.length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Документов пока нет.</div></Glass>
          ) : (
            <Glass className="cnb-info-list">
              {documents.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).map((d) => (
                <div key={d.id} className="cnb-info-row" style={{ justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}><FileText size={14} color="#9A9EA6" /> {d.name}</span>
                  <span className="cnb-history-time" style={{ marginLeft: 0 }}>{formatRelative(d.at)}</span>
                </div>
              ))}
            </Glass>
          )}
        </>
      )}

      {tab === "comments" && (
        <>
          <SectionTitle>Добавить комментарий</SectionTitle>
          <Glass className="cnb-add-inline">
            <textarea className="cnb-input cnb-textarea" placeholder="Например: клиент готов подписать при скидке 5%" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
            <div className="cnb-modal-actions" style={{ marginTop: 10 }}>
              <button className="cnb-btn-primary" style={{ width: "100%" }} onClick={submitComment}>Добавить комментарий</button>
            </div>
          </Glass>

          <SectionTitle>Комментарии</SectionTitle>
          {commentEntries.length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Комментариев пока нет.</div></Glass>
          ) : (
            <Glass className="cnb-info-list">
              {commentEntries.map((c) => (
                <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="cnb-comment">«{c.text}»</div>
                  <div className="cnb-history-time" style={{ marginTop: 2 }}>{formatRelative(c.at)}</div>
                </div>
              ))}
            </Glass>
          )}
        </>
      )}

      <ClientFormModal
        open={showEdit}
        initial={client}
        existingClients={allClients}
        managers={managers}
        onClose={() => setShowEdit(false)}
        onSubmit={(patch) => { onUpdate(patch); setShowEdit(false); }}
      />

      <ConfirmDialog
        open={showDelete}
        title={`Удалить «${client.name}»?`}
        message="Клиент, вся история и документы будут удалены безвозвратно."
        confirmLabel="Удалить"
        onConfirm={() => { setShowDelete(false); onDelete(); }}
        onCancel={() => setShowDelete(false)}
      />

      <div style={{ height: 40 }} />
    </div>
  );
}

