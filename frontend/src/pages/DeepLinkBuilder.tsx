import { useEffect, useState } from "react";
import { ApiError, buildDeepLink, listProjects, saveToHistory } from "../lib/api";
import { isInsideTelegram } from "../lib/telegram";
import { ConsolePanel } from "../components/ConsolePanel";
import { QrGenerator } from "../components/QrGenerator";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

const LINK_TYPES = [
  { key: "start", label: "start" },
  { key: "startgroup", label: "startgroup" },
  { key: "startapp", label: "startapp" },
  { key: "startchannel", label: "startchannel" },
];

export function DeepLinkBuilder() {
  const [botUsername, setBotUsername] = useState("");
  const [linkType, setLinkType] = useState("start");
  const [param, setParam] = useState("");
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isInsideTelegram()) return;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (active) setProjectId(active.id);
      })
      .catch(() => {});
  }, []);

  const handleBuild = async () => {
    setLoading(true);
    setErrors(null);
    setSaved(false);
    try {
      const res = await buildDeepLink({
        bot_username: botUsername.trim(),
        link_type: linkType,
        param: param.trim(),
      });
      setResult({ url: res.url });
    } catch (err) {
      setResult(null);
      if (err instanceof ApiError && err.detail && typeof err.detail === "object") {
        setErrors(err.detail as Record<string, string>);
      } else {
        setErrors({ _: "Не удалось собрать ссылку, попробуйте ещё раз" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !result) return;
    try {
      await saveToHistory(projectId, {
        module_key: "deep_link_builder",
        title: `@${botUsername} · ${linkType}`,
        payload: { bot_username: botUsername, link_type: linkType, param },
        result_text: result.url,
      });
      setSaved(true);
    } catch {
      /* сохранение необязательно для основной ценности инструмента */
    }
  };

  return (
    <ToolShell
      title="Deep Link Builder"
      description="Соберите корректную deep-link ссылку на бота — без ошибок в синтаксисе."
    >
      <Field label="Username бота">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input
            className={`${inputClass} pl-6`}
            placeholder="mybot"
            value={botUsername}
            onChange={(e) => setBotUsername(e.target.value.replace(/\s/g, ""))}
          />
        </div>
        {errors?.bot_username && <span className="text-xs text-danger">{errors.bot_username}</span>}
      </Field>

      <Field label="Тип ссылки">
        <select className={inputClass} value={linkType} onChange={(e) => setLinkType(e.target.value)}>
          {LINK_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {errors?.link_type && <span className="text-xs text-danger">{errors.link_type}</span>}
      </Field>

      <Field label="Параметр (опционально)">
        <input
          className={inputClass}
          placeholder="ref-instagram"
          value={param}
          onChange={(e) => setParam(e.target.value.replace(/\s/g, ""))}
        />
        {errors?.param && <span className="text-xs text-danger">{errors.param}</span>}
      </Field>

      <button
        type="button"
        onClick={handleBuild}
        disabled={!botUsername.trim() || loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Собираю…" : "Собрать ссылку"}
      </button>

      {errors?._ && <ConsolePanel tone="danger">{errors._}</ConsolePanel>}

      {result && (
        <>
          <ConsolePanel
            tone="success"
            copyValue={result.url}
            meta={
              <button
                type="button"
                onClick={handleSave}
                disabled={!projectId}
                title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
                className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                {saved ? "✓ В истории" : "Сохранить в историю"}
              </button>
            }
          >
            {result.url}
          </ConsolePanel>

          <QrGenerator value={result.url} size={200} />
        </>
      )}
    </ToolShell>
  );
}
