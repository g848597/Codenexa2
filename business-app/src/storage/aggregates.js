/**
 * Pure derivation helpers that turn live `clients` / `projects` state into
 * every number the app shows on Dashboard, Finance, Analytics and Sales.
 * Nothing here reads from storage directly — it's just math over the
 * arrays App.jsx already owns, so any screen that calls these always shows
 * numbers that move the moment a client or project changes.
 */
import { projectFinancials } from "./projectsStorage";
import { STATUS_LIST } from "../data/statusConstants";

const MONTH_LABELS_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

/** Every transaction across every project, tagged with its project. */
export function allTransactions(projects) {
  const out = [];
  (projects || []).forEach((p) => {
    (p.transactions || []).forEach((t) => out.push({ ...t, projectId: p.id, projectName: p.name }));
  });
  return out;
}

/** Aggregate income/expense/profit across all projects, for a given window in days (null = all-time). */
export function financeSummary(projects, windowDays = null) {
  const txs = allTransactions(projects);
  const cutoff = windowDays ? Date.now() - windowDays * 86400000 : null;
  const inWindow = cutoff ? txs.filter((t) => new Date(t.at).getTime() >= cutoff) : txs;

  const income = inWindow.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = inWindow.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const dealCount = inWindow.filter((t) => t.type === "income").length;

  return {
    income,
    expense,
    profit: income - expense,
    avgDeal: dealCount ? Math.round(income / dealCount) : 0,
    txCount: inWindow.length,
  };
}

/** Monthly income/profit series (in millions, matching the chart's previous unit) for the last N months. */
export function monthlySeries(projects, months = 7) {
  const txs = allTransactions(projects);
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS_RU[d.getMonth()] });
  }
  return buckets.map((b) => {
    const inMonth = txs.filter((t) => {
      const d = new Date(t.at);
      return d.getFullYear() === b.year && d.getMonth() === b.month;
    });
    const income = inMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = inMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { m: b.label, revenue: +(income / 1e6).toFixed(2), profit: +((income - expense) / 1e6).toFixed(2) };
  });
}

/** Daily income/expense for the last N days (used by the Dashboard weekly chart). */
export function dailySeries(projects, days = 7) {
  const txs = allTransactions(projects);
  const dayLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const inDay = txs.filter((t) => {
      const at = new Date(t.at).getTime();
      return at >= d.getTime() && at < next.getTime();
    });
    const revenue = inDay.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = inDay.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    out.push({ d: dayLabels[d.getDay()], revenue: Math.round(revenue / 1000), expense: Math.round(expense / 1000) });
  }
  return out;
}

/** Top N projects by realized profit, for the Analytics pie chart. */
export function topProjectsByProfit(projects, n = 4) {
  const withProfit = (projects || []).map((p) => ({ ...p, ...projectFinancials(p) }));
  const total = withProfit.reduce((s, p) => s + Math.max(p.profit, 0), 0);
  const sorted = withProfit.filter((p) => p.profit > 0).sort((a, b) => b.profit - a.profit);
  const top = sorted.slice(0, n - 1);
  const rest = sorted.slice(n - 1);
  const restProfit = rest.reduce((s, p) => s + p.profit, 0);
  const palette = ["#6E6AF6", "#17D896", "#22B8FF", "#F2B84B", "#FF5C5C"];
  const rows = top.map((p, i) => ({
    name: p.name, value: total ? Math.round((p.profit / total) * 100) : 0, color: p.color || palette[i % palette.length],
  }));
  if (rest.length) rows.push({ name: "Прочее", value: total ? Math.round((restProfit / total) * 100) : 0, color: "#9A9EA6" });
  return rows.length ? rows : [{ name: "Нет данных", value: 100, color: "#9A9EA6" }];
}

/** Dashboard top-line metrics, derived entirely from clients/projects. */
export function dashboardMetrics(clients, projects) {
  const today = financeSummary(projects, 1);
  const yesterday = financeSummary(projects, 2);
  const revenueToday = today.income;
  const revenueYesterday = Math.max(yesterday.income - today.income, 0);
  const revenueDelta = revenueYesterday ? +(((revenueToday - revenueYesterday) / revenueYesterday) * 100).toFixed(1) : (revenueToday ? 100 : 0);

  const week = financeSummary(projects, 7);
  const prevWeek = financeSummary(projects, 14);
  const prevWeekOnly = Math.max(prevWeek.profit - week.profit, 0);
  const profitDelta = prevWeekOnly ? +(((week.profit - prevWeekOnly) / prevWeekOnly) * 100).toFixed(1) : (week.profit ? 100 : 0);

  const cutoff24h = Date.now() - 86400000;
  const newLeads = (clients || []).filter((c) => new Date(c.createdAt || 0).getTime() >= cutoff24h).length;
  const activeProjects = (projects || []).filter((p) => p.status !== "Завершён").length;
  const docs = (clients || []).reduce((s, c) => s + (c.documents?.length || 0), 0)
    + (projects || []).reduce((s, p) => s + (p.documents?.length || 0), 0);
  const overdue = (projects || []).filter((p) => p.status !== "Завершён" && p.deadline && new Date(p.deadline) < new Date()).length;
  const messages = (clients || []).reduce((s, c) => s + (c.activity?.filter((a) => a.kind === "comment").length || 0), 0);

  return { revenueToday, revenueDelta, profit: week.profit, profitDelta, newLeads, activeProjects, docs, overdue, messages };
}

/** Sales funnel: client counts + total deal value per CRM status. */
export function salesFunnel(clients) {
  return STATUS_LIST.map((stage) => {
    const inStage = (clients || []).filter((c) => c.status === stage);
    return { stage, count: inStage.length, value: inStage.reduce((s, c) => s + (c.value || 0), 0) };
  });
}

/** Loss-reason breakdown computed from clients that ended up lost/overdue. */
export function lossReasons(clients) {
  const lost = (clients || []).filter((c) => c.status === "Просрочка");
  if (!lost.length) return [];
  const reasonOf = (c) => {
    const days = c.lastContactAt ? Math.floor((Date.now() - new Date(c.lastContactAt).getTime()) / 86400000) : 0;
    if (days > 14) return { key: "slow", label: "Долгий срок ответа на КП", color: "#FF5C5C" };
    if ((c.value || 0) > 3000000) return { key: "price", label: "Цена выше рынка", color: "#F2B84B" };
    return { key: "other", label: "Выбрали другого подрядчика", color: "#6E6AF6" };
  };
  const buckets = {};
  lost.forEach((c) => {
    const r = reasonOf(c);
    buckets[r.key] = buckets[r.key] || { ...r, count: 0 };
    buckets[r.key].count += 1;
  });
  const total = lost.length;
  return Object.values(buckets)
    .sort((a, b) => b.count - a.count)
    .map((b) => ({ ...b, pct: Math.round((b.count / total) * 100) }));
}
