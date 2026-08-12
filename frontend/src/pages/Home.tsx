import {
  AtSign,
  Binary,
  Braces,
  CalendarDays,
  CircleUserRound,
  Clock,
  Crop,
  DoorOpen,
  Eraser,
  Hash,
  Heading1,
  History as HistoryIcon,
  Image as ImageIcon,
  Kanban,
  KeyRound,
  LayoutTemplate,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  Megaphone,
  Palette,
  QrCode,
  Route as RouteIcon,
  Scissors,
  Sparkles,
  Stamp,
  Type,
  TextCursorInput,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { modulesConfig, SECTION_LABELS, type ModuleConfig } from "../modules.config";

const ICONS: Record<string, LucideIcon> = {
  "at-sign": AtSign,
  sparkles: Sparkles,
  link: LinkIcon,
  "text-cursor": TextCursorInput,
  type: Type,
  eraser: Eraser,
  "key-round": KeyRound,
  braces: Braces,
  binary: Binary,
  clock: Clock,
  route: RouteIcon,
  scissors: Scissors,
  "layout-template": LayoutTemplate,
  "door-open": DoorOpen,
  "list-checks": ListChecks,
  heading: Heading1,
  megaphone: Megaphone,
  hash: Hash,
  image: ImageIcon,
  "circle-user-round": CircleUserRound,
  "qr-code": QrCode,
  crop: Crop,
  palette: Palette,
  stamp: Stamp,
  kanban: Kanban,
  "calendar-days": CalendarDays,
  lightbulb: Lightbulb,
  vote: Vote,
};

// Порядок разделов на главной — Telegram Tools (Этап 2) первым, т.к. это
// смысловой центр продукта, Контент (Этап 4) следом — тоже про сам канал,
// Дизайн (Этап 5) — туда же, оформление канала, сразу за текстом, Рост
// (Этап 6) — логическое продолжение Контента (идеи постов и опросы
// продолжают конструкторы контента, см. 06-growth.md), Utility (Этап 3) —
// общие инструменты последними.
const SECTION_ORDER: ModuleConfig["section"][] = ["telegram_tools", "content", "design", "growth", "utility"];

export function Home() {
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-10 pt-6">
      {/* Smart History (Этап 1) до этого нигде не была видна на фронтенде —
          страница /history добавлена в Этапе 6 ради связки с контент-планом
          (см. SmartHistory.tsx), ссылка сюда — самое естественное место. */}
      <div className="mb-4 flex justify-end">
        <Link to="/history" className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-accent">
          <HistoryIcon size={14} strokeWidth={2} />
          История
        </Link>
      </div>

      {SECTION_ORDER.map((section) => {
        const modules = modulesConfig
          .filter((m) => m.section === section)
          .slice()
          .sort((a, b) => a.order - b.order);
        if (modules.length === 0) return null;
        const label = SECTION_LABELS[section];

        return (
          <section key={section} className="mb-8 last:mb-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Раздел</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">{label.title}</h1>
            <p className="mt-2 text-sm text-muted">{label.description}</p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {modules.map((mod) => {
                const Icon = ICONS[mod.icon] ?? Sparkles;
                return (
                  <Link
                    key={mod.key}
                    to={mod.route}
                    className="group flex items-start gap-3 rounded-card border border-border bg-surface p-4
                               transition-colors hover:border-accent"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text group-hover:text-accent">{mod.title}</div>
                      <div className="mt-0.5 text-xs leading-snug text-muted">{mod.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
