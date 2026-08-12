import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createContentPlanItem, generateIdeas, type IdeaCard } from "../lib/api";
import { useActiveProjectId } from "../lib/useActiveProjectId";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

const COUNTS: (5 | 10)[] = [5, 10];

// Ниша канала — по спеке (06-growth.md, 6.3) можно было бы брать из Brand
// Kit, "если туда в будущем добавить поле «ниша»", но в текущей схеме
// brand_kits (Этап 1) такого поля нет — заводить его ради одного модуля не
// стали (тот же принцип, что и с палитрой 5 цветов в Design, Этап 5).
// Вместо этого запоминаем нишу в localStorage по проекту — второй вариант,
// прямо предложенный спекой ("запрашивать при первом использовании и
// запоминать").
function nicheStorageKey(projectId: number) {
  return `growth:niche:${projectId}`;
}

export function IdeaGenerator() {
  const projectId = useActiveProjectId();
  const navigate = useNavigate();

  const [niche, setNiche] = useState("");
  const [count, setCount] = useState<5 | 10>(5);
  const [ideas, setIdeas] = useState<IdeaCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const remembered = localStorage.getItem(nicheStorageKey(projectId));
    if (remembered) setNiche(remembered);
  }, [projectId]);

  const handleGenerate = async () => {
    if (!niche.trim()) return;
    setLoading(true);
    setError(null);
    setSavedIndex(null);
    try {
      const res = await generateIdeas(niche.trim(), count);
      setIdeas(res.ideas);
      if (projectId) localStorage.setItem(nicheStorageKey(projectId), niche.trim());
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сгенерировать идеи");
      setIdeas(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = (idea: IdeaCard) => {
    // Чистая клиентская навигация с предзаполненной темой — тот же паттерн,
    // что UtmBuilder.tsx → UrlShortener.tsx (Этап 3), без HTTP-запроса.
    navigate("/tools/post-constructor", { state: { topic: idea.text } });
  };

  const handleAddToPlan = async (idea: IdeaCard, index: number) => {
    if (!projectId) return;
    try {
      await createContentPlanItem(projectId, { title: idea.text, status: "idea" });
      setSavedIndex(index);
    } catch {
      /* не критично для UX генератора, как и сохранение в остальных модулях */
    }
  };

  return (
    <ToolShell
      title="Генератор идей постов"
      description="5 или 10 идей по вашей нише: сторителлинг, экспертный совет, кейс, вопрос аудитории и другие форматы."
    >
      <Field label="Ниша / тема канала">
        <input
          className={inputClass}
          placeholder="кофейни, digital-маркетинг, здоровое питание…"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
      </Field>

      <Field label="Количество идей">
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
        disabled={!niche.trim() || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Генерирую…" : `Сгенерировать ${count} идей`}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {ideas && (
        <div className="flex flex-col gap-3">
          {ideas.map((idea, i) => (
            <ConsolePanel
              key={i}
              copyValue={idea.text}
              meta={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-accent-2">
                    {idea.category_label}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCreatePost(idea)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Создать пост из этой идеи
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToPlan(idea, i)}
                      disabled={!projectId}
                      title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
                      className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                    >
                      {savedIndex === i ? "✓ В плане" : "В контент-план"}
                    </button>
                  </div>
                </div>
              }
            >
              {idea.text}
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
