import { useState } from "react";
import { fontStyles, ZERO_WIDTH_SPACE } from "../lib/unicodeFonts";
import { CopyButton } from "../components/CopyButton";
import { inputClass, ToolShell } from "../components/ToolShell";

export function UnicodeFonts() {
  const [text, setText] = useState("My Channel");

  return (
    <ToolShell
      title="Unicode Fonts"
      description="Стилизованный текст и невидимые символы — для мест, где разметка Telegram не работает (био, имя канала)."
    >
      <input
        className={inputClass}
        placeholder="Введите текст"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={200}
      />
      <p className="-mt-3 text-xs text-muted">
        Большинство стилей — это отдельные символы Unicode для латиницы и цифр (в самом стандарте нет
        «жирной»/«готической» кириллицы), поэтому кириллица в них не меняется. Зачёркнутый и невидимый
        символ работают с любым алфавитом.
      </p>

      <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
        <div>
          <div className="text-sm font-medium text-text">Невидимый символ</div>
          <div className="text-xs text-muted">Zero-width space — разделитель, где нужен «пустой» символ</div>
        </div>
        <CopyButton value={ZERO_WIDTH_SPACE} label="Вставить" />
      </div>

      <div className="flex flex-col gap-2">
        {fontStyles.map((style) => {
          const value = text ? style.transform(text) : "";
          const unchanged = Boolean(text) && value === text && style.key !== "strikethrough";
          return (
            <div
              key={style.key}
              className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{style.label}</div>
                <div className="mt-0.5 truncate text-base text-text">{value || "—"}</div>
                {unchanged && (
                  <div className="mt-0.5 text-[11px] text-muted">нет символов этого алфавита для стиля</div>
                )}
              </div>
              <CopyButton value={value} />
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}
