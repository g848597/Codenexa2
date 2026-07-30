import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Wallet, FileText, Clock, Plus, Target, ArrowUpRight, ArrowDownRight,
  DollarSign, Briefcase, Trash2, Edit3,
} from "lucide-react";
import Glass from "../../components/ui/Glass";
import Avatar from "../../components/ui/Avatar";
import SectionTitle from "../../components/ui/SectionTitle";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TopBar from "../../components/layout/TopBar";
import ProjectFormModal from "./ProjectFormModal";
import { PROJECT_STATUS_LIST, PROJECT_STATUS_COLOR } from "../../data/statusConstants";
import { projectFinancials } from "../../storage/projectsStorage";
import { fmt, formatRelative, formatDeadline, deadlineTone } from "../../utils/helpers";

const PROJECT_TABS = [
  { key: "overview", label: "Обзор" },
  { key: "finance", label: "Финансы" },
  { key: "team", label: "Команда" },
  { key: "documents", label: "Документы" },
  { key: "chat", label: "Чат" },
];

export default function ProjectDetail({ project, managers, onBack, onUpdate, onDelete, onLogActivity, onAddDocument, onAddComment, onAddTransaction }) {
  const [tab, setTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [addingTx, setAddingTx] = useState(null); // "income" | "expense" | null
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newComment, setNewComment] = useState("");

  if (!project) return null;

  const { income, expense, profit } = projectFinancials(project);
  const activity = project.activity || [];
  const historyEntries = activity.filter((a) => a.kind === "history").sort((a, b) => new Date(b.at) - new Date(a.at));
  const commentEntries = activity.filter((a) => a.kind === "comment").sort((a, b) => new Date(b.at) - new Date(a.at));
  const documents = project.documents || [];
  const transactions = (project.transactions || []).slice().sort((a, b) => new Date(b.at) - new Date(a.at));
  const tone = deadlineTone(project.deadline, project.status);

  function handleStatusChange(newStatus) {
    if (newStatus === project.status) return;
    onUpdate({ status: newStatus });
    onLogActivity("history", `Статус изменён на «${newStatus}»`, PROJECT_STATUS_COLOR[newStatus]);
  }

  function submitTx() {
    const amount = Number(String(txAmount).replace(/[^\d]/g, ""));
    if (!amount) return;
    const note = txNote.trim() || (addingTx === "income" ? "Поступление" : "Расход");
    onAddTransaction(addingTx, amount, note);
    onLogActivity("history", `${addingTx === "income" ? "Доход" : "Расход"}: ${note} — ${fmt(amount)} ₸`, addingTx === "income" ? "#17D896" : "#FF5C5C");
    setTxAmount(""); setTxNote(""); setAddingTx(null);
  }

  function submitDoc() {
    const name = newDocName.trim();
    if (!name) return;
    onAddDocument(name);
    setNewDocName(""); setAddingDoc(false);
  }

  function submitComment() {
    const text = newComment.trim();
    if (!text) return;
    onAddComment(text);
    setNewComment("");
  }

  return (
    <div className="cnb-screen">
      <TopBar title={project.name} subtitle={project.client} onBack={onBack} />

      <Glass className="cnb-detail-hero" style={{ alignItems: "flex-start" }}>
        <div className="cnb-progress-ring-row">
          <ResponsiveContainer width={72} height={72}>
            <PieChart>
              <Pie data={[{ v: project.progress }, { v: 100 - project.progress }]} dataKey="v" innerRadius={26} outerRadius={34} startAngle={90} endAngle={-270} stroke="none">
                <Cell fill={project.color} />
                <Cell fill="rgba(255,255,255,0.08)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }} className="mono">{project.progress}%</div>
            <div style={{ color: "#9A9EA6", fontSize: 12 }}>выполнено</div>
          </div>
        </div>
        <div style={{ color: tone, fontSize: 13, marginTop: 6, fontWeight: 600 }}>Срок сдачи: {formatDeadline(project.deadline)}</div>
      </Glass>

      <div className="cnb-tabs">
        {PROJECT_TABS.map((t) => (
          <button key={t.key} className={`cnb-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <SectionTitle>Статус проекта</SectionTitle>
          <Glass className="cnb-info-list">
            <select className="cnb-input cnb-select" value={project.status} onChange={(e) => handleStatusChange(e.target.value)}>
              {PROJECT_STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Glass>

          <SectionTitle>Сводка</SectionTitle>
          <Glass className="cnb-info-list">
            <div className="cnb-info-row"><Briefcase size={14} color="#9A9EA6" /> Ответственный: {project.manager}</div>
            <div className="cnb-info-row"><DollarSign size={14} color="#9A9EA6" /> Бюджет: {fmt(project.budget)} ₸</div>
            <div className="cnb-info-row"><Clock size={14} color="#9A9EA6" /> Создан: {formatRelative(project.createdAt)}</div>
          </Glass>

          <SectionTitle>Последняя активность</SectionTitle>
          {historyEntries.length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Пока нет истории по проекту.</div></Glass>
          ) : (
            <Glass className="cnb-info-list">
              {historyEntries.slice(0, 5).map((h) => (
                <div key={h.id} className="cnb-history-row">
                  <span className="cnb-dot" style={{ background: h.color || "#6E6AF6" }} /> {h.text}
                  <span className="cnb-history-time">{formatRelative(h.at)}</span>
                </div>
              ))}
            </Glass>
          )}

          <div className="cnb-detail-actions">
            <button className="cnb-btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(true)}><Edit3 size={14} /> Редактировать</button>
            <button className="cnb-btn-danger" style={{ flex: 1 }} onClick={() => setShowDelete(true)}><Trash2 size={14} /> Удалить</button>
          </div>
        </>
      )}

      {tab === "finance" && (
        <>
          <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <Glass className="cnb-metric-card"><div className="cnb-metric-label">Доход</div><div className="cnb-metric-value mono" style={{ fontSize: 15 }}>{fmt(income)}</div></Glass>
            <Glass className="cnb-metric-card"><div className="cnb-metric-label">Расход</div><div className="cnb-metric-value mono" style={{ fontSize: 15, color: "#FF5C5C" }}>{fmt(expense)}</div></Glass>
            <Glass className="cnb-metric-card"><div className="cnb-metric-label">Прибыль</div><div className="cnb-metric-value mono" style={{ fontSize: 15, color: "#17D896" }}>{fmt(profit)}</div></Glass>
          </div>
          <Glass className="cnb-info-list" style={{ marginBottom: 16 }}>
            <div className="cnb-info-row"><Wallet size={14} color="#9A9EA6" /> Бюджет проекта: {fmt(project.budget)} ₸</div>
            <div className="cnb-info-row"><Target size={14} color="#9A9EA6" /> Освоено: {project.budget ? Math.round((expense / project.budget) * 100) : 0}% от бюджета</div>
          </Glass>

          <SectionTitle>Зафиксировать операцию</SectionTitle>
          <div className="cnb-quick-log-row">
            <button className="cnb-quick-log-chip" style={{ color: "#17D896", borderColor: "#17D89644" }} onClick={() => setAddingTx("income")}><ArrowDownRight size={13} /> Добавить доход</button>
            <button className="cnb-quick-log-chip" style={{ color: "#FF5C5C", borderColor: "#FF5C5C44" }} onClick={() => setAddingTx("expense")}><ArrowUpRight size={13} /> Добавить расход</button>
          </div>

          {addingTx && (
            <Glass className="cnb-add-inline">
              <div className="cnb-field-row">
                <input className="cnb-input mono" autoFocus placeholder="Сумма, ₸" value={txAmount} onChange={(e) => setTxAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
                <input className="cnb-input" placeholder="Комментарий (необязательно)" value={txNote} onChange={(e) => setTxNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitTx()} />
              </div>
              <div className="cnb-modal-actions" style={{ marginTop: 10 }}>
                <button className="cnb-btn-secondary" onClick={() => { setAddingTx(null); setTxAmount(""); setTxNote(""); }}>Отмена</button>
                <button className="cnb-btn-primary" onClick={submitTx}>Сохранить</button>
              </div>
            </Glass>
          )}

          <SectionTitle>Операции по проекту</SectionTitle>
          {transactions.length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Операций пока нет.</div></Glass>
          ) : (
            <Glass className="cnb-info-list">
              {transactions.map((t) => (
                <div key={t.id} className="cnb-tx-row">
                  <span className="cnb-dot" style={{ background: t.type === "income" ? "#17D896" : "#FF5C5C" }} />
                  <div>
                    <div>{t.note}</div>
                    <div className="cnb-tx-note">{formatRelative(t.at)}</div>
                  </div>
                  <div className="cnb-tx-amount mono" style={{ color: t.type === "income" ? "#17D896" : "#FF5C5C" }}>
                    {t.type === "income" ? "+" : "−"}{fmt(t.amount)} ₸
                  </div>
                </div>
              ))}
            </Glass>
          )}
        </>
      )}

      {tab === "team" && (
        <>
          <SectionTitle>Ответственный</SectionTitle>
          <Glass className="cnb-info-list">
            <div className="cnb-info-row"><Avatar label={project.manager[0]} color={project.color} size={26} /> {project.manager}</div>
          </Glass>

          <SectionTitle>Команда проекта</SectionTitle>
          {(project.team || []).length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Команда не назначена — добавьте участников в редактировании.</div></Glass>
          ) : (
            <Glass className="cnb-info-list" style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {project.team.map((t, i) => (
                <div key={i} className="cnb-team-chip"><Avatar label={t} color={project.color} size={26} /></div>
              ))}
            </Glass>
          )}

          <button className="cnb-btn-secondary" style={{ width: "100%" }} onClick={() => setShowEdit(true)}><Edit3 size={14} /> Изменить состав команды</button>
        </>
      )}

      {tab === "documents" && (
        <>
          <SectionTitle action={<button className="cnb-link-btn" onClick={() => setAddingDoc((v) => !v)}><Plus size={13} /> Добавить</button>}>
            Файлы и документы
          </SectionTitle>

          {addingDoc && (
            <Glass className="cnb-add-inline">
              <input className="cnb-input" autoFocus placeholder="Название документа (например, Акт №4.pdf)" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitDoc()} />
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

      {tab === "chat" && (
        <>
          <SectionTitle>Написать в чат проекта</SectionTitle>
          <Glass className="cnb-add-inline">
            <textarea className="cnb-input cnb-textarea" placeholder="Например: обновила макет главного экрана" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
            <div className="cnb-modal-actions" style={{ marginTop: 10 }}>
              <button className="cnb-btn-primary" style={{ width: "100%" }} onClick={submitComment}>Отправить</button>
            </div>
          </Glass>

          <SectionTitle>Чат проекта</SectionTitle>
          {commentEntries.length === 0 ? (
            <Glass className="cnb-info-list"><div className="cnb-empty-inline">Сообщений пока нет.</div></Glass>
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

      <ProjectFormModal
        open={showEdit}
        initial={project}
        managers={managers}
        onClose={() => setShowEdit(false)}
        onSubmit={(patch) => { onUpdate(patch); setShowEdit(false); }}
      />

      <ConfirmDialog
        open={showDelete}
        title={`Удалить «${project.name}»?`}
        message="Проект, все финансовые операции, документы и чат будут удалены безвозвратно."
        confirmLabel="Удалить"
        onConfirm={() => { setShowDelete(false); onDelete(); }}
        onCancel={() => setShowDelete(false)}
      />

      <div style={{ height: 40 }} />
    </div>
  );
}

