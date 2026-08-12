import { useState } from "react";
import { ApiError, checkUsername, type UsernameCheckResult } from "../lib/api";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, inputClass, ToolShell } from "../components/ToolShell";

export function UsernameChecker() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<UsernameCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const handleCheck = async () => {
    const clean = username.trim();
    if (!clean) return;
    setLoading(true);
    setNetworkError(null);
    try {
      const res = await checkUsername(clean);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) setNetworkError(String(err.message));
      else setNetworkError("Не удалось выполнить проверку. Проверьте соединение и повторите.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell
      title="Username Checker"
      description="Проверьте, свободен ли username для канала или бота, не открывая t.me вручную."
    >
      <Field label="Username">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input
              className={`${inputClass} pl-6`}
              placeholder="mychannel"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              maxLength={32}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            onClick={handleCheck}
            disabled={!username.trim() || loading}
            className="rounded-lg bg-accent px-4 text-sm font-medium text-white transition-opacity
                       hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "…" : "Проверить"}
          </button>
        </div>
      </Field>

      {networkError && (
        <ConsolePanel tone="danger" copyValue={undefined}>
          {networkError}
        </ConsolePanel>
      )}

      {result && !networkError && (
        <ConsolePanel
          tone={result.status === "free" ? "success" : result.status === "taken" ? "danger" : "neutral"}
          copyValue={result.status === "free" ? `@${result.username}` : result.profile_url ?? undefined}
          meta={
            result.status === "taken"
              ? "Занято — ссылка на профиль скопируется вместо username"
              : result.status === "free"
                ? "Свободно — можно занимать"
                : undefined
          }
        >
          {result.status === "free" && `✅ @${result.username} свободен`}
          {result.status === "taken" && `🚫 @${result.username} занят${result.profile_url ? ` — ${result.profile_url}` : ""}`}
          {result.status === "invalid" && `⚠️ ${result.error}`}
          {result.status === "unknown" && `❓ ${result.error ?? "Не удалось определить статус"}`}
        </ConsolePanel>
      )}
    </ToolShell>
  );
}
