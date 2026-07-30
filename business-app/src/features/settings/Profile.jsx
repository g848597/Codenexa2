import { useState } from "react";
import { Zap, FileText, LogOut } from "lucide-react";
import Glass from "../../components/ui/Glass";
import Avatar from "../../components/ui/Avatar";
import Pill from "../../components/ui/Pill";
import SectionTitle from "../../components/ui/SectionTitle";
import TopBar from "../../components/layout/TopBar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { COMPANY } from "../../data/mockData";
import { TEAM } from "../../data/teamData";

export default function Profile({ onBack, clientsCount, projectsCount }) {
  const [showLogout, setShowLogout] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  function handleLogout() {
    // NOTE: this app has no real auth/session backend yet — this is a clearly
    // labeled stub so the button never silently does nothing. Once auth
    // exists, replace this with a real sign-out call.
    setShowLogout(false);
    setLoggedOut(true);
  }

  if (loggedOut) {
    return (
      <div className="cnb-screen">
        <TopBar title="Профиль компании" onBack={onBack} />
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><LogOut size={22} /></div>
          <div className="cnb-empty-title">Вы вышли из аккаунта</div>
          <div className="cnb-empty-text">Аутентификация ещё не подключена к бэкенду — это демонстрационное состояние выхода.</div>
          <button className="cnb-btn-primary" onClick={() => setLoggedOut(false)}>Вернуться в профиль</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cnb-screen">
      <TopBar title="Профиль компании" onBack={onBack} />
      <Glass className="cnb-detail-hero">
        <Avatar label="N" color="#6E6AF6" size={64} />
        <div style={{ marginTop: 10, fontWeight: 600, fontSize: 18 }}>{COMPANY.name}</div>
        <Pill color="#6E6AF6">План {COMPANY.plan}</Pill>
      </Glass>
      <div className="cnb-metric-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Сотрудники</div><div className="cnb-metric-value mono" style={{ fontSize: 18 }}>{TEAM.length}</div></Glass>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Клиенты</div><div className="cnb-metric-value mono" style={{ fontSize: 18 }}>{clientsCount}</div></Glass>
        <Glass className="cnb-metric-card"><div className="cnb-metric-label">Проекты</div><div className="cnb-metric-value mono" style={{ fontSize: 18 }}>{projectsCount}</div></Glass>
      </div>
      <SectionTitle>Сервисы CodeNexa</SectionTitle>
      <Glass className="cnb-info-list">
        <div className="cnb-info-row"><Zap size={14} color="#6E6AF6" /> CodeNexa Business — активен</div>
        <div className="cnb-info-row"><FileText size={14} color="#9A9EA6" /> AI Docs — подключить</div>
      </Glass>
      <button className="cnb-danger-btn" onClick={() => setShowLogout(true)}><LogOut size={15} /> Выйти из аккаунта</button>

      <ConfirmDialog
        open={showLogout}
        title="Выйти из аккаунта?"
        message="Локальные данные останутся сохранены. Аутентификация сейчас работает в демо-режиме."
        confirmLabel="Выйти"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
      <div style={{ height: 40 }} />
    </div>
  );
}
