import { useMemo, useState } from "react";
import { decodeBase64Utf8, encodeBase64Utf8, type Base64Mode } from "../lib/base64";
import { ConsolePanel } from "../components/ConsolePanel";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

export function Base64Tool() {
  const [mode, setMode] = useState<Base64Mode>("encode");
  const [input, setInput] = useState("");

  const result = useMemo(() => {
    if (!input) return { ok: true as const, value: "", error: undefined };
    return mode === "encode" ? encodeBase64Utf8(input) : decodeBase64Utf8(input);
  }, [mode, input]);

  const handleSwap = () => {
    // «Поменять местами вход/выход»: если результат валиден, он становится
    // новым входом, а режим переключается на противоположный.
    if (result.ok && result.value) {
      setInput(result.value);
    }
    setMode((prev) => (prev === "encode" ? "decode" : "encode"));
  };

  return (
    <ToolShell
      title="Base64 Encoder/Decoder"
      description="Кодирование и декодирование Base64 с корректной поддержкой кириллицы и emoji (через UTF-8, не голый btoa)."
    >
      <div className="flex overflow-hidden rounded-lg border border-border w-fit">
        <button
          type="button"
          onClick={() => setMode("encode")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "encode" ? "bg-accent text-white" : "bg-surface text-muted hover:text-text"
          }`}
        >
          Encode
        </button>
        <button
          type="button"
          onClick={() => setMode("decode")}
          className={`border-l border-border px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "decode" ? "bg-accent text-white" : "bg-surface text-muted hover:text-text"
          }`}
        >
          Decode
        </button>
      </div>

      <Field label={mode === "encode" ? "Текст для кодирования" : "Base64 для декодирования"}>
        <textarea
          className={`${inputClass} min-h-[120px] resize-y font-mono text-[13px]`}
          placeholder={mode === "encode" ? "Привет, мир! 👋" : "0J/RgNC40LLQtdGCLCDQvNC40YAhIPCfkYc="}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
      </Field>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSwap}
          disabled={!result.ok || !result.value}
          title="Поменять местами вход/выход"
          className="rounded-full border border-border bg-surface p-2 text-muted transition-colors
                     hover:border-accent hover:text-text disabled:opacity-30"
        >
          <span aria-hidden className="block text-sm leading-none">⇅</span>
        </button>
      </div>

      {result.error && <ConsolePanel tone="danger">{result.error}</ConsolePanel>}

      {result.ok && result.value && (
        <ConsolePanel copyValue={result.value} meta={<span>{result.value.length.toLocaleString("ru-RU")} символов</span>}>
          {result.value}
        </ConsolePanel>
      )}
    </ToolShell>
  );
}
