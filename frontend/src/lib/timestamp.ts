/**
 * Модуль 3.4 Timestamp Converter — вся логика клиентская, на Date/Intl.
 */
export interface TimestampFormats {
  iso8601: string;
  utc: string;
  local: string; // часовой пояс браузера пользователя
  unixSeconds: string;
  unixMillis: string;
}

export function formatsFromDate(date: Date): TimestampFormats {
  return {
    iso8601: date.toISOString(),
    utc: date.toUTCString(),
    local: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "long",
    }).format(date),
    unixSeconds: String(Math.floor(date.getTime() / 1000)),
    unixMillis: String(date.getTime()),
  };
}

/** Принимает как секунды, так и миллисекунды — если число похоже на секунды
 * (< 10^12, т.е. до 2001 года в мс было бы подозрительно мало значащих
 * цифр), трактуем как секунды и домножаем на 1000. */
export function parseUnixInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  const millis = Math.abs(num) < 1e12 ? num * 1000 : num;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** datetime-local input отдаёт значение без таймзоны, интерпретируем как
 * локальное время браузера — так же, как это делает сам input. */
export function parseDateTimeLocalInput(raw: string): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateToDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
