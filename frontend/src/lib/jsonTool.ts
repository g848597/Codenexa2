/**
 * Модуль 3.2 JSON Formatter / Validator — вся логика клиентская.
 *
 * Тяжёлые зависимости вроде react-json-view/CodeMirror, упомянутые в спеке
 * как вариант, в проект не добавляем — в frontend/package.json уже принят
 * подход "минимум зависимостей, своя подсветка через ConsolePanel"
 * (см. остальные 11 модулей Этапов 2-3), а `JSON.parse` даёт достаточно
 * информации об ошибке (позиция в сообщении V8/JSC), чтобы посчитать
 * строку/колонку самим — без парсер-библиотеки.
 */
export interface JsonParseError {
  message: string;
  position: number | null; // индекс символа в исходной строке, если найден
  line: number | null;
  column: number | null;
}

export interface JsonParseResult {
  ok: boolean;
  value?: unknown;
  error?: JsonParseError;
}

/** Движки (V8/JSC) кладут позицию в текст ошибки по-разному:
 *  - V8: "Unexpected token } in JSON at position 42"
 *  - JSC/Safari: "JSON Parse error: Unexpected identifier ... line 3 column 5" */
function extractPosition(message: string, source: string): { position: number | null; line: number | null; column: number | null } {
  const posMatch = message.match(/position (\d+)/i);
  if (posMatch) {
    const position = Number(posMatch[1]);
    const { line, column } = positionToLineColumn(source, position);
    return { position, line, column };
  }
  const lineColMatch = message.match(/line (\d+) column (\d+)/i);
  if (lineColMatch) {
    return { position: null, line: Number(lineColMatch[1]), column: Number(lineColMatch[2]) };
  }
  return { position: null, line: null, column: null };
}

function positionToLineColumn(source: string, position: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

export function parseJson(input: string): JsonParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: { message: "Пусто — введите или вставьте JSON", position: null, line: null, column: null } };
  }
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невалидный JSON";
    const { position, line, column } = extractPosition(message, input);
    return { ok: false, error: { message, position, line, column } };
  }
}

/** Рекурсивно пересобирает объект/массив с ключами объектов в алфавитном
 * порядке — JSON.stringify не сортирует ключи сам по себе. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function formatJson(value: unknown, indent: 2 | 4, sortKeys: boolean): string {
  const prepared = sortKeys ? sortKeysDeep(value) : value;
  return JSON.stringify(prepared, null, indent);
}

export function minifyJson(value: unknown, sortKeys: boolean): string {
  const prepared = sortKeys ? sortKeysDeep(value) : value;
  return JSON.stringify(prepared);
}
