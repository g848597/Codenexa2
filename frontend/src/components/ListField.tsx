import { inputClass } from "./ToolShell";

/**
 * Динамический список текстовых полей с добавлением/удалением строк —
 * нужен трём модулям раздела «Контент» (тезисы 4.1, плюшки 4.2, свои
 * пункты правил 4.3), поэтому вынесен в общий компонент вместо трёх копий.
 */
export function ListField({
  label,
  items,
  onChange,
  placeholder,
  addLabel = "Добавить пункт",
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const updateItem = (index: number, value: string) =>
    onChange(items.map((it, i) => (i === index ? value : it)));
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const addItem = () => onChange([...items, ""]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputClass}
              placeholder={placeholder}
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              title="Удалить пункт"
              className="shrink-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted
                         transition-colors hover:border-danger hover:text-danger"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  );
}
