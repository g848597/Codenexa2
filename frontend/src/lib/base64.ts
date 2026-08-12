/**
 * Модуль 3.3 Base64 Encoder/Decoder.
 *
 * Просто `btoa(text)` падает на кириллице/emoji (Latin1-only), поэтому по
 * спеке используем TextEncoder/TextDecoder — сначала текст превращается в
 * байты UTF-8, а уже байты кодируются в Base64 через btoa/atob посимвольно
 * через String.fromCharCode на бинарной строке.
 */
export type Base64Mode = "encode" | "decode";

export interface Base64Result {
  ok: boolean;
  value: string;
  error?: string;
}

export function encodeBase64Utf8(text: string): Base64Result {
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { ok: true, value: btoa(binary) };
  } catch {
    return { ok: false, value: "", error: "Не удалось закодировать текст" };
  }
}

export function decodeBase64Utf8(base64: string): Base64Result {
  const cleaned = base64.trim();
  if (!cleaned) return { ok: false, value: "", error: "Введите Base64-строку для декодирования" };
  try {
    const binary = atob(cleaned);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return { ok: true, value: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, value: "", error: "Невалидная Base64-строка — проверьте, что скопирован весь текст без лишних символов" };
  }
}
