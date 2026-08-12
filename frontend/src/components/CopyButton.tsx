import { useState } from "react";

export function CopyButton({ value, label = "Копировать" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Буфер обмена недоступен (например, нет разрешения) — молча игнорируем,
      // текст всё равно виден и выделяем/копируем можно вручную.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium
                 text-muted transition-colors hover:text-text hover:border-accent
                 disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted"
    >
      {copied ? "✓ Скопировано" : label}
    </button>
  );
}
