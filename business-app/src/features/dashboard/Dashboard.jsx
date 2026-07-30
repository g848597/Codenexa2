import { useMemo, useState } from "react";
import { Sparkles, ChevronRight, FileText, MessageCircle, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import Glass from "../../components/ui/Glass";
import Delta from "../../components/ui/Delta";
import ProgressBar from "../../components/ui/ProgressBar";
import SectionTitle from "../../components/ui/SectionTitle";
import TopBar from "../../components/layout/TopBar";
import QuickSearchModal from "../../components/layout/QuickSearchModal";
import { COMPANY } from "../../data/mockData";
import { dashboardMetrics, dailySeries } from "../../storage/aggregates";
import { fmt } from "../../utils/helpers";

function buildInsights(clients, projects, metrics) {
  const insights = [];
  const stale = (clients || [])
    .filter((c) => c.status !== "Сделка закрыта" && c.lastContactAt)
    .filter((c) => Date.now() - new Date(c.lastContactAt).getTime() > 48 * 3600000)
    .sort((a, b) => new Date(a.lastContactAt) - new Date(b.lastContactAt));
  if (stale.length) {
    insights.push({
      id: "stale", tone: "warning",
      text: `${stale.length === 1 ? "Клиент" : `${stale.length} клиента`} не получал${stale.length === 1 ? "" : "и"} ответа больше 48 часов: ${stale.slice(0, 3).map((c) => c.name).join(", ")}.`,
    });
  }
  const negotiating = (clients || []).filter((c) => c.status === "Переговоры").sort((a, b) => new Date(a.lastContactAt) - new Date(b.lastContactAt))[0];
  if (negotiating) {
    const days = Math.floor((Date.now() - new Date(negotiating.lastContactAt).getTime()) / 86400000);
    if (days >= 3) insights.push({ id: "negotiate", tone: "action", text: `Стоит подтолкнуть сделку с ${negotiating.name} — переговоры без движения ${days} дн.` });
  }
  if (metrics.revenueDelta > 0) {
    const topProject = (projects || []).slice().sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
    insights.push({ id: "growth", tone: "positive", text: `Доход вырос на ${metrics.revenueDelta}% к прошлому периоду${topProject ? ` — драйвер: «${topProject.name}»` : ""}.` });
  }
  if (!insights.length) insights.push({ id: "empty", tone: "positive", text: "Пока всё спокойно — нет клиентов, требующих срочного внимания." });
  return insights.slice(0, 3);
}

export default function Dashboard({ nav, openNotifications, projects, clients, unreadCount = 0 }) {
  const [showSearch, setShowSearch] = useState(false);
  const list = projects || [];
  const activeList = list.filter((p) => p.status !== "Завершён");
  const preview = activeList.slice().sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0)).slice(0, 4);

  const metrics = useMemo(() => dashboardMetrics(clients, projects), [clients, projects]);
  const revenueSeries = useMemo(() => dailySeries(projects, 7), [projects]);
  const insights = useMemo(() => buildInsights(clients, projects, metrics), [clients, projects, metrics]);

  return (
    <div className="cnb-screen">
      <TopBar title={COMPANY.name} subtitle={`План ${COMPANY.plan}`} onBell={openNotifications} unreadCount={unreadCount} onSearch={() => setShowSearch(true)} />

      <div className="cnb-metric-grid">
        <Glass className="cnb-metric-card cnb-metric-hero">
          <div className="cnb-metric-label">Выручка сегодня</div>
          <div className="cnb-metric-value mono">{fmt(metrics.revenueToday)} ₸</div>
          <Delta value={metrics.revenueDelta} />
        </Glass>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Прибыль за неделю</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 20 }}>{fmt(metrics.profit)} ₸</div>
          <Delta value={metrics.profitDelta} />
        </Glass>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Новые заявки</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 20 }}>{metrics.newLeads}</div>
          <span className="cnb-metric-note">за 24 часа</span>
        </Glass>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Активные проекты</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 20 }}>{metrics.activeProjects}</div>
          <span className="cnb-metric-note">в работе</span>
        </Glass>
      </div>

      <div className="cnb-strip">
        {[
          { label: "Документы", value: metrics.docs, icon: FileText, color: "#22B8FF" },
          { label: "Просрочки", value: metrics.overdue, icon: AlertTriangle, color: "#FF5C5C" },
          { label: "Комментарии", value: metrics.messages, icon: MessageCircle, color: "#F2B84B" },
        ].map((s) => (
          <Glass key={s.label} className="cnb-strip-card">
            <div className="cnb-strip-icon" style={{ background: `${s.color}22`, color: s.color }}>
              <s.icon size={15} />
            </div>
            <div>
              <div className="cnb-strip-value mono">{s.value}</div>
              <div className="cnb-strip-label">{s.label}</div>
            </div>
          </Glass>
        ))}
      </div>

      <Glass className="cnb-ai-hero" onClick={() => nav("ai")}>
        <div className="cnb-ai-glow" />
        <div className="cnb-ai-hero-top">
          <div className="cnb-ai-badge"><Sparkles size={13} /> AI Director</div>
          <ChevronRight size={16} color="#9A9EA6" />
        </div>
        {insights.map((i) => (
          <div key={i.id} className="cnb-ai-line">
            <span className="cnb-ai-dot" style={{
              background: i.tone === "positive" ? "#17D896" : i.tone === "warning" ? "#FF5C5C" : "#6E6AF6"
            }} />
            {i.text}
          </div>
        ))}
      </Glass>

      <SectionTitle action={<button className="cnb-link-btn" onClick={() => nav("finance")}>Финансы <ChevronRight size={13} /></button>}>
        Динамика недели
      </SectionTitle>
      <Glass className="cnb-chart-card">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={revenueSeries} margin={{ top: 6, left: -20, right: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6E6AF6" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#6E6AF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="d" tick={{ fill: "#7A7E88", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#15161B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#fff" }} formatter={(v) => `${fmt(v * 1000)} ₸`} />
            <Area type="monotone" dataKey="revenue" stroke="#6E6AF6" strokeWidth={2} fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </Glass>

      <SectionTitle action={<button className="cnb-link-btn" onClick={() => nav("projects")}>Все <ChevronRight size={13} /></button>}>
        Активные проекты
      </SectionTitle>
      <div className="cnb-hlist">
        {preview.length === 0 && (
          <div className="cnb-empty-inline">Нет активных проектов — все завершены 🎉</div>
        )}
        {preview.map((p) => (
          <Glass key={p.id} className="cnb-project-mini" onClick={() => nav("projects", p)}>
            <div className="cnb-dot" style={{ background: p.color }} />
            <div className="cnb-project-mini-name">{p.name}</div>
            <div className="cnb-project-mini-client">{p.client}</div>
            <ProgressBar value={p.progress} color={p.color} />
            <div className="cnb-project-mini-pct mono">{p.progress}%</div>
          </Glass>
        ))}
      </div>

      <QuickSearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        clients={clients}
        projects={projects}
        onOpenClient={(c) => { setShowSearch(false); nav("crm", c); }}
        onOpenProject={(p) => { setShowSearch(false); nav("projects", p); }}
      />

      <div style={{ height: 90 }} />
    </div>
  );
}
