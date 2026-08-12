import { useEffect, useRef, useState } from "react";
import { saveToHistory, listProjects } from "../lib/api";
import { isInsideTelegram } from "../lib/telegram";
import {
  EXPORT_FORMATS,
  TOOLBAR_ACTIONS,
  exportFormatted,
  renderPreviewHtml,
  wrapSelection,
  type ExportFormat,
} from "../lib/markdown";
import { CopyButton } from "../components/CopyButton";
import { ToolShell } from "../components/ToolShell";

const PLACEHOLDER = "Напишите сообщение… выделите текст и нажмите кнопку разметки на панели ниже.";

export function MarkdownBuilder() {
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<ExportFormat>("markdownv2");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isInsideTelegram()) return;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (active) setProjectId(active.id);
      })
      .catch(() => {});
  }, []);

  const applyWrap = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const { text, selectionStart, selectionEnd } = wrapSelection(
      source,
      el.selectionStart,
      el.selectionEnd,
      before,
      after,
    );
    setSource(text);
    setSaved(false);
    // Возвращаем фокус и выделение после перерисовки, чтобы можно было
    // сразу форматировать следующий фрагмент, не кликая по textarea заново.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const handleLink = () => {
    const url = window.prompt("Ссылка (https://…)");
    if (!url) return;
    applyWrap("[", `](${url})`);
  };

  const exported = exportFormatted(source, format);

  const handleSave = async () => {
    if (!projectId || !source.trim()) return;
    try {
      await saveToHistory(projectId, {
        module_key: "markdown_builder",
        title: source.slice(0, 40),
        payload: { source, format },
        result_text: exported,
      });
      setSaved(true);
    } catch {
      /* необязательно для основной ценности редактора */
    }
  };

  return (
    <ToolShell title="Markdown Builder" description="Форматируйте сообщение с живым превью и экспортом в нужный синтаксис.">
      <div className="flex flex-wrap gap-1.5">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            title={action.title}
            onClick={() => applyWrap(action.before, action.after)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text
                       transition-colors hover:border-accent hover:text-accent"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          title="Ссылка"
          onClick={handleLink}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text
                     transition-colors hover:border-accent hover:text-accent"
        >
          🔗
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="min-h-[140px] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2
                   text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
        placeholder={PLACEHOLDER}
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          setSaved(false);
        }}
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Превью</span>
        {/* Пузырь чата под вид сообщения в Telegram */}
        <div className="rounded-2xl rounded-tl-sm bg-accent px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-sm">
          {source ? (
            <span dangerouslySetInnerHTML={{ __html: renderPreviewHtml(source) }} />
          ) : (
            <span className="opacity-60">{PLACEHOLDER}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Экспорт</span>
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {EXPORT_FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormat(f.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  format === f.key ? "bg-accent text-white" : "text-muted hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-card border-l-4 border-l-accent bg-surface-2 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
              {exported || "— пусто —"}
            </pre>
            <CopyButton value={exported} />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!projectId || !source.trim()}
          title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
          className="self-start text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          {saved ? "✓ В истории" : "Сохранить в историю"}
        </button>
      </div>
    </ToolShell>
  );
}
