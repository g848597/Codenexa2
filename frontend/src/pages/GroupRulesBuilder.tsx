import { useEffect, useState } from "react";
import { ApiError, buildGroupRules, getGroupRulesCatalog, saveToHistory, type GroupRulesCatalog } from "../lib/api";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { renderTelegramBubbleHtml } from "../lib/telegramPreview";
import { ConsolePanel } from "../components/ConsolePanel";
import { CopyButton } from "../components/CopyButton";
import { ListField } from "../components/ListField";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

export function GroupRulesBuilder() {
  const { projectId } = useActiveBrandKit();

  const [catalog, setCatalog] = useState<GroupRulesCatalog | null>(null);
  const [communityType, setCommunityType] = useState("chat_by_interest");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [customRules, setCustomRules] = useState<string[]>([""]);

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getGroupRulesCatalog()
      .then((res) => {
        setCatalog(res);
        if (res.community_types[0]) setCommunityType(res.community_types[0].key);
      })
      .catch(() => {
        /* каталог не критичен для формы — просто не покажем чекбоксы типовых пунктов */
      });
  }, []);

  const toggleKey = (key: string) =>
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const hasAnyRule =
    selectedKeys.length > 0 || customRules.some((r) => r.trim());

  const handleGenerate = async () => {
    if (!hasAnyRule) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await buildGroupRules({
        community_type: communityType,
        standard_rule_keys: selectedKeys,
        custom_rules: customRules.map((r) => r.trim()).filter(Boolean),
      });
      setText(res.text);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось собрать правила");
      setText(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !text) return;
    try {
      await saveToHistory(projectId, {
        module_key: "group_rules",
        title: catalog?.community_types.find((c) => c.key === communityType)?.label ?? communityType,
        payload: { community_type: communityType, standard_rule_keys: selectedKeys, custom_rules: customRules },
        result_text: text,
      });
      setSaved(true);
    } catch {
      /* не критично для UX генератора */
    }
  };

  return (
    <ToolShell title="Правила группы" description="Нумерованный список из типовых пунктов и своих формулировок, в едином стиле.">
      <Field label="Тип сообщества">
        <select className={inputClass} value={communityType} onChange={(e) => setCommunityType(e.target.value)}>
          {(catalog?.community_types ?? []).map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Типовые пункты</span>
        <div className="flex flex-col gap-2">
          {(catalog?.standard_rules ?? []).map((rule) => (
            <label key={rule.key} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={selectedKeys.includes(rule.key)}
                onChange={() => toggleKey(rule.key)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              {rule.label}
            </label>
          ))}
        </div>
      </div>

      <ListField
        label="Свои пункты (опционально)"
        items={customRules}
        onChange={setCustomRules}
        placeholder="например: не постить домашку без разбора"
      />

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!hasAnyRule || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Собираю…" : "Собрать правила"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {text && (
        <div className="flex flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Превью</span>
            <div className="rounded-2xl rounded-tl-sm bg-accent px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-sm">
              <span dangerouslySetInnerHTML={{ __html: renderTelegramBubbleHtml(text) }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={text} label="Скопировать для закрепа" />
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
