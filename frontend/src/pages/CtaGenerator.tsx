import { useEffect, useState } from "react";
import { ApiError, generateCta, saveToHistory } from "../lib/api";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { CONTENT_TONES, DEFAULT_TONE } from "../lib/contentTones";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

const GOALS = [
  { key: "subscribe", label: "Подписаться" },
  { key: "follow_link", label: "Перейти по ссылке" },
  { key: "message", label: "Написать в личку" },
  { key: "buy", label: "Купить" },
  { key: "poll", label: "Поучаствовать в опросе" },
];

export function CtaGenerator() {
  const { projectId, brandKit } = useActiveBrandKit();

  const [goal, setGoal] = useState("subscribe");
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [toneTouched, setToneTouched] = useState(false);

  const [variants, setVariants] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (brandKit?.tone_of_voice && !toneTouched) setTone(brandKit.tone_of_voice);
  }, [brandKit, toneTouched]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSavedIndex(null);
    try {
      const res = await generateCta({ goal, tone });
      setVariants(res.variants);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сгенерировать CTA");
      setVariants(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (variant: string, index: number) => {
    if (!projectId) return;
    try {
      await saveToHistory(projectId, {
        module_key: "cta_generator",
        title: GOALS.find((g) => g.key === goal)?.label ?? goal,
        payload: { goal, tone },
        result_text: variant,
      });
      setSavedIndex(index);
    } catch {
      /* не критично для UX генератора */
    }
  };

  return (
    <ToolShell
      title="Генератор CTA"
      description="3 непохожих призыва к действию под цель и тон. Используется и отдельно, и как шаг внутри Конструктора постов."
    >
      <Field label="Цель CTA">
        <select className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Тон">
        <select
          className={inputClass}
          value={tone}
          onChange={(e) => {
            setTone(e.target.value);
            setToneTouched(true);
          }}
        >
          {CONTENT_TONES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Генерирую…" : "Сгенерировать CTA"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {variants && (
        <div className="flex flex-col gap-3">
          {variants.map((variant, i) => (
            <ConsolePanel
              key={i}
              copyValue={variant}
              meta={
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(variant, i)}
                    disabled={!projectId}
                    title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
                    className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                  >
                    {savedIndex === i ? "✓ В истории" : "Сохранить"}
                  </button>
                </div>
              }
            >
              {variant}
            </ConsolePanel>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
