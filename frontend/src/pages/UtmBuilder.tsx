import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProjects, saveToHistory } from "../lib/api";
import { isInsideTelegram } from "../lib/telegram";
import { EMPTY_UTM_FIELDS, buildUtmUrl, getRecentValues, rememberValue, type UtmFields } from "../lib/utm";
import { ConsolePanel } from "../components/ConsolePanel";
import { QrGenerator } from "../components/QrGenerator";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

export function UtmBuilder() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<UtmFields>(EMPTY_UTM_FIELDS);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Автодополнение source/medium из localStorage (последние 10 значений
  // каждого поля) — перечитываем при каждом рендере набора, поэтому просто
  // держим в state и обновляем после rememberValue.
  const [recentSources, setRecentSources] = useState<string[]>(() => getRecentValues("source"));
  const [recentMediums, setRecentMediums] = useState<string[]>(() => getRecentValues("medium"));

  useEffect(() => {
    if (!isInsideTelegram()) return;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (active) setProjectId(active.id);
      })
      .catch(() => {});
  }, []);

  const result = buildUtmUrl(fields);

  const update = (key: keyof UtmFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
    setShowQr(false);
  };

  const handleSave = async () => {
    if (!result.ok) return;
    rememberValue("source", fields.source);
    rememberValue("medium", fields.medium);
    setRecentSources(getRecentValues("source"));
    setRecentMediums(getRecentValues("medium"));

    if (!projectId) return;
    try {
      await saveToHistory(projectId, {
        module_key: "utm_builder",
        title: fields.campaign.trim(),
        payload: fields,
        result_text: result.url,
      });
      setSaved(true);
    } catch {
      /* сохранение в историю необязательно для основной ценности инструмента */
    }
  };

  const handleShowQr = () => {
    if (!result.ok) return;
    setShowQr(true);
  };

  return (
    <ToolShell
      title="UTM Builder"
      description="Соберите ссылку с UTM-метками для рекламных интеграций и кросспостинга — без ошибок в query-string."
    >
      <Field label="Базовый URL">
        <input
          className={inputClass}
          placeholder="https://example.com/landing"
          value={fields.baseUrl}
          onChange={update("baseUrl")}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="utm_source">
          <input
            className={inputClass}
            list="utm-source-options"
            placeholder="telegram, instagram, newsletter"
            value={fields.source}
            onChange={update("source")}
          />
          <datalist id="utm-source-options">
            {recentSources.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <Field label="utm_medium">
          <input
            className={inputClass}
            list="utm-medium-options"
            placeholder="social, cpc, email"
            value={fields.medium}
            onChange={update("medium")}
          />
          <datalist id="utm-medium-options">
            {recentMediums.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="utm_campaign">
        <input className={inputClass} placeholder="spring_sale_2026" value={fields.campaign} onChange={update("campaign")} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="utm_content (опционально)">
          <input className={inputClass} placeholder="banner_top" value={fields.content} onChange={update("content")} />
        </Field>
        <Field label="utm_term (опционально)">
          <input className={inputClass} placeholder="channel_promo" value={fields.term} onChange={update("term")} />
        </Field>
      </div>

      {!result.ok && (fields.baseUrl || fields.source || fields.medium || fields.campaign) && (
        <ConsolePanel tone="danger">{result.error}</ConsolePanel>
      )}

      {result.ok && (
        <>
          <ConsolePanel
            tone="success"
            copyValue={result.url}
            meta={
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={handleShowQr} className="text-xs font-medium text-accent hover:underline">
                    Сгенерировать QR
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/tools/url-shortener", { state: { originalUrl: result.url } })}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Сократить эту ссылку
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!projectId}
                  title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
                  className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                  {saved ? "✓ В истории" : "Сохранить в историю"}
                </button>
              </div>
            }
          >
            {result.url}
          </ConsolePanel>

          {showQr && <QrGenerator value={result.url} size={200} />}
        </>
      )}
    </ToolShell>
  );
}
