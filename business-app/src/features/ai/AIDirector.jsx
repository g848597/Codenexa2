import React, { useState, useEffect } from "react";
import {
  Sparkles, TrendingUp, Send, FileText, Target, Megaphone, BarChart3,
  MessageSquare, Trash2, RotateCcw, Copy, Check, Square, WifiOff,
} from "lucide-react";
import TopBar from "../../components/layout/TopBar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { safeGet, safeSet } from "../../storage/storageClient";
import { projectFinancials } from "../../storage/projectsStorage";
import { sendToAIDirector } from "../../services/aiDirectorClient";
import { haptic } from "../../utils/telegram";
import { SEED_CLIENTS } from "../../data/seedClients";
import { SEED_PROJECTS } from "../../data/seedProjects";
import { COMPANY } from "../../data/mockData";
import { TEAM } from "../../data/teamData";
import { dashboardMetrics } from "../../storage/aggregates";
import { fmt, formatRelative, formatDeadline } from "../../utils/helpers";

/**
 * AI Director chat screen. Talks to our own backend proxy (see
 * services/aiDirectorClient.js + /server), never to the Anthropic API
 * directly — the API key must never be exposed to the browser. The proxy
 * receives a system prompt built from live business data
 * (buildBusinessContext) so answers are grounded in real clients /
 * projects / team figures.
 */

const AI_QUICK = [
  { label: "Сделай КП", icon: FileText },
  { label: "Ответь клиенту", icon: MessageSquare },
  { label: "Проанализируй бизнес", icon: BarChart3 },
  { label: "Финансовый прогноз", icon: TrendingUp },
  { label: "Маркетинг-стратегия", icon: Megaphone },
  { label: "Найди слабые места", icon: Target },
];

const AI_GREETING = "Здравствуйте! Я знаю всё о вашей компании — клиентов, проекты, финансы. С чего начнём сегодня?";
const AI_CHAT_KEY = "ai-director:messages";
const AI_MAX_HISTORY_TO_MODEL = 16; // сколько последних сообщений реально уходит в API (контроль токенов)
const AI_INPUT_LIMIT = 4000;

function buildBusinessContext(clients, projects) {
  const clientsSummary = (clients && clients.length ? clients : SEED_CLIENTS).map(
    (c) => `- ${c.name} (контакт: ${c.contact}, статус: ${c.status}, сумма сделки: ${fmt(c.value)} ₸, последний контакт: ${formatRelative(c.lastContactAt)}, менеджер: ${c.manager})`
  ).join("\n");
  const projectsSummary = (projects && projects.length ? projects : SEED_PROJECTS).map((p) => {
    const { income, expense } = projectFinancials(p);
    return `- ${p.name} для ${p.client} (статус: ${p.status}): прогресс ${p.progress}%, бюджет ${fmt(p.budget)} ₸, доход ${fmt(income)} ₸, расход ${fmt(expense)} ₸, срок ${formatDeadline(p.deadline)}, менеджер: ${p.manager}`;
  }).join("\n");
  const teamSummary = TEAM.map((m) => `- ${m.name}, ${m.role}, KPI ${m.kpi}, задач в работе: ${m.tasks}`).join("\n");
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const activeProjectsCount = (projects && projects.length ? projects : SEED_PROJECTS).filter((p) => p.status !== "Завершён").length;
  const metrics = dashboardMetrics(clients && clients.length ? clients : SEED_CLIENTS, projects && projects.length ? projects : SEED_PROJECTS);

  return `Ты — AI Director внутри CodeNexa Business, операционной системы бизнеса компании "${COMPANY.name}" (${COMPANY.legal}, БИН ${COMPANY.bin}, план ${COMPANY.plan}). Сегодня ${today}.
Ты знаешь всю информацию о компании ниже и отвечаешь как проактивный директор по операциям: кратко, по делу, на русском языке, предлагаешь конкретные следующие шаги.

ФИНАНСЫ:
Выручка сегодня: ${fmt(metrics.revenueToday)} ₸ (${metrics.revenueDelta > 0 ? "+" : ""}${metrics.revenueDelta}% к прошлому периоду)
Прибыль: ${fmt(metrics.profit)} ₸ (${metrics.profitDelta > 0 ? "+" : ""}${metrics.profitDelta}%)
Новые заявки: ${metrics.newLeads}, активные проекты: ${activeProjectsCount}, просроченные задачи: ${metrics.overdue}

КЛИЕНТЫ (CRM):
${clientsSummary}

ПРОЕКТЫ:
${projectsSummary}

КОМАНДА:
${teamSummary}

Если пользователь просит составить документ (КП, письмо клиенту, презентацию) — напиши содержательный черновик текста прямо в чате, используя реальные имена клиентов и суммы из данных выше. Если просит анализ — опирайся на конкретные цифры выше, а не общие фразы. Отвечай компактно (не более 6-8 предложений).
Форматируй ответ в лёгком markdown: **жирный** для акцентов, "- " для маркированных списков, "1. " для нумерованных — интерфейс отрендерит это красиво.`;
}

