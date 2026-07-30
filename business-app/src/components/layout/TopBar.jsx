import { ChevronLeft, Search, Bell } from "lucide-react";
import IconBtn from "../ui/IconBtn";

export default function TopBar({ title, subtitle, onBack, onBell, onSearch, unreadCount = 0, rightExtra }) {
  return (
    <div className="cnb-topbar">
      <div className="cnb-topbar-left">
        {onBack ? (
          <button className="cnb-iconbtn" onClick={onBack}><ChevronLeft size={19} /></button>
        ) : (
          <div className="cnb-logo-mark">N</div>
        )}
        <div>
          <div className="cnb-topbar-title">{title}</div>
          {subtitle && <div className="cnb-topbar-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="cnb-topbar-right">
        {rightExtra}
        {onSearch && <IconBtn icon={Search} onClick={onSearch} />}
        {onBell && (
          <button className="cnb-iconbtn cnb-bell" onClick={onBell}>
            <Bell size={18} strokeWidth={1.8} />
            {unreadCount > 0 && (
              unreadCount > 9
                ? <span className="cnb-bell-count">9+</span>
                : <span className="cnb-bell-dot" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
