import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ApiError, listProjects, listShortLinks, shortenUrl, type ShortLink } from "../lib/api";
import { isInsideTelegram } from "../lib/telegram";
import { ConsolePanel } from "../components/ConsolePanel";
import { CopyButton } from "../components/CopyButton";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

export function UrlShortener() {
  const location = useLocation();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [longUrl, setLongUrl] = useState("");
  const [result, setResult] = useState<ShortLink | null>(null);
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Принимаем URL, переданный из UTM Builder кнопкой «Сократить эту ссылку»
  // (см. UtmBuilder.tsx: navigate(..., { state: { originalUrl } })).
  useEffect(() => {
    const prefill = (location.state as { originalUrl?: string } | null)?.originalUrl;
    if (prefill) setLongUrl(prefill);
  }, [location.state]);

  useEffect(() => {
    if (!isInsideTelegram()) return;
    listProjects()
      .then((res) => {
        const active = res.projects.find((p) => p.is_active_default) ?? res.projects[0];
        if (active) setProjectId(active.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    listShortLinks(projectId)
      .then((res) => setLinks(res.short_links))
      .catch(() => {});
  }, [projectId]);

  const handleShorten = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await shortenUrl(projectId, longUrl.trim());
      setResult(res.short_link);
      setLinks((prev) => [res.short_link, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.message) : "Не удалось сократить ссылку");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell
      title="URL Shortener"
      description="Короткая ссылка вместо длинного URL с UTM-метками — удобно постить в канал, видно счётчик переходов."
    >
      <Field label="Длинный URL">
        <input
          className={inputClass}
          placeholder="https://example.com/landing?utm_source=telegram&utm_medium=social&utm_campaign=…"
          value={longUrl}
          onChange={(e) => {
            setLongUrl(e.target.value);
            setResult(null);
            setError(null);
          }}
        />
      </Field>

      <button
        type="button"
        onClick={handleShorten}
        disabled={!longUrl.trim() || !projectId || loading}
        title={projectId ? undefined : "Доступно внутри Telegram Mini App"}
        className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Сокращаю…" : "Сократить ссылку"}
      </button>

      {error && <ConsolePanel tone="danger">{error}</ConsolePanel>}

      {result && (
        <ConsolePanel
          tone="success"
          copyValue={result.short_url}
          meta={<span>{result.clicks} переходов · создана только что</span>}
        >
          {result.short_url}
        </ConsolePanel>
      )}

      {links.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">История ссылок</p>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-text">{link.short_url}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    → {link.original_url} · {link.clicks} {link.clicks === 1 ? "переход" : "переходов"}
                  </div>
                </div>
                <CopyButton value={link.short_url} />
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
