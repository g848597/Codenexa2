import { useEffect, useState } from "react";
import { ApiError, buildWelcomeMessage, saveToHistory } from "../lib/api";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { CONTENT_TONES, DEFAULT_TONE } from "../lib/contentTones";
import { renderTelegramBubbleHtml } from "../lib/telegramPreview";
import { ConsolePanel } from "../components/ConsolePanel";
import { CopyButton } from "../components/CopyButton";
import { ListField } from "../components/ListField";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

export function WelcomeMessageBuilder() {
  const { projectId, brandKit } = useActiveBrandKit();

  const [channelName, setChannelName] = useState("");
  const [perks, setPerks] = useState<string[]>([""]);
  const [rulesShort, setRulesShort] = useState("");
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [toneTouched, setToneTouched] = useState(false);

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (brandKit?.tone_of_voice && !toneTouched) setTone(brandKit.tone_of_voice);
  }, [brandKit, toneTouched]);

  const handleGenerate = async () => {
    if (!channelName.trim()) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await buildWelcomeMessage({
        channel_name: channelName.trim(),
        perks: perks.map((p) => p.trim()).filter(Boolean),
        rules_short: rulesShort.trim() || undefined,
        tone,
      });
      setText(res.text);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось собрать приветствие");
      setText(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !text) return;
    try {
      await saveToHistory(projectId, {
        module_key: "welcome_message",
        title: channelName.trim(),
        payload: { channel_name: channelName, perks, rules_short: rulesShort, tone },
        result_text: text,
      });
      setSaved(true);
    } catch {
      /* не критично для UX генератора */
    }
  };

  return (
    <ToolShell
      title="Приветственное сообщение"
      description="Текст приветствия для новых участников — с плейсхолдером {name} под будущую подстановку ботом."
    >
      <Field label="Название канала/группы">
        <input
          className={inputClass}
          placeholder="IT Клуб"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
        />
      </Field>

      <ListField
        label="Что получает новый участник (опционально)"
        items={perks}
        onChange={setPerks}
        placeholder="доступ к базе знаний"
      />

      <Field label="Правила коротко (опционально)">
        <input
          className={inputClass}
          placeholder="без спама, уважение к участникам"
          value={rulesShort}
          onChange={(e) => setRulesShort(e.target.value)}
        />
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
        disabled={!channelName.trim() || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Собираю…" : "Сгенерировать приветствие"}
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

          <p className="text-xs text-muted">
            Этот текст можно закрепить или подключить к боту как автоответ на /start — {"{name}"} бот подставит сам.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={text} />
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
