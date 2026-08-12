/**
 * Модуль 3.1 Password Generator — вся логика клиентская, никакого запроса
 * на бэкенд и никакого сохранения (см. DoD Этапа 3: "Password Generator —
 * НЕ пишет данные в историю/БД" — секьюрити-требование).
 */
export interface PasswordOptions {
  length: number; // слайдер 8-64
  digits: boolean;
  symbols: boolean;
  uppercase: boolean;
  excludeSimilar: boolean; // похожие символы: 0/O, 1/l/I и т.п.
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  digits: true,
  symbols: true,
  uppercase: true,
  excludeSimilar: false,
};

export const PASSWORD_LENGTH_MIN = 8;
export const PASSWORD_LENGTH_MAX = 64;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
// Символы, визуально похожие друг на друга — по умолчанию не исключаются,
// чекбокс включает фильтрацию.
const SIMILAR_RE = /[0O1lI|]/g;

function buildAlphabet(opts: PasswordOptions): string {
  let alphabet = LOWER;
  if (opts.uppercase) alphabet += UPPER;
  if (opts.digits) alphabet += DIGITS;
  if (opts.symbols) alphabet += SYMBOLS;
  if (opts.excludeSimilar) alphabet = alphabet.replace(SIMILAR_RE, "");
  return alphabet;
}

/** Криптографически стойкий выбор индекса в [0, max) без modulo-bias —
 * отбрасываем значения, попавшие в "хвост" диапазона Uint32. */
function secureRandomIndex(max: number): number {
  const range = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= range);
  return value % max;
}

export function generatePassword(opts: PasswordOptions): string {
  const alphabet = buildAlphabet(opts);
  if (!alphabet) return "";
  const chars: string[] = [];
  for (let i = 0; i < opts.length; i++) {
    chars.push(alphabet[secureRandomIndex(alphabet.length)]);
  }
  return chars.join("");
}

export interface PasswordStrength {
  entropyBits: number;
  label: "Очень слабый" | "Слабый" | "Средний" | "Сильный" | "Очень сильный";
  // Цветовая шкала намеренно ограничена палитрой проекта (см. tailwind.config.js:
  // accent/accent-2/danger — других тоновых токенов в дизайн-системе нет),
  // а не произвольным red-orange-yellow-green градиентом.
  color: "danger" | "accent" | "accent-2";
  fillPercent: number; // для полосы-индикатора, 0-100
}

/** Энтропия в битах = length * log2(размер алфавита) — стандартная оценка
 * для пароля со случайными независимыми символами (именно так и генерируем). */
export function estimatePasswordStrength(password: string, opts: PasswordOptions): PasswordStrength {
  const alphabetSize = buildAlphabet(opts).length || 1;
  const entropyBits = password.length > 0 ? Math.round(password.length * Math.log2(alphabetSize)) : 0;
  // 128 бит принимается за верхнюю границу шкалы (2x запас над обычным
  // порогом "надёжно" в 60-80 бит) — дальше полоса просто остаётся полной.
  const fillPercent = Math.min(100, Math.round((entropyBits / 128) * 100));

  let label: PasswordStrength["label"];
  let color: PasswordStrength["color"];
  if (entropyBits < 28) {
    label = "Очень слабый";
    color = "danger";
  } else if (entropyBits < 40) {
    label = "Слабый";
    color = "danger";
  } else if (entropyBits < 60) {
    label = "Средний";
    color = "accent";
  } else if (entropyBits < 80) {
    label = "Сильный";
    color = "accent-2";
  } else {
    label = "Очень сильный";
    color = "accent-2";
  }
  return { entropyBits, label, color, fillPercent };
}
