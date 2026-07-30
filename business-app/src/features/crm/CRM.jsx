import { useState, useMemo } from "react";
import { Users, Search, Plus, AlertTriangle, RotateCcw } from "lucide-react";
import ListSkeleton from "../../components/ui/ListSkeleton";
import Glass from "../../components/ui/Glass";
import Pill from "../../components/ui/Pill";
import Avatar from "../../components/ui/Avatar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TopBar from "../../components/layout/TopBar";
import ClientFormModal from "./ClientFormModal";
import { STATUS_LIST, STATUS_COLOR } from "../../data/statusConstants";
import { fmt, formatRelative } from "../../utils/helpers";

const SORT_OPTIONS = [
  { key: "recent", label: "Недавний контакт" },
  { key: "value_desc", label: "Сумма ↓" },
  { key: "alpha", label: "По алфавиту" },
];

export default function CRM({ clients, loading, persistent, managers, onOpenClient, onCreateClient, onResetDemo }) {
  const [statusFilter, setStatusFilter] = useState("Все");
  const [managerFilter, setManagerFilter] = useState("Все");
  const [sortBy, setSortBy] = useState("recent");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const statusFilters = ["Все", ...STATUS_LIST];

  const filtered = useMemo(() => {
    let list = clients.slice();
    if (statusFilter !== "Все") list = list.filter((c) => c.status === statusFilter);
    if (managerFilter !== "Все") list = list.filter((c) => c.manager === managerFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "value_desc") list.sort((a, b) => b.value - a.value);
    else if (sortBy === "alpha") list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    else list.sort((a, b) => new Date(b.lastContactAt || 0) - new Date(a.lastContactAt || 0));
    return list;
  }, [clients, statusFilter, managerFilter, sortBy, search]);

  const hasAnyClients = clients.length > 0;
  const filtersActive = statusFilter !== "Все" || managerFilter !== "Все" || search.trim() !== "";

  function resetFilters() {
    setStatusFilter("Все"); setManagerFilter("Все"); setSearch("");
  }

  return (
    <div className="cnb-screen">
      <TopBar
        title="CRM"
        subtitle={loading ? "Загрузка..." : `${clients.length} клиентов`}
      />

      <div className="cnb-crm-toolbar">
        <div className="cnb-search-box">
          <Search size={15} color="#7A7E88" />
          <input className="cnb-search-input" placeholder="Поиск по имени, телефону, email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="cnb-iconbtn" title="Сбросить демо-данные" onClick={() => setShowResetConfirm(true)}><RotateCcw size={16} /></button>
      </div>

      {!persistent && !loading && (
        <div className="cnb-banner-warning">
          <AlertTriangle size={14} />
          Хранилище недоступно — изменения сохранятся только до перезагрузки.
        </div>
      )}

      <div className="cnb-filter-row">
        {statusFilters.map((f) => (
          <button key={f} className={`cnb-filter-chip ${statusFilter === f ? "active" : ""}`} onClick={() => setStatusFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="cnb-field-row" style={{ marginBottom: 14 }}>
        <select className="cnb-input cnb-select cnb-select-compact" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
          <option value="Все">Все менеджеры</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="cnb-input cnb-select cnb-select-compact" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading && <ListSkeleton rows={5} />}

      {!loading && !hasAnyClients && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><Users size={26} /></div>
          <div className="cnb-empty-title">Пока нет ни одного клиента</div>
          <div className="cnb-empty-text">Добавьте первого клиента, чтобы начать вести сделки в CRM.</div>
          <button className="cnb-btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Добавить клиента</button>
        </div>
      )}

      {!loading && hasAnyClients && filtered.length === 0 && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><Search size={22} /></div>
          <div className="cnb-empty-title">Ничего не найдено</div>
          <div className="cnb-empty-text">Попробуйте изменить фильтры или поисковый запрос.</div>
          {filtersActive && <button className="cnb-btn-secondary" onClick={resetFilters}>Сбросить фильтры</button>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="cnb-list">
          {filtered.map((c) => (
            <Glass key={c.id} className="cnb-client-row" onClick={() => onOpenClient(c)}>
              <Avatar label={c.name[0]} color={c.color} />
              <div className="cnb-client-info">
                <div className="cnb-client-name">{c.name}</div>
                <div className="cnb-client-sub">{c.contact} • {formatRelative(c.lastContactAt)}</div>
              </div>
              <div className="cnb-client-right">
                <Pill color={STATUS_COLOR[c.status]}>{c.status}</Pill>
                <div className="cnb-client-value mono">{fmt(c.value)} ₸</div>
              </div>
            </Glass>
          ))}
        </div>
      )}

      {!loading && (
        <button className="cnb-fab" onClick={() => setShowForm(true)}><Plus size={22} /></button>
      )}

      <ClientFormModal
        open={showForm}
        initial={null}
        existingClients={clients}
        managers={managers}
        onClose={() => setShowForm(false)}
        onSubmit={(client) => { onCreateClient(client); setShowForm(false); }}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Сбросить CRM к демо-данным?"
        message="Все текущие клиенты, история и комментарии будут удалены и заменены демо-набором. Это действие необратимо."
        confirmLabel="Сбросить"
        onConfirm={() => { onResetDemo(); setShowResetConfirm(false); }}
        onCancel={() => setShowResetConfirm(false)}
      />

      <div style={{ height: 90 }} />
    </div>
  );
}

