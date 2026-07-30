import { Home, Sparkles, Users, FolderKanban, Wallet, MoreHorizontal } from "lucide-react";

export default function BottomNav({ active, setTab }) {
  const items = [
    { key: "dashboard", label: "Главная", icon: Home },
    { key: "ai", label: "AI", icon: Sparkles },
    { key: "crm", label: "CRM", icon: Users },
    { key: "projects", label: "Проекты", icon: FolderKanban },
    { key: "finance", label: "Финансы", icon: Wallet },
    { key: "more", label: "Ещё", icon: MoreHorizontal },
  ];
  return (
    <div className="cnb-bottomnav">
      <div className="cnb-bottomnav-glass">
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <button key={it.key} className={`cnb-nav-item ${isActive ? "active" : ""}`} onClick={() => setTab(it.key)}>
              <it.icon size={19} strokeWidth={isActive ? 2.2 : 1.7} />
              <span>{it.label}</span>
              {isActive && <span className="cnb-nav-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

