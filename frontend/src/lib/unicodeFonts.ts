/**
 * Клиентская мапа unicode-символов (модуль 2.5 Unicode Fonts). Применяется
 * посимвольно через таблицы Mathematical Alphanumeric Symbols и соседних
 * блоков — никакого запроса на бэкенд не требуется, всё честно генерируется
 * в браузере, как и предписано спекой ("клиентская мапа символов").
 */

function buildContiguousMap(
  upperStart: number,
  lowerStart: number,
  digitStart?: number,
): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < 26; i++) {
    map.set(String.fromCharCode(65 + i), String.fromCodePoint(upperStart + i));
    map.set(String.fromCharCode(97 + i), String.fromCodePoint(lowerStart + i));
  }
  if (digitStart !== undefined) {
    for (let i = 0; i < 10; i++) {
      map.set(String.fromCharCode(48 + i), String.fromCodePoint(digitStart + i));
    }
  }
  return map;
}

function applyMap(input: string, map: Map<string, string>): string {
  return Array.from(input)
    .map((ch) => map.get(ch) ?? ch)
    .join("");
}

// 1. Жирный (Mathematical Sans-Serif Bold) — блок без исключений
const boldMap = buildContiguousMap(0x1d5d4, 0x1d5ee, 0x1d7ec);
// 2. Курсив (Sans-Serif Italic)
const italicMap = buildContiguousMap(0x1d608, 0x1d622);
// 3. Жирный курсив (Sans-Serif Bold Italic)
const boldItalicMap = buildContiguousMap(0x1d63c, 0x1d656);
// 4. Моноширинный
const monoMap = buildContiguousMap(0x1d670, 0x1d68a, 0x1d7f6);

// 5. Готический (Fraktur) — 5 заглавных букв исторически заняты отдельными
// символами (ℭ ℌ ℑ ℜ ℨ) вне основного блока, поэтому накладываем исключения.
const frakturMap = buildContiguousMap(0x1d504, 0x1d51e);
const FRAKTUR_EXC: Record<string, number> = { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 };
for (const [ch, cp] of Object.entries(FRAKTUR_EXC)) frakturMap.set(ch, String.fromCodePoint(cp));

// 6. Двойной контур (Double-struck) — 7 заглавных букв тоже вне блока
const doubleMap = buildContiguousMap(0x1d538, 0x1d552, 0x1d7d8);
const DOUBLE_EXC: Record<string, number> = {
  C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124,
};
for (const [ch, cp] of Object.entries(DOUBLE_EXC)) doubleMap.set(ch, String.fromCodePoint(cp));

// 7. Рукописный (Script) — 8 заглавных + 3 строчных вне блока
const scriptMap = buildContiguousMap(0x1d49c, 0x1d4b6);
const SCRIPT_EXC: Record<string, number> = {
  B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b,
  e: 0x212f, g: 0x210a, o: 0x2134,
};
for (const [ch, cp] of Object.entries(SCRIPT_EXC)) scriptMap.set(ch, String.fromCodePoint(cp));

// 8. В кружках (Circled) — цифра 0 не в общем ряду с 1-9
const circledMap = buildContiguousMap(0x24b6, 0x24d0);
circledMap.set("0", String.fromCodePoint(0x24ea));
for (let d = 1; d <= 9; d++) circledMap.set(String(d), String.fromCodePoint(0x2460 + d - 1));

// 9. Полноширинный (Fullwidth) — визуально крупный, "восточный" трекинг
const fullwidthMap = buildContiguousMap(0xff21, 0xff41, 0xff10);
fullwidthMap.set(" ", "\u3000");

// 10. Зеркальный (upside-down) — curated-таблица общеупотребимых "перевёрнутых"
// эквивалентов + разворот строки. Символы без пары остаются как есть.
const MIRROR_MAP: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ",
  k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ",
  u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", B: "B", C: "Ɔ", D: "D", E: "Ǝ", F: "Ⅎ", G: "⅁", H: "H", I: "I", J: "ſ",
  K: "K", L: "˥", M: "W", N: "N", O: "O", P: "Ԁ", Q: "Q", R: "R", S: "S", T: "⊥",
  U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", Z: "Z",
  "0": "0", "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ", "8": "8", "9": "6",
  ".": "˙", ",": "'", "'": ",", '"': ",,", "`": ",", "?": "¿", "!": "¡",
  "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<",
  "&": "⅋", "_": "‾",
};

function mirror(input: string): string {
  return Array.from(input)
    .reverse()
    .map((ch) => MIRROR_MAP[ch] ?? ch)
    .join("");
}

// 11. Зачёркнутый — комбинирующий символ "long stroke overlay" после каждого символа
function strikethrough(input: string): string {
  return Array.from(input)
    .map((ch) => (ch === "\n" ? ch : ch + "\u0336"))
    .join("");
}

export interface FontStyle {
  key: string;
  label: string;
  transform: (input: string) => string;
}

export const fontStyles: FontStyle[] = [
  { key: "bold", label: "Жирный", transform: (s) => applyMap(s, boldMap) },
  { key: "italic", label: "Курсив", transform: (s) => applyMap(s, italicMap) },
  { key: "bold_italic", label: "Жирный курсив", transform: (s) => applyMap(s, boldItalicMap) },
  { key: "monospace", label: "Моноширинный", transform: (s) => applyMap(s, monoMap) },
  { key: "fraktur", label: "Готический", transform: (s) => applyMap(s, frakturMap) },
  { key: "double_struck", label: "Двойной контур", transform: (s) => applyMap(s, doubleMap) },
  { key: "script", label: "Рукописный", transform: (s) => applyMap(s, scriptMap) },
  { key: "circled", label: "В кружках", transform: (s) => applyMap(s, circledMap) },
  { key: "fullwidth", label: "Полноширинный", transform: (s) => applyMap(s, fullwidthMap) },
  { key: "strikethrough", label: "Зачёркнутый", transform: strikethrough },
  { key: "mirror", label: "Зеркальный", transform: mirror },
];

/** Zero-width space — невидимый символ-разделитель (2.5 "Вставить невидимый символ") */
export const ZERO_WIDTH_SPACE = "\u200B";
