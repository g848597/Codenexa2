import { useState } from "react";
import { Edit3, Trash2, Eye, EyeOff } from "lucide-react";
import Glass from "../../components/ui/Glass";
import Avatar from "../../components/ui/Avatar";
import Pill from "../../components/ui/Pill";
import SectionTitle from "../../components/ui/SectionTitle";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TopBar from "../../components/layout/TopBar";
import { fmt } from "../../utils/helpers";

export default function TeamMemberDetail({ member, onBack, onEdit, onDelete }) {
  const [salaryRevealed, setSalaryRevealed] = useState(false);
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  if (!member) return null;
  const history = member.kpiHistory && member.kpiHistory.length ? member.kpiHistory : [member.kpi];
  const maxKpi = Math.max(...history, 100);

  return (
    <div className="cnb-screen">
      <TopBar title={member.name} subtitle={member.role} onBack={onBack} />

      <Glass className="cnb-detail-hero">
        <Avatar label={member.name[0]} color={member.color} size={56} />
        <div style={{ marginTop: 10, fontWeight: 600, fontSize: 17 }}>{member.name}</div>
        <Pill color={member.kpi > 90 ? "#17D896" : "#F2B84B"}>KPI {member.kpi}</Pill>
      </Glass>

      <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Задач в работе</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 19 }}>{member.tasks}</div>
        </Glass>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Зарплата</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 6 }}>
            {salaryRevealed ? `${fmt(member.salary)} ₸` : "•••• ₸"}
            <button
              className="cnb-row-icon-btn"
              onClick={() => (salaryRevealed ? setSalaryRevealed(false) : setShowRevealConfirm(true))}
              title={salaryRevealed ? "Скрыть" : "Показать (требует подтверждения доступа)"}
            >
              {salaryRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Glass>
      </div>

      <SectionTitle>Динамика KPI</SectionTitle>
      <Glass className="cnb-chart-card">
        <div className="cnb-kpi-bars">
          {history.map((v, i) => (
            <div key={i} className="cnb-kpi-bar-col">
              <div className="cnb-kpi-bar" style={{ height: `${(v / maxKpi) * 100}%`, background: member.color }} />
              <div className="cnb-kpi-bar-label mono">{v}</div>
            </div>
          ))}
        </div>
      </Glass>

      <div className="cnb-detail-actions" style={{ marginTop: 4 }}>
        <button className="cnb-btn-secondary" style={{ flex: 1 }} onClick={() => onEdit(member)}><Edit3 size={14} /> Редактировать</button>
        <button className="cnb-btn-danger" style={{ flex: 1 }} onClick={() => setShowDelete(true)}><Trash2 size={14} /> Удалить</button>
      </div>

      <ConfirmDialog
        open={showRevealConfirm}
        danger={false}
        title="Показать зарплату?"
        message="Эта информация доступна только с явным подтверждением доступа и не отображается по умолчанию в общем списке."
        confirmLabel="Показать"
        onConfirm={() => { setSalaryRevealed(true); setShowRevealConfirm(false); }}
        onCancel={() => setShowRevealConfirm(false)}
      />

      <ConfirmDialog
        open={showDelete}
        title={`Удалить «${member.name}» из команды?`}
        message="Это действие необратимо."
        confirmLabel="Удалить"
        onConfirm={() => { setShowDelete(false); onDelete(member); }}
        onCancel={() => setShowDelete(false)}
      />

      <div style={{ height: 40 }} />
    </div>
  );
}