/* ---- lightweight, safe markdown-lite renderer (no dangerouslySetInnerHTML) ---- */
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return <code key={`${keyPrefix}-${i}`} className="cnb-inline-code">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function renderRichText(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^[-•]\s+(.*)/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)/);
    if (bullet) {
      if (!list || list.type !== "ul") { flush(); list = { type: "ul", items: [] }; }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || list.type !== "ol") { flush(); list = { type: "ol", items: [] }; }
      list.items.push(numbered[2]);
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  });
  flush();

  return blocks.map((b, i) => {
    if (b.type === "ul") {
      return <ul key={i} className="cnb-msg-list">{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ul>;
    }
    if (b.type === "ol") {
      return <ol key={i} className="cnb-msg-list">{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ol>;
    }
    if (b.text === "") return <div key={i} style={{ height: 7 }} />;
    return <p key={i} className="cnb-msg-p">{renderInline(b.text, `${i}`)}</p>;
  });
}

function aiTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function AIDirector({ clients, projects }) {
  const [messages, setMessages] = useState([{ role: "ai", text: AI_GREETING, at: new Date().toISOString() }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && "onLine" in navigator ? !navigator.onLine : false);

  const scrollRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const abortRef = React.useRef(null);

  /* ---- load persisted conversation (personal, per user) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await safeGet(AI_CHAT_KEY, false);
      if (cancelled) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
        } catch {}
      }
      setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- persist on change, skip the very first (pre-load) render ---- */
  useEffect(() => {
    if (!historyLoaded) return;
    safeSet(AI_CHAT_KEY, JSON.stringify(messages.slice(-60)), false);
  }, [messages, historyLoaded]);

  /* ---- track connectivity so we can warn before a doomed request ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  /* ---- auto-scroll to newest message ---- */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  /* ---- auto-grow textarea ---- */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  async function callAI(history) {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiMessages = history
        .filter((m) => m.role === "user" || m.role === "ai")
        .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }))
        .slice(-AI_MAX_HISTORY_TO_MODEL);

      const reply = await sendToAIDirector({
        messages: apiMessages,
        businessContext: buildBusinessContext(clients, projects),
        signal: controller.signal,
      });
      setMessages((m) => [...m, { role: "ai", text: reply, at: new Date().toISOString() }]);
    } catch (e) {
      if (e.name === "AbortError") {
        setMessages((m) => [...m, { role: "ai", text: "⏹️ Остановлено вами.", at: new Date().toISOString(), stopped: true }]);
      } else {
        setError("Не удалось связаться с AI. Проверьте соединение и попробуйте снова.");
        setMessages((m) => [...m, { role: "ai", text: "⚠️ Не получилось обработать запрос — попробуйте ещё раз.", at: new Date().toISOString(), failed: true }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function send(text) {
    const t = (text ?? input).slice(0, AI_INPUT_LIMIT);
    if (!t.trim() || loading) return;
    haptic("light");
    const userMsg = { role: "user", text: t, at: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    callAI(next);
  }

  function retryLast() {
    // resend the most recent user message without duplicating it
    let idx = messages.length - 1;
    while (idx >= 0 && messages[idx].role === "ai") idx--;
    if (idx < 0) return;
    const trimmed = messages.slice(0, idx + 1);
    setMessages(trimmed);
    callAI(trimmed);
  }

  function regenerate() {
    if (loading) return;
    let idx = messages.length - 1;
    while (idx >= 0 && messages[idx].role === "ai") idx--;
    if (idx < 0) return;
    const trimmed = messages.slice(0, idx + 1);
    setMessages(trimmed);
    callAI(trimmed);
  }

  function stopGenerating() {
    if (abortRef.current) abortRef.current.abort();
  }

  function requestClear() { setConfirmClear(true); }
  function doClear() {
    const fresh = [{ role: "ai", text: AI_GREETING, at: new Date().toISOString() }];
    setMessages(fresh);
    setConfirmClear(false);
    setError(null);
    safeSet(AI_CHAT_KEY, JSON.stringify(fresh), false);
  }

  function copyMessage(text, idx) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1600);
    }).catch(() => {});
  }

  const lastAiIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "ai") return i;
    return -1;
  })();
  const canRegenerate = lastAiIdx > 0 && !loading;

  return (
    <div className="cnb-screen">
      <TopBar
        title="AI Director"
        subtitle={offline ? "Нет соединения" : "Знает весь ваш бизнес"}
        rightExtra={
          <button className="cnb-iconbtn" onClick={requestClear} title="Очистить диалог" aria-label="Очистить диалог">
            <Trash2 size={17} strokeWidth={1.8} />
          </button>
        }
      />

      {offline && (
        <div className="cnb-ai-offline-banner"><WifiOff size={14} /> Нет подключения к интернету — сообщения не отправятся</div>
      )}

      <div className="cnb-ai-chat" ref={scrollRef}>
        {messages.map((m, i) => {
          const isAi = m.role === "ai";
          const isLastAi = isAi && i === lastAiIdx;
          return (
            <div key={i} className={`cnb-msg ${isAi ? "cnb-msg-ai" : "cnb-msg-user"}`}>
              {isAi && <div className="cnb-msg-avatar"><Sparkles size={13} /></div>}
              <div className="cnb-msg-col">
                <div className={`cnb-msg-bubble ${m.failed ? "cnb-msg-bubble-error" : ""}`}>
                  {isAi ? renderRichText(m.text) : <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>}
                </div>
                <div className="cnb-msg-meta">
                  {m.at && <span className="cnb-msg-time">{aiTime(m.at)}</span>}
                  {isAi && !m.failed && !m.stopped && (
                    <button className="cnb-msg-action-btn" onClick={() => copyMessage(m.text, i)} title="Скопировать">
                      {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                  {m.failed && (
                    <button className="cnb-msg-action-btn cnb-msg-action-retry" onClick={retryLast} title="Повторить">
                      <RotateCcw size={12} /> Повторить
                    </button>
                  )}
                  {isLastAi && canRegenerate && !m.failed && !m.stopped && (
                    <button className="cnb-msg-action-btn" onClick={regenerate} title="Сгенерировать заново">
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="cnb-msg cnb-msg-ai">
            <div className="cnb-msg-avatar"><Sparkles size={13} /></div>
            <div className="cnb-msg-col">
              <div className="cnb-msg-bubble cnb-msg-typing">
                <span className="cnb-typing-dot" /><span className="cnb-typing-dot" /><span className="cnb-typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <button className="cnb-ai-stop-btn" onClick={stopGenerating}>
          <Square size={12} /> Остановить генерацию
        </button>
      )}

      <div className="cnb-quick-row">
        {AI_QUICK.map((q) => (
          <button key={q.label} className="cnb-quick-chip" onClick={() => send(q.label)} disabled={loading}>
            <q.icon size={13} /> {q.label}
          </button>
        ))}
      </div>

      <div className="cnb-ai-input-bar">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, AI_INPUT_LIMIT))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Спросите что угодно о бизнесе... (Enter — отправить, Shift+Enter — новая строка)"
          className="cnb-ai-input cnb-ai-textarea"
          rows={1}
          disabled={loading}
        />
        <button className="cnb-send-btn" onClick={() => send()} disabled={loading || !input.trim()} style={loading || !input.trim() ? { opacity: 0.5 } : {}} aria-label="Отправить">
          <Send size={16} />
        </button>
      </div>
      {input.length > AI_INPUT_LIMIT * 0.9 && (
        <div className="cnb-ai-charcount">{input.length}/{AI_INPUT_LIMIT}</div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Очистить диалог?"
        message="История переписки с AI Director будет удалена без возможности восстановления."
        confirmLabel="Очистить"
        danger
        onConfirm={doClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

