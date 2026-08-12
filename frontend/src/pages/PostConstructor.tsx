import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ApiError, buildPost, saveToHistory, type PostConstructorResult } from "../lib/api";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { CONTENT_TONES, DEFAULT_TONE } from "../lib/contentTones";
import { renderTelegramBubbleHtml } from "../lib/telegramPreview";
import { ConsolePanel } from "../components/ConsolePanel";
import { CopyButton } from "../components/CopyButton";
import { ListField } from "../components/ListField";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

const POST_TYPES = [
  { key: "announcement", label: "Анонс" },
  { key: "news", label: "Новость" },
  { key: "sales", label: "Продающий" },
  { key: "personal", label: "Личный" },
];

export function PostConstructor() {
  const { projectId, brandKit } = useActiveBrandKit();
  const location = useLocation();

  const [postType, setPostType] = useState("announcement");
  const [topic, setTopic] = useState("");
  const [theses, setTheses] = useState<string[]>([""]);
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [toneTouched, setToneTouched] = useState(false);

  const [result, setResult] = useState<PostConstructorResult | null>(null);
  const [editedText, setEditedText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Дефолт тона — из Brand Kit.tone_of_voice, но только пока пользователь
  // не выбрал тон вручную (иначе смена активного проекта задним числом
  // затирала бы осознанный выбор).
  useEffect(() => {
    if (brandKit?.tone_of_voice && !toneTouched) setTone(brandKit.tone_of_voice);
  }, [brandKit, toneTouched]);

  // Принимаем тему, переданную из Генератора идей (Этап 6, 6.3, кнопка
  // «Создать пост из этой идеи») — тот же паттерн, что UtmBuilder.tsx →
  // UrlShortener.tsx на Этапе 3: navigate(..., { state: { topic } }).
  useEffect(() => {
    const prefill = (location.state as { topic?: string } | null)?.topic;
    if (prefill) setTopic(prefill);
  }, [location.state]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const cleanTheses = theses.map((t) => t.trim()).filter(Boolean);
      const res = await buildPost({
        post_type: postType,
        topic: topic.trim(),
        theses: cleanTheses,
        tone,
        brand_emojis: brandKit?.brand_emojis ?? [],
      });
      setResult(res);
      setEditedText(res.text);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось собрать пост");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !result) return;
    try {
      await saveToHistory(projectId, {
        module_key: "post_constructor",
        title: topic.trim(),
        payload: { post_type: postType, topic, theses, tone },
        result_text: editedText,
      });
      setSaved(true);
    } catch {
      /* не критично для UX генератора */
    }
  };

  return (
    <ToolShell
      title="Конструктор постов"
      description="Пост по структуре хук → тело → CTA — тезисы сами лягут в нужные секции, CTA возьмётся из Генератора CTA."
    >
      <Field label="Тип поста">
        <select className={inputClass} value={postType} onChange={(e) => setPostType(e.target.value)}>
          {POST_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Тема">
        <input
          className={inputClass}
          placeholder="открытие нового филиала, скидка на подписку…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </Field>

      <ListField
        label="Ключевые тезисы (опционально)"
        items={theses}
        onChange={setTheses}
        placeholder="например: цена ниже рынка"
      />

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
        disabled={!topic.trim() || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Собираю…" : "Собрать пост"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {result && (
        <div className="flex flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Превью</span>
            <div className="rounded-2xl rounded-tl-sm bg-accent px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-sm">
              <span dangerouslySetInnerHTML={{ __html: renderTelegramBubbleHtml(editedText) }} />
            </div>
          </div>

          {isEditing && (
            <textarea
              className="min-h-[160px] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2
                         text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              value={editedText}
              onChange={(e) => {
                setEditedText(e.target.value);
                setSaved(false);
              }}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={editedText} />
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {isEditing ? "Скрыть редактор" : "Редактировать вручную"}
            </button>
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
