import { useState } from "react";
import { ApiError, generateHashtags } from "../lib/api";
import { ConsolePanel } from "../components/ConsolePanel";
import { CopyButton } from "../components/CopyButton";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

const CATEGORIES = [
  { key: "business", label: "Бизнес" },
  { key: "lifestyle", label: "Лайфстайл" },
  { key: "technology", label: "Технологии" },
  { key: "health", label: "Здоровье" },
  { key: "education", label: "Образование" },
];

const COUNTS: (5 | 10 | 15)[] = [5, 10, 15];

export function HashtagGenerator() {
  const [niche, setNiche] = useState("");
  const [category, setCategory] = useState("business");
  const [count, setCount] = useState<5 | 10 | 15>(10);

  const [hashtags, setHashtags] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!niche.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateHashtags(niche.trim(), category, count);
      setHashtags(res.hashtags);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сгенерировать хештеги");
      setHashtags(null);
    } finally {
      setLoading(false);
    }
  };

  const joined = hashtags?.join(" ") ?? "";

  return (
    <ToolShell
      title="Генератор хештегов"
      description="Тема + локальный словарь по категориям, без AI: без дублей, в едином регистре, готово для вставки."
    >
      <Field label="Тема / ниша">
        <input
          className={inputClass}
          placeholder="кофейни в центре, утренние пробежки…"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
      </Field>

      <Field label="Категория">
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Количество хештегов">
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
        {loading ? "Генерирую…" : "Сгенерировать хештеги"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {hashtags && (
        <ConsolePanel meta={<CopyButton value={joined} label="Скопировать всё" />}>{joined}</ConsolePanel>
      )}
    </ToolShell>
  );
}
