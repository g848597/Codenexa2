import {
  ListChecks, Handshake, Megaphone, Users, BarChart3, Bell,
  Settings as SettingsIcon, UserCog, CreditCard,
} from "lucide-react";
import Glass from "../../components/ui/Glass";
import TopBar from "../../components/layout/TopBar";

export default function MoreGrid({ nav }) {
  const items = [
    { key: "tasks", label: "Задачи", icon: ListChecks, color: "#6E6AF6" },
    { key: "sales", label: "Продажи", icon: Handshake, color: "#17D896" },
    { key: "marketing", label: "Маркетинг", icon: Megaphone, color: "#F2B84B" },
    { key: "team", label: "Команда", icon: Users, color: "#22B8FF" },
    { key: "analytics", label: "Аналитика", icon: BarChart3, color: "#6E6AF6" },
    { key: "notifications", label: "Уведомления", icon: Bell, color: "#FF5C5C" },
    { key: "settings", label: "Настройки", icon: SettingsIcon, color: "#9A9EA6" },
    { key: "profile", label: "Профиль", icon: UserCog, color: "#17D896" },
    { key: "subscription", label: "Подписка", icon: CreditCard, color: "#F2B84B" },
  ];
  return (
    <div className="cnb-screen">
      <TopBar title="Ещё" subtitle="Все модули бизнеса" />
      <div className="cnb-more-grid">
        {items.map((it) => (
          <Glass key={it.key} className="cnb-more-tile" onClick={() => nav(it.key)}>
            <div className="cnb-strip-icon" style={{ background: `${it.color}22`, color: it.color, width: 38, height: 38 }}><it.icon size={18} /></div>
            <div className="cnb-more-label">{it.label}</div>
          </Glass>
        ))}
      </div>
      <div style={{ height: 90 }} />
    </div>
  );
}

