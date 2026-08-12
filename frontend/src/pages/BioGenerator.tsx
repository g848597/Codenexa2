import { useEffect, useState } from "react";
import { ApiError, generateBio, listProjects, saveToHistory } from "../lib/api";
import { isInsideTelegram } from "../lib/telegram";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

const TONES = [
  { key: "friendly", label: "Дружелюбный" },
  { key: "expert", label: "Экспертный" },
  { key: "sales", label: "Продающий" },
];
const LENGTHS = [
  { key: "short", label: "Короткое (~70)" },
  { key: "medium", label: "Среднее (~140)" },
];

export function BioGenerator() {
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("friendly");
  const [keywords, setKeywords] = useState("");
  const [length, setLength] = useState<"short" | "medium">("short");
  const [variants, setVariants] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  // Дефолт тона мог бы подхватываться из Brand Kit.tone_of_voice (см. спеку
  // 2.2), но экран Brand Kit — часть Core Foundation UI, которая в этом
  // чате не собиралась; здесь тон просто выбирается вручную.
  useEffect(() => {
    if (!isInsideTelegram()) return;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (active) setProjectId(active.id);
      })
      .catch(() => {
        /* нет активного проекта/не авторизован — сохранение в историю просто будет недоступно */
      });
  }, []);

  const handleGenerate = async () => {
    if (!niche.trim()) return;
    setLoading(true);
    setError(null);
    setSavedIndex(null);
    try {
      const res = await generateBio({ niche: niche.trim(), tone, keywords: keywords.trim() || undefined, length });
      setVariants(res.variants);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сгенерировать варианты");
      setVariants(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (variant: string, index: number) => {
    if (!projectId) return;
    try {
      await saveToHistory(projectId, {
        module_key: "bio_generator",
        title: niche.trim(),
        payload: { niche, tone, keywords, length },
        result_text: variant,
      });
      setSavedIndex(index);
    } catch {
      /* не критично для UX генератора — просто не отметится как сохранённое */
    }
  };

  return (
    <ToolShell title="Bio Generator" description="Короткое цепляющее био для канала, бота или личного профиля.">
      <Field label="Ниша / тема">
        <input
          className={inputClass}
          placeholder="кофейни, инди-игры, финансовая грамотность…"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Тон">
          <select className={inputClass} value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Длина">
          <select className={inputClass} value={length} onChange={(e) => setLength(e.target.value as "short" | "medium")}>
            {LENGTHS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Ключевые слова (опционально)">
        <input
          className={inputClass}
          placeholder="доставка, скидки, 24/7"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
      </Field>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!niche.trim() || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Генерирую…" : "Сгенерировать 3 варианта"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {variants && (
        <div className="flex flex-col gap-3">
          {variants.map((variant, i) => (
            <ConsolePanel
              key={i}
              copyValue={variant}
              meta={
                <div className="flex items-center justify-between">
                  <span>{variant.length} симв.</span>
                  <button
                    type="button"
                    onClick={() => handleSave(variant, i)}
                    disabled={!projectId}
                    title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
                    className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                  >
                    {savedIndex === i ? "✓ В истории" : "Сохранить в историю"}
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
