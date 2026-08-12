import { useEffect, useState } from "react";
import {
  DEFAULT_PASSWORD_OPTIONS,
  PASSWORD_LENGTH_MAX,
  PASSWORD_LENGTH_MIN,
  estimatePasswordStrength,
  generatePassword,
  type PasswordOptions,
} from "../lib/passwordGenerator";
import { CopyButton } from "../components/CopyButton";
import { ToolShell } from "../components/ToolShell";

const CHECKBOXES: { key: keyof Omit<PasswordOptions, "length">; label: string }[] = [
  { key: "uppercase", label: "Заглавные буквы (A-Z)" },
  { key: "digits", label: "Цифры (0-9)" },
  { key: "symbols", label: "Спецсимволы (!@#$…)" },
  { key: "excludeSimilar", label: "Исключить похожие символы (0/O, 1/l/I)" },
];

const STRENGTH_BAR_COLOR: Record<string, string> = {
  danger: "bg-danger",
  accent: "bg-accent",
  "accent-2": "bg-accent-2",
};

export function PasswordGenerator() {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [password, setPassword] = useState("");

  // Реактивная регенерация при любом изменении параметров — по спеке 3.1
  // ("реактивное обновление при изменении параметров"), а не по кнопке.
  useEffect(() => {
    setPassword(generatePassword(options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length, options.digits, options.symbols, options.uppercase, options.excludeSimilar]);

  const strength = estimatePasswordStrength(password, options);
  const noCharsAvailable = !password && options.length > 0;

  const toggle = (key: keyof Omit<PasswordOptions, "length">) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ToolShell
      title="Password Generator"
      description="Криптографически стойкая генерация пароля. Ничего не сохраняется — ни здесь, ни в истории."
    >
      <div className="rounded-card border-l-4 border-l-accent-2 bg-surface-2 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 select-all break-all font-mono text-base leading-relaxed text-text">
            {password || "— выберите хотя бы один тип символов —"}
          </div>
          <CopyButton value={password} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Сила пароля</span>
          <span className="text-muted">{strength.entropyBits} бит энтропии · {strength.label}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-all ${STRENGTH_BAR_COLOR[strength.color]}`}
            style={{ width: `${strength.fillPercent}%` }}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Длина</span>
          <span className="text-sm font-medium text-text">{options.length}</span>
        </div>
        <input
          type="range"
          min={PASSWORD_LENGTH_MIN}
          max={PASSWORD_LENGTH_MAX}
          value={options.length}
          onChange={(e) => setOptions((prev) => ({ ...prev, length: Number(e.target.value) }))}
          className="w-full accent-[var(--color-accent)]"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
        {CHECKBOXES.map((cb) => (
          <label key={cb.key} className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={options[cb.key]}
              onChange={() => toggle(cb.key)}
              className="h-4 w-4 rounded border-border accent-[var(--color-accent)]"
            />
            {cb.label}
          </label>
        ))}
      </div>
      {noCharsAvailable && (
        <p className="text-xs text-danger">Выберите хотя бы один тип символов, чтобы сгенерировать пароль.</p>
      )}

      <button
        type="button"
        onClick={() => setPassword(generatePassword(options))}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity
                   hover:opacity-90"
      >
        Сгенерировать ещё
      </button>
    </ToolShell>
  );
}
