import { useMemo, useState } from "react";
import { X } from "lucide-react";
import Glass from "../../components/ui/Glass";
import Pill from "../../components/ui/Pill";
import Avatar from "../../components/ui/Avatar";
import SectionTitle from "../../components/ui/SectionTitle";
import TopBar from "../../components/layout/TopBar";
import { STATUS_COLOR } from "../../data/statusConstants";
import { salesFunnel, lossReasons } from "../../storage/aggregates";
import { fmt, formatRelative } from "../../utils/helpers";

export default function Sales({ onBack, clients, onOpenClient }) {
  const [activeStage, setActiveStage] = useState(null);
  const funnel = useMemo(() => salesFunnel(clients), [clients]);
  const reasons = useMemo(() => lossReasons(clients), [clients]);
  const max = Math.max(1, ...funnel.map((f) => f.count));

  const stageClients = activeStage ? (clients || []).filter((c) => c.status === activeStage) : [];

  return (
    <div className="cnb-screen">
      <TopBar title="Продажи" subtitle="Воронка" onBack={onBack} />
      <Glass className="cnb-chart-card">
        {funnel.map((f, i) => (
          <button
            key={f.stage}
            className="cnb-funnel-row cnb-funnel-row-btn"
            onClick={() => setActiveStage(f.stage)}
          >
            <div className="cnb-funnel-label">{f.stage}</div>
            <div className="cnb-funnel-track">
              <div
                className="cnb-funnel-fill"
                style={{ width: `${(f.count / max) * 100}%`, background: `linear-gradient(90deg, ${STATUS_COLOR[f.stage]}, ${STATUS_COLOR[f.stage]}CC)`, opacity: 1 - i * 0.05 }}
              />
            </div>
            <div className="cnb-funnel-count mono">{f.count}</div>
          </button>
        ))}
      </Glass>

      <SectionTitle>Причины потерь (по клиентам в статусе «Просрочка»)</SectionTitle>
      <Glass className="cnb-info-list">
        {reasons.length === 0 && <div className="cnb-empty-inline">Нет данных о потерянных сделках — отлично!</div>}
        {reasons.map((r) => (
          <div key={r.key} className="cnb-history-row">
            <span className="cnb-dot" style={{ background: r.color }} /> {r.pct}% — {r.label} ({r.count})
          </div>
        ))}
      </Glass>
      <div style={{ height: 40 }} />

      {activeStage && (
        <div className="cnb-modal-overlay" onClick={() => setActiveStage(null)}>
          <Glass className="cnb-modal-card" style={{ maxHeight: "78vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="cnb-modal-head">
              <div className="cnb-modal-title">{activeStage} <span style={{ color: "#7A7E88", fontWeight: 400 }}>({stageClients.length})</span></div>
              <button className="cnb-iconbtn" onClick={() => setActiveStage(null)}><X size={16} /></button>
            </div>
            <div className="cnb-modal-body" style={{ overflowY: "auto" }}>
              {stageClients.length === 0 && <div className="cnb-empty-inline">В этой стадии пока нет клиентов.</div>}
              {stageClients.map((c) => (
                <Glass
                  key={c.id}
                  className="cnb-client-row"
                  onClick={() => { if (onOpenClient) { onOpenClient(c); setActiveStage(null); } }}
                >
                  <Avatar label={c.name[0]} color={c.color} />
                  <div className="cnb-client-info">
                    <div className="cnb-client-name">{c.name}</div>
                    <div className="cnb-client-sub">{c.contact} • {formatRelative(c.lastContactAt)}</div>
                  </div>
                  <div className="cnb-client-value mono">{fmt(c.value)} ₸</div>
                </Glass>
              ))}
            </div>
          </Glass>
        </div>
      )}
    </div>
  );
}
