import { useMemo, useState } from "react";
import { generateQrSvg, QrGenerator } from "../components/QrGenerator";
import { useActiveBrandKit } from "../lib/useActiveBrandKit";
import { useDesignSave } from "../lib/useDesignSave";
import { DesignSaveBar } from "../components/DesignSaveBar";
import { downloadDataUrl } from "../lib/canvasUtils";
import { Field, ToolShell, inputClass } from "../components/ToolShell";

type TargetType = "channel" | "group" | "bot" | "custom";

const TARGET_TYPES: { key: TargetType; label: string; placeholder: string }[] = [
  { key: "channel", label: "Канал", placeholder: "mychannel" },
  { key: "group", label: "Группа", placeholder: "mygroup" },
  { key: "bot", label: "Бот", placeholder: "mybot" },
  { key: "custom", label: "Произвольная ссылка", placeholder: "https://example.com" },
];

function buildTargetUrl(type: TargetType, value: string): string {
  const clean = value.trim().replace(/^@/, "");
  if (!clean) return "";
  if (type === "custom") return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  return `https://t.me/${clean}`;
}

export function QrCreator() {
  const { projectId, brandKit } = useActiveBrandKit();
  const [targetType, setTargetType] = useState<TargetType>("channel");
  const [value, setValue] = useState("");
  const [color, setColor] = useState("#000000");
  const [useLogo, setUseLogo] = useState(false);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);

  const { status, errorMessage, save } = useDesignSave(projectId, "qr_creator");

  const targetUrl = useMemo(() => buildTargetUrl(targetType, value), [targetType, value]);
  const logoUrl = useLogo ? brandKit?.logo_url ?? null : null;

  const handleDownloadPng = () => {
    if (pngDataUrl) downloadDataUrl(pngDataUrl, "qr-code.png");
  };

  const handleDownloadSvg = async () => {
    if (!targetUrl || logoUrl) return; // SVG-экспорт — только без встроенного лого, см. QrGenerator
    const svg = await generateQrSvg(targetUrl, color);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (!pngDataUrl) return;
    save(pngDataUrl, "qr-code.png", `QR · ${targetType}`, { target_type: targetType, value, color, has_logo: !!logoUrl });
  };

  return (
    <ToolShell
      title="QR Creator"
      description="Фирменный QR-код на канал, группу, бота или произвольную ссылку — с цветом и лого из Brand Kit."
    >
      <Field label="Тип цели">
        <select className={inputClass} value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
          {TARGET_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={targetType === "custom" ? "Ссылка" : "Username"}>
        <input
          className={inputClass}
          placeholder={TARGET_TYPES.find((t) => t.key === targetType)?.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>

      <Field label="Цвет QR">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface" />
      </Field>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={useLogo} onChange={(e) => setUseLogo(e.target.checked)} disabled={!brandKit?.logo_url} />
        Вставить лого по центру
        {!brandKit?.logo_url && <span className="text-xs text-muted">(лого не задано в Brand Kit)</span>}
      </label>

      {targetUrl ? (
        <QrGenerator value={targetUrl} color={color} logoUrl={logoUrl} size={240} onExport={setPngDataUrl} />
      ) : (
        <p className="text-sm text-muted">Введите username или ссылку, чтобы увидеть превью QR-кода</p>
      )}

      {targetUrl && (
        <>
          <DesignSaveBar onDownload={handleDownloadPng} onSave={handleSave} status={status} errorMessage={errorMessage} />
          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={!!logoUrl}
            title={logoUrl ? "SVG-экспорт недоступен с логотипом — скачайте PNG" : undefined}
            className="-mt-2 w-fit text-xs font-medium text-accent underline underline-offset-2 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          >
            Скачать как SVG
          </button>
        </>
      )}
    </ToolShell>
  );
}
