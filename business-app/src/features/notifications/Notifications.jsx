import { DollarSign, AlertTriangle, FileText, Sparkles, CheckCheck } from "lucide-react";
import Glass from "../../components/ui/Glass";
import TopBar from "../../components/layout/TopBar";
import { formatRelative } from "../../utils/helpers";

const ICON_MAP = { money: DollarSign, alert: AlertTriangle, doc: FileText, ai: Sparkles };

export default function Notifications({ onBack, notifications, onMarkRead, onMarkAllRead }) {
  const list = (notifications || []).slice().sort((a, b) => new Date(b.at) - new Date(a.at));
  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <div className="cnb-screen">
      <TopBar
        title="Уведомления"
        subtitle={unreadCount > 0 ? `${unreadCount} новых` : "Все прочитаны"}
        onBack={onBack}
        rightExtra={unreadCount > 0 && (
          <button className="cnb-link-btn" onClick={onMarkAllRead}><CheckCheck size={13} /> Прочитать всё</button>
        )}
      />
      {list.length === 0 && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><Sparkles size={22} /></div>
          <div className="cnb-empty-title">Уведомлений нет</div>
          <div className="cnb-empty-text">Здесь появятся события по клиентам, проектам и платежам.</div>
        </div>
      )}
      <div className="cnb-list">
        {list.map((n) => {
          const Icon = ICON_MAP[n.iconKey] || Sparkles;
          return (
            <Glass
              key={n.id}
              className={`cnb-client-row ${n.read ? "cnb-notif-read" : "cnb-notif-unread"}`}
              onClick={() => !n.read && onMarkRead(n.id)}
            >
              {!n.read && <span className="cnb-notif-dot" />}
              <div className="cnb-strip-icon" style={{ background: `${n.color}22`, color: n.color }}><Icon size={16} /></div>
              <div className="cnb-client-info">
                <div className="cnb-client-name">{n.title}</div>
                <div className="cnb-client-sub">{n.desc}</div>
              </div>
              <div className="cnb-client-sub">{formatRelative(n.at)}</div>
            </Glass>
          );
        })}
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}
