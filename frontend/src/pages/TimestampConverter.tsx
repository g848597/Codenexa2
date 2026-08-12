import { useMemo, useState } from "react";
import {
  dateToDateTimeLocalValue,
  formatsFromDate,
  parseDateTimeLocalInput,
  parseUnixInput,
} from "../lib/timestamp";
import { CopyButton } from "../components/CopyButton";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type Source = "unix" | "datetime";

export function TimestampConverter() {
  const now = useMemo(() => new Date(), []);
  const [source, setSource] = useState<Source>("unix");
  const [unixInput, setUnixInput] = useState(String(Math.floor(now.getTime() / 1000)));
  const [dateTimeInput, setDateTimeInput] = useState(dateToDateTimeLocalValue(now));

  const date = source === "unix" ? parseUnixInput(unixInput) : parseDateTimeLocalInput(dateTimeInput);
  const formats = date ? formatsFromDate(date) : null;

  const setNow = () => {
    const current = new Date();
    setUnixInput(String(Math.floor(current.getTime() / 1000)));
    setDateTimeInput(dateToDateTimeLocalValue(current));
  };

  const rows: { label: string; value: string }[] | null = formats
    ? [
        { label: "ISO 8601", value: formats.iso8601 },
        { label: "UTC", value: formats.utc },
        { label: `Локальное (${Intl.DateTimeFormat().resolvedOptions().timeZone})`, value: formats.local },
        { label: "Unix (секунды)", value: formats.unixSeconds },
        { label: "Unix (миллисекунды)", value: formats.unixMillis },
      ]
    : null;

  return (
    <ToolShell
      title="Timestamp Converter"
      description="Двусторонняя конвертация Unix-времени и даты сразу во все основные форматы."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Unix timestamp">
          <input
            className={inputClass}
            placeholder="1735689600"
            value={unixInput}
            onChange={(e) => {
              setUnixInput(e.target.value);
              setSource("unix");
            }}
            inputMode="numeric"
          />
        </Field>
        <Field label="Дата и время">
          <input
            type="datetime-local"
            step={1}
            className={inputClass}
            value={dateTimeInput}
            onChange={(e) => {
              setDateTimeInput(e.target.value);
              setSource("datetime");
            }}
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={setNow}
        className="w-fit rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted
                   transition-colors hover:border-accent hover:text-text"
      >
        Сейчас
      </button>

      {!date && (unixInput.trim() || dateTimeInput.trim()) && (
        <p className="text-xs text-danger">Не удалось распознать значение — проверьте формат.</p>
      )}

      {rows && (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</div>
                <div className="mt-0.5 truncate font-mono text-sm text-text">{row.value}</div>
              </div>
              <CopyButton value={row.value} />
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
