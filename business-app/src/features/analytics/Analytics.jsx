import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import Glass from "../../components/ui/Glass";
import Delta from "../../components/ui/Delta";
import SectionTitle from "../../components/ui/SectionTitle";
import TopBar from "../../components/layout/TopBar";
import { monthlySeries, financeSummary, topProjectsByProfit } from "../../storage/aggregates";

const RANGES = [
  { key: "week", label: "Неделя", days: 7, months: 2 },
  { key: "month", label: "Месяц", days: 30, months: 4 },
  { key: "quarter", label: "Квартал", days: 90, months: 7 },
  { key: "year", label: "Год", days: 365, months: 12 },
];

function pctDelta(current, previous) {
  if (!previous) return current ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

export default function Analytics({ onBack, projects }) {
  const [range, setRange] = useState("month");
  const cfg = RANGES.find((r) => r.key === range);

  const series = useMemo(() => monthlySeries(projects, cfg.months), [projects, cfg.months]);
  const current = useMemo(() => financeSummary(projects, cfg.days), [projects, cfg.days]);
  const previous = useMemo(() => financeSummary(projects, cfg.days * 2), [projects, cfg.days]);
  const prevOnly = {
    income: Math.max(previous.income - current.income, 0),
    profit: Math.max(previous.profit - current.profit, 0),
  };

  const pieData = useMemo(() => topProjectsByProfit(projects, 4), [projects]);

  return (
    <div className="cnb-screen">
      <TopBar title="Аналитика" subtitle="Рост и эффективность" onBack={onBack} />

      <div className="cnb-filter-row">
        {RANGES.map((r) => (
          <button key={r.key} className={`cnb-filter-chip ${range === r.key ? "active" : ""}`} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Доход за период</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 18 }}>{(current.income / 1e6).toFixed(1)} млн ₸</div>
          <Delta value={pctDelta(current.income, prevOnly.income)} />
        </Glass>
        <Glass className="cnb-metric-card">
          <div className="cnb-metric-label">Прибыль за период</div>
          <div className="cnb-metric-value mono" style={{ fontSize: 18, color: "#17D896" }}>{(current.profit / 1e6).toFixed(1)} млн ₸</div>
          <Delta value={pctDelta(current.profit, prevOnly.profit)} />
        </Glass>
      </div>

      <Glass className="cnb-chart-card">
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={series} margin={{ top: 6, left: -20, right: 6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: "#7A7E88", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#15161B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} formatter={(v) => `${v} млн ₸`} />
            <Line type="monotone" dataKey="revenue" stroke="#6E6AF6" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="profit" stroke="#17D896" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Glass>

      <SectionTitle>Самые прибыльные проекты</SectionTitle>
      <Glass className="cnb-chart-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={50} paddingAngle={3} stroke="none">
              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {pieData.map((d) => (
            <div key={d.name} className="cnb-legend-row">
              <span className="cnb-dot" style={{ background: d.color }} /> {d.name} <span className="mono" style={{ marginLeft: "auto" }}>{d.value}%</span>
            </div>
          ))}
        </div>
      </Glass>
      <div style={{ height: 40 }} />
    </div>
  );
}
