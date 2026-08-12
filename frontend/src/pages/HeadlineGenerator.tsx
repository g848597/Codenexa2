import { useState } from "react";
import { ApiError, generateHeadlines, saveToHistory } from "../lib/api";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

const COUNTS: (3 | 5 | 10)[] = [3, 5, 10];

export function HeadlineGenerator() {
  const { projectId } = useActiveBrandKit();

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<3 | 5 | 10>(5);
  const [headlines, setHeadlines] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setSavedIndex(null);
    try {
      const res = await generateHeadlines(topic.trim(), count);
      setHeadlines(res.headlines);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сгенерировать заголовки");
      setHeadlines(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (headline: string, index: number) => {
    if (!projectId) return;
    try {
      await saveToHistory(projectId, {
        module_key: "headline_generator",
        title: topic.trim(),
        payload: { topic, count },
        result_text: headline,
      });
      setSavedIndex(index);
    } catch {
      /* не критично для UX генератора */
    }
  };

  return (
    <ToolShell
      title="Генератор заголовков"
      description="Разные паттерны заголовков на одну тему: вопрос, число и выгода, интрига, «как…», сравнение."
    >
      <Field label="Тема / тезис поста">
        <input
          className={inputClass}
          placeholder="удалённая работа, утренние тренировки…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
      </Field>

      <Field label="Количество вариантов">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {COUNTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCount(c)}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                count === c ? "bg-accent text-white" : "text-muted hover:text-text"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!topic.trim() || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Генерирую…" : `Сгенерировать ${count} вариантов`}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {headlines && (
        <div className="flex flex-col gap-3">
          {headlines.map((headline, i) => (
            <ConsolePanel
              key={i}
              copyValue={headline}
              meta={
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(headline, i)}
                    disabled={!projectId}
                    title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
                    className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                  >
                    {savedIndex === i ? "✓ В истории" : "Сохранить"}
                  </button>
                </div>
              }
            >
              {headline}
            </ConsolePanel>
          ))}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text
                       transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Ещё варианты
          </button>
        </div>
      )}
    </ToolShell>
  );
}
