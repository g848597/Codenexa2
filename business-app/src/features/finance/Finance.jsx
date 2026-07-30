import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import Glass from "../../components/ui/Glass";
import Delta from "../../components/ui/Delta";
import SectionTitle from "../../components/ui/SectionTitle";
import TopBar from "../../components/layout/TopBar";
import { financeSummary, monthlySeries } from "../../storage/aggregates";
import { fmt } from "../../utils/helpers";

function toMillions(n) {
  return (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function pctDelta(current, previous) {
  if (!previous) return current ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

export default function Finance({ projects, clients }) {
  const monthName = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const thisMonth = useMemo(() => financeSummary(projects, 30), [projects]);
  const prevMonth = useMemo(() => financeSummary(projects, 60), [projects]);
  const prevMonthOnly = {
    income: Math.max(prevMonth.income - thisMonth.income, 0),
    expense: Math.max(prevMonth.expense - thisMonth.expense, 0),
  };
  prevMonthOnly.profit = prevMonthOnly.income - prevMonthOnly.expense;

  const series = useMemo(() => monthlySeries(projects, 7), [projects]);

  // Receivables: open deals in CRM not yet closed. Payables: unpaid project expenses we've booked but not yet fully offset by income on that project.
  const receivables = (clients || []).filter((c) => c.status !== "Сделка закрыта").reduce((s, c) => s + (c.value || 0), 0);
  const payables = (projects || []).reduce((s, p) => {
    const txs = p.transactions || [];
    const income = txs.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    const shortfall = Math.max((p.budget || 0) - income, 0);
    return s + Math.min(shortfall, expense);
  }, 0);

  const marginPct = thisMonth.income ? Math.round((thisMonth.profit / thisMonth.income) * 100) : 0;
  const topDebtor = (clients || []).filter((c) => c.status !== "Сделка закрыта").sort((a, b) => (b.value || 0) - (a.value || 0))[0];

  return (
    <div className="cnb-screen">
      <TopBar title="Финансы" subtitle={`За ${monthName}`} />
      <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Доход</div><div className="cnb-metric-value mono" style={{ fontSize: 19 }}>{toMillions(thisMonth.income)} млн ₸</div><Delta value={pctDelta(thisMonth.income, prevMonthOnly.income)} /></Glass>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Расход</div><div className="cnb-metric-value mono" style={{ fontSize: 19, color: "#FF5C5C" }}>{toMillions(thisMonth.expense)} млн ₸</div><Delta value={pctDelta(thisMonth.expense, prevMonthOnly.expense)} /></Glass>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Прибыль</div><div className="cnb-metric-value mono" style={{ fontSize: 19, color: "#17D896" }}>{toMillions(thisMonth.profit)} млн ₸</div><Delta value={pctDelta(thisMonth.profit, prevMonthOnly.profit)} /></Glass>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Средний чек</div><div className="cnb-metric-value mono" style={{ fontSize: 19 }}>{fmt(thisMonth.avgDeal)} ₸</div><span className="cnb-metric-note">за сделку</span></Glass>
      </div>

      <SectionTitle>Доход и прибыль по месяцам</SectionTitle>
      <Glass className="cnb-chart-card">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={series} margin={{ top: 6, left: -20, right: 6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: "#7A7E88", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#15161B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} formatter={(v) => `${v} млн ₸`} />
            <Bar dataKey="revenue" fill="#6E6AF622" radius={[6, 6, 0, 0]} />
            <Bar dataKey="profit" fill="#17D896" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Glass>

      <SectionTitle>Дебиторская / кредиторская задолженность</SectionTitle>
      <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Нам должны</div><div className="cnb-metric-value mono" style={{ fontSize: 17 }}>{toMillions(receivables)} млн ₸</div></Glass>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Мы должны</div><div className="cnb-metric-value mono" style={{ fontSize: 17 }}>{toMillions(payables)} млн ₸</div></Glass>
      </div>

      <Glass className="cnb-ai-hero" style={{ cursor: "default" }}>
        <div className="cnb-ai-glow" />
        <div className="cnb-ai-hero-top"><div className="cnb-ai-badge"><Sparkles size={13} /> AI-анализ</div></div>
        <div className="cnb-ai-line"><span className="cnb-ai-dot" style={{ background: marginPct >= 30 ? "#17D896" : "#F2B84B" }} />Маржинальность за месяц — {marginPct}%.</div>
        {topDebtor && (
          <div className="cnb-ai-line"><span className="cnb-ai-dot" style={{ background: "#F2B84B" }} />Рекомендуем ускорить сбор дебиторской задолженности по {topDebtor.name} ({fmt(topDebtor.value)} ₸).</div>
        )}
      </Glass>
      <div style={{ height: 90 }} />
    </div>
  );
}
