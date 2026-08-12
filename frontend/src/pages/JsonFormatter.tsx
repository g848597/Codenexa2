import { useMemo, useState } from "react";
import { formatJson, minifyJson, parseJson } from "../lib/jsonTool";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type Action = "format" | "minify";

const SAMPLE = '{\n  "channel": "@my_channel",\n  "subscribers": 12500,\n  "verified": true\n}';

export function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<2 | 4>(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [action, setAction] = useState<Action>("format");

  // Парсинг на лету — по спеке "парсинг на лету, при ошибке — подсветка
  // строки и позиции ошибки", результат/ошибка пересчитываются на каждое
  // изменение input/опций без отдельной кнопки "Проверить".
  const parsed = useMemo(() => parseJson(input), [input]);

  const output = useMemo(() => {
    if (!parsed.ok) return "";
    return action === "format" ? formatJson(parsed.value, indent, sortKeys) : minifyJson(parsed.value, sortKeys);
  }, [parsed, action, indent, sortKeys]);

  const errorLocation =
    parsed.error?.line != null
      ? `строка ${parsed.error.line}${parsed.error.column != null ? `, колонка ${parsed.error.column}` : ""}`
      : null;

  return (
    <ToolShell title="JSON Formatter / Validator" description="Проверка, форматирование и минификация JSON прямо в браузере.">
      <Field label="Входной JSON">
        <textarea
          className={`${inputClass} min-h-[160px] resize-y font-mono text-[13px] leading-relaxed`}
          placeholder={SAMPLE}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
      </Field>

      {input.trim() && !parsed.ok && (
        <ConsolePanel tone="danger">
          {parsed.error?.message}
          {errorLocation ? `\n(${errorLocation})` : ""}
        </ConsolePanel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setAction("format")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              action === "format" ? "bg-accent text-white" : "bg-surface text-muted hover:text-text"
            }`}
          >
            Форматировать
          </button>
          <button
            type="button"
            onClick={() => setAction("minify")}
            className={`border-l border-border px-3 py-1.5 text-xs font-medium transition-colors ${
              action === "minify" ? "bg-accent text-white" : "bg-surface text-muted hover:text-text"
            }`}
          >
            Минифицировать
          </button>
        </div>

        {action === "format" && (
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[2, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIndent(n as 2 | 4)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  indent === n ? "bg-surface-2 text-text" : "bg-surface text-muted hover:text-text"
                } ${n === 4 ? "border-l border-border" : ""}`}
              >
                Отступ {n}
              </button>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={sortKeys}
            onChange={(e) => setSortKeys(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--color-accent)]"
          />
          Сортировка ключей
        </label>
      </div>

      {parsed.ok && (
        <ConsolePanel copyValue={output} meta={<span>{output.length.toLocaleString("ru-RU")} символов</span>}>
          {output}
        </ConsolePanel>
      )}
    </ToolShell>
  );
}
