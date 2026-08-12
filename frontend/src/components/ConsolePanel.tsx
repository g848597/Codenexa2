import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export type ConsoleTone = "neutral" | "success" | "danger";

const TONE_BORDER: Record<ConsoleTone, string> = {
  neutral: "border-l-accent",
  success: "border-l-accent-2",
  danger: "border-l-danger",
};

/**
 * Сквозной сигнатурный элемент всего тулкита: результат — это буквально
 * строка, которую пользователь копирует (username-статус, ссылка,
 * форматированный текст, unicode-стиль), поэтому у него один и тот же
 * "консольный" вид во всех 6 модулях — моноширинный текст на тёмной
 * подложке с цветной левой полосой-статусом, а не 6 разных карточек.
 */
export function ConsolePanel({
  tone = "neutral",
  copyValue,
  children,
  meta,
}: {
  tone?: ConsoleTone;
  copyValue?: string;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className={`rounded-card border-l-4 bg-surface-2 ${TONE_BORDER[tone]}`}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
          {children}
        </div>
        {copyValue !== undefined && <CopyButton value={copyValue} />}
      </div>
      {meta && <div className="border-t border-border px-4 py-2 text-xs text-muted">{meta}</div>}
    </div>
  );
}
