import { useState } from "react";
import { ApiError, buildPollQuiz, saveToHistory, type PollQuizResult } from "../lib/api";
import { useActiveProjectId } from "../lib/useActiveProjectId";
import { ConsolePanel } from "../components/ConsolePanel";
import { CopyButton } from "../components/CopyButton";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

const TYPES: { key: "poll" | "quiz"; label: string }[] = [
  { key: "poll", label: "Опрос" },
  { key: "quiz", label: "Викторина" },
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const MAX_OPTION_LENGTH = 100;

export function PollQuizGenerator() {
  const projectId = useActiveProjectId();

  const [type, setType] = useState<"poll" | "quiz">("poll");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);

  const [result, setResult] = useState<PollQuizResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateOption = (index: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    if (correctIndex === index) setCorrectIndex(null);
    else if (correctIndex !== null && correctIndex > index) setCorrectIndex(correctIndex - 1);
  };

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canGenerate =
    question.trim().length > 0 &&
    cleanOptions.length >= MIN_OPTIONS &&
    cleanOptions.every((o) => o.length <= MAX_OPTION_LENGTH) &&
    (type === "poll" || (correctIndex !== null && correctIndex < cleanOptions.length));

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await buildPollQuiz({
        type,
        question: question.trim(),
        options: cleanOptions,
        correct_index: type === "quiz" ? correctIndex : null,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось собрать опрос/викторину");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !result) return;
    try {
      await saveToHistory(projectId, {
        module_key: "poll_quiz_generator",
        title: result.question,
        payload: { type: result.type, question: result.question, options: result.options, correct_index: result.correct_index },
        result_text: result.copy_text,
      });
      setSaved(true);
    } catch {
      /* не критично для UX генератора */
    }
  };

  return (
    <ToolShell
      title="Генератор опросов/викторин"
      description="Соберите опрос или викторину с проверкой лимитов Telegram — вопрос и варианты, готовые для нативного Poll."
    >
      <Field label="Тип">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                type === t.key ? "bg-accent text-white" : "text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Вопрос">
        <input
          className={inputClass}
          placeholder="Что вам интереснее из следующего?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Варианты ответа ({options.length}/{MAX_OPTIONS}
          {type === "quiz" ? ", отметьте правильный" : ""})
        </span>
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => {
            const tooLong = opt.trim().length > MAX_OPTION_LENGTH;
            return (
              <div key={i} className="flex items-center gap-2">
                {type === "quiz" && (
                  <input
                    type="radio"
                    name="correct-option"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    className="h-4 w-4 shrink-0 accent-accent"
                    title="Отметить как правильный вариант"
                  />
                )}
                <input
                  className={`${inputClass} ${tooLong ? "border-danger" : ""}`}
                  placeholder={`Вариант ${i + 1}`}
                  value={opt}
                  maxLength={MAX_OPTION_LENGTH + 20}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= MIN_OPTIONS}
                  title="Удалить вариант"
                  className="shrink-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted
                             transition-colors hover:border-danger hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className="self-start text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          + Добавить вариант
        </button>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Собираю…" : "Собрать"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {result && (
        <div className="flex flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Превью — {result.type_label}
            </span>
            <div className="rounded-2xl rounded-tl-sm bg-surface-2 px-3.5 py-3 text-[15px] leading-snug text-text shadow-sm">
              <p className="font-medium">{result.question}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {result.options.map((opt, i) => {
                  const isCorrect = result.correct_index === i;
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                          isCorrect ? "border-accent-2 bg-accent-2 text-white" : "border-border"
                        }`}
                      >
                        {isCorrect ? "✓" : ""}
                      </span>
                      <span>{opt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={result.copy_text} label="Скопировать структуру" />
            <button
              type="button"
              onClick={handleSave}
              disabled={!projectId}
              title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
              className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
            >
              {saved ? "✓ В истории" : "Сохранить"}
            </button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
