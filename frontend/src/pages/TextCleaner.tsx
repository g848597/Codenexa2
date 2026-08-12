import { useMemo, useState } from "react";
import { cleanText, DEFAULT_CLEAN_OPTIONS, type CleanOptions } from "../lib/textCleaner";
import { CopyButton } from "../components/CopyButton";
import { ToolShell } from "../components/ToolShell";

const CHECKBOXES: { key: keyof CleanOptions; label: string }[] = [
  { key: "collapseWhitespace", label: "Убрать двойные пробелы / пустые строки" },
  { key: "stripMarkdown", label: "Убрать markdown-символы" },
  { key: "stripEmoji", label: "Убрать все эмодзи" },
  { key: "normalizeQuotes", label: "Заменить «умные» кавычки/тире на обычные" },
  { key: "stripHtml", label: "Убрать HTML-теги" },
];

export function TextCleaner() {
  const [source, setSource] = useState("");
  const [options, setOptions] = useState<CleanOptions>(DEFAULT_CLEAN_OPTIONS);

  const cleaned = useMemo(() => cleanText(source, options), [source, options]);

  const toggle = (key: keyof CleanOptions) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ToolShell
      title="Text Cleaner"
      description="Уберите скрытое форматирование и мусор из текста, скопированного из Word или с сайта."
    >
      <textarea
        className="min-h-[140px] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2
                   text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
        placeholder="Вставьте исходный текст…"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />

      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
        {CHECKBOXES.map((cb) => (
          <label key={cb.key} className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={options[cb.key]}
              onChange={() => toggle(cb.key)}
              className="h-4 w-4 rounded border-border accent-[var(--color-accent)]"
            />
            {cb.label}
          </label>
        ))}
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Результат</span>
        <div className="rounded-card border-l-4 border-l-accent-2 bg-surface-2 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
              {cleaned || "— пусто —"}
            </pre>
            <CopyButton value={cleaned} />
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
