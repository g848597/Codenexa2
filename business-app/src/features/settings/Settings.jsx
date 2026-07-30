import { useEffect, useState } from "react";
import { ChevronRight, Building2, FileText, Layers, Globe, Shield, X, Check } from "lucide-react";
import Glass from "../../components/ui/Glass";
import TopBar from "../../components/layout/TopBar";
import { loadCompanySettings, saveCompanySettings, CURRENCIES } from "../../storage/settingsStorage";
import { loadTeam } from "../../storage/teamStorage";

const ACCENTS = ["#6E6AF6", "#17D896", "#22B8FF", "#F2B84B", "#FF5C5C"];
const DOC_TEMPLATES = [
  "Коммерческое предложение", "Договор оказания услуг", "Акт выполненных работ", "Счёт на оплату", "NDA",
];

function ModalShell({ title, onClose, children }) {
  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" style={{ maxHeight: "78vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-modal-title">{title}</div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cnb-modal-body" style={{ overflowY: "auto" }}>{children}</div>
      </Glass>
    </div>
  );
}

export default function Settings({ onBack }) {
  const [settings, setSettings] = useState(null);
  const [openModal, setOpenModal] = useState(null); // "profile" | "templates" | "brand" | "integrations" | "access"
  const [profileDraft, setProfileDraft] = useState(null);
  const [team, setTeam] = useState([]);

  useEffect(() => {
    (async () => {
      const s = await loadCompanySettings();
      setSettings(s);
      const { items } = await loadTeam();
      setTeam(items);
    })();
  }, []);

  function persist(next) {
    setSettings(next);
    saveCompanySettings(next);
    window.dispatchEvent(new Event("cnb:appearance-changed"));
  }

  if (!settings) return null;

  const rows = [
    { key: "profile", icon: Building2, label: "Реквизиты компании" },
    { key: "templates", icon: FileText, label: "Шаблоны документов" },
    { key: "brand", icon: Layers, label: "Фирменный стиль" },
    { key: "integrations", icon: Globe, label: "Интеграции" },
    { key: "access", icon: Shield, label: "Права доступа" },
  ];

  return (
    <div className="cnb-screen">
      <TopBar title="Настройки" subtitle={settings.profile.legal} onBack={onBack} />
      <Glass className="cnb-detail-hero">
        <div className="cnb-logo-mark" style={{ width: 56, height: 56, fontSize: 22 }}>{settings.profile.name[0]}</div>
        <div style={{ marginTop: 10, fontWeight: 600, fontSize: 17 }}>{settings.profile.name}</div>
        <div style={{ color: "#9A9EA6", fontSize: 13 }}>БИН {settings.profile.bin}</div>
      </Glass>
      <div className="cnb-list">
        {rows.map((r) => (
          <Glass key={r.key} className="cnb-client-row" onClick={() => { if (r.key === "profile") setProfileDraft(settings.profile); setOpenModal(r.key); }}>
            <div className="cnb-strip-icon" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}><r.icon size={16} /></div>
            <div className="cnb-client-info"><div className="cnb-client-name">{r.label}</div></div>
            <ChevronRight size={16} color="#9A9EA6" />
          </Glass>
        ))}
      </div>
      <div style={{ height: 40 }} />

      {openModal === "profile" && (
        <ModalShell title="Реквизиты компании" onClose={() => setOpenModal(null)}>
          <div className="cnb-field">
            <label>Название</label>
            <input className="cnb-input" value={profileDraft.name} onChange={(e) => setProfileDraft((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="cnb-field">
            <label>Юр. лицо</label>
            <input className="cnb-input" value={profileDraft.legal} onChange={(e) => setProfileDraft((p) => ({ ...p, legal: e.target.value }))} />
          </div>
          <div className="cnb-field">
            <label>БИН</label>
            <input className="cnb-input mono" value={profileDraft.bin} onChange={(e) => setProfileDraft((p) => ({ ...p, bin: e.target.value }))} />
          </div>
          <div className="cnb-modal-actions">
            <button className="cnb-btn-secondary" onClick={() => setOpenModal(null)}>Отмена</button>
            <button className="cnb-btn-primary" onClick={() => { persist({ ...settings, profile: profileDraft }); setOpenModal(null); }}>Сохранить</button>
          </div>
        </ModalShell>
      )}

      {openModal === "templates" && (
        <ModalShell title="Шаблоны документов" onClose={() => setOpenModal(null)}>
          <div className="cnb-info-list">
            {DOC_TEMPLATES.map((t) => (
              <div key={t} className="cnb-info-row" style={{ justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><FileText size={14} color="#9A9EA6" /> {t}</span>
                <span className="cnb-history-time" style={{ marginLeft: 0 }}>.docx</span>
              </div>
            ))}
          </div>
          <div className="cnb-empty-inline" style={{ marginTop: 10 }}>
            Эти шаблоны используются при создании документов в CRM и Проектах.
          </div>
        </ModalShell>
      )}

      {openModal === "brand" && (
        <ModalShell title="Фирменный стиль" onClose={() => setOpenModal(null)}>
          <div className="cnb-field-label" style={{ marginBottom: 10, color: "#9A9EA6", fontSize: 13 }}>Основной акцентный цвет интерфейса</div>
          <div className="cnb-accent-row">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className="cnb-accent-swatch"
                style={{ background: c, borderColor: settings.brandAccent === c ? "#fff" : "transparent" }}
                onClick={() => persist({ ...settings, brandAccent: c })}
              >
                {settings.brandAccent === c && <Check size={16} color="#fff" />}
              </button>
            ))}
          </div>

          <div className="cnb-info-row" style={{ justifyContent: "space-between", marginTop: 16 }}>
            <span>Светлая тема</span>
            <button
              className={`cnb-toggle ${settings.theme === "light" ? "on" : ""}`}
              onClick={() => persist({ ...settings, theme: settings.theme === "light" ? "dark" : "light" })}
            >
              <span className="cnb-toggle-knob" />
            </button>
          </div>

          <div className="cnb-field" style={{ marginTop: 12 }}>
            <label>Валюта</label>
            <select className="cnb-input cnb-select" value={settings.currency} onChange={(e) => persist({ ...settings, currency: e.target.value })}>
              {Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{c.label}</option>)}
            </select>
          </div>
          <div className="cnb-empty-inline" style={{ marginTop: 4 }}>
            Изменения темы и акцента применяются сразу. Смена валюты сейчас влияет на новые значения — полный пересчёт истории впереди.
          </div>
        </ModalShell>
      )}

      {openModal === "integrations" && (
        <ModalShell title="Интеграции" onClose={() => setOpenModal(null)}>
          {[
            { key: "telegramBot", label: "Telegram-бот уведомлений" },
            { key: "oneC", label: "1С: Бухгалтерия" },
            { key: "emailMarketing", label: "Email-рассылки" },
          ].map((i) => (
            <div key={i.key} className="cnb-info-row" style={{ justifyContent: "space-between" }}>
              <span>{i.label}</span>
              <button
                className={`cnb-toggle ${settings.integrations[i.key] ? "on" : ""}`}
                onClick={() => persist({ ...settings, integrations: { ...settings.integrations, [i.key]: !settings.integrations[i.key] } })}
              >
                <span className="cnb-toggle-knob" />
              </button>
            </div>
          ))}
        </ModalShell>
      )}

      {openModal === "access" && (
        <ModalShell title="Права доступа" onClose={() => setOpenModal(null)}>
          <div className="cnb-empty-inline" style={{ marginBottom: 10 }}>Роли определяют, кто видит зарплаты и финансовые данные команды.</div>
          <div className="cnb-info-list">
            {team.map((m) => (
              <div key={m.id} className="cnb-info-row" style={{ justifyContent: "space-between" }}>
                <span>{m.name}</span>
                <span className="cnb-history-time" style={{ marginLeft: 0 }}>{m.role}</span>
              </div>
            ))}
            {team.length === 0 && <div className="cnb-empty-inline">В команде пока никого нет — добавьте сотрудников в разделе «Команда».</div>}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
