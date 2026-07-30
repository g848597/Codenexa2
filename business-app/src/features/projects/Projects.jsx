import { useState, useMemo } from "react";
import { FolderKanban, Search, Plus, AlertTriangle, RotateCcw } from "lucide-react";
import ListSkeleton from "../../components/ui/ListSkeleton";
import Glass from "../../components/ui/Glass";
import Avatar from "../../components/ui/Avatar";
import ProgressBar from "../../components/ui/ProgressBar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import TopBar from "../../components/layout/TopBar";
import ProjectFormModal from "./ProjectFormModal";
import { PROJECT_STATUS_LIST } from "../../data/statusConstants";
import { fmt, formatDeadline, deadlineTone } from "../../utils/helpers";

const PROJECT_SORT_OPTIONS = [
  { key: "deadline", label: "Ближайший срок" },
  { key: "budget_desc", label: "Бюджет ↓" },
  { key: "progress_desc", label: "Прогресс ↓" },
  { key: "alpha", label: "По алфавиту" },
];

export default function Projects({ projects, loading, persistent, managers, openProject, onCreateProject, onResetDemo }) {
  const [statusFilter, setStatusFilter] = useState("Все");
  const [managerFilter, setManagerFilter] = useState("Все");
  const [sortBy, setSortBy] = useState("deadline");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const statusFilters = ["Все", ...PROJECT_STATUS_LIST];

  const filtered = useMemo(() => {
    let list = projects.slice();
    if (statusFilter !== "Все") list = list.filter((p) => p.status === statusFilter);
    if (managerFilter !== "Все") list = list.filter((p) => p.manager === managerFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q));
    if (sortBy === "budget_desc") list.sort((a, b) => b.budget - a.budget);
    else if (sortBy === "progress_desc") list.sort((a, b) => b.progress - a.progress);
    else if (sortBy === "alpha") list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    else list.sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));
    return list;
  }, [projects, statusFilter, managerFilter, sortBy, search]);

  const hasAny = projects.length > 0;
  const filtersActive = statusFilter !== "Все" || managerFilter !== "Все" || search.trim() !== "";
  function resetFilters() { setStatusFilter("Все"); setManagerFilter("Все"); setSearch(""); }

  return (
    <div className="cnb-screen">
      <TopBar title="Проекты" subtitle={loading ? "Загрузка..." : `${projects.length} рабочих пространств`} />

      <div className="cnb-crm-toolbar">
        <div className="cnb-search-box">
          <Search size={15} color="#7A7E88" />
          <input className="cnb-search-input" placeholder="Поиск по названию или клиенту" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <button key={f} className={`cnb-filter-chip ${statusFilter === f ? "active" : ""}`} onClick={() => setStatusFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="cnb-field-row" style={{ marginBottom: 14 }}>
        <select className="cnb-input cnb-select cnb-select-compact" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
          <option value="Все">Все ответственные</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="cnb-input cnb-select cnb-select-compact" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {PROJECT_SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading && (
        <ListSkeleton rows={5} />
      )}

      {!loading && !hasAny && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><FolderKanban size={26} /></div>
          <div className="cnb-empty-title">Пока нет ни одного проекта</div>
          <div className="cnb-empty-text">Создайте первый проект, чтобы начать отслеживать бюджет и сроки.</div>
          <button className="cnb-btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Создать проект</button>
        </div>
      )}

      {!loading && hasAny && filtered.length === 0 && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><Search size={22} /></div>
          <div className="cnb-empty-title">Ничего не найдено</div>
          <div className="cnb-empty-text">Попробуйте изменить фильтры или поисковый запрос.</div>
          {filtersActive && <button className="cnb-btn-secondary" onClick={resetFilters}>Сбросить фильтры</button>}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="cnb-list">
          {filtered.map((p) => {
            const tone = deadlineTone(p.deadline, p.status);
            return (
              <Glass key={p.id} className="cnb-project-row" onClick={() => openProject(p)}>
                <div className="cnb-project-row-top">
                  <div className="cnb-dot" style={{ background: p.color, width: 10, height: 10 }} />
                  <div className="cnb-project-row-name">{p.name}</div>
                  <span className="cnb-project-row-pct mono">{p.progress}%</span>
                </div>
                <div className="cnb-project-row-client">
                  {p.client} • <span className="cnb-project-row-deadline" style={{ color: tone }}>до {formatDeadline(p.deadline)}</span>
                </div>
                <ProgressBar value={p.progress} color={p.color} />
                <div className="cnb-project-row-bottom">
                  <div className="cnb-team-stack">
                    {(p.team || []).map((t, i) => <Avatar key={i} label={t} color={p.color} size={24} />)}
                  </div>
                  <div className="cnb-project-row-budget mono">{fmt(p.budget)} ₸</div>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {!loading && <button className="cnb-fab" onClick={() => setShowForm(true)}><Plus size={22} /></button>}

      <ProjectFormModal
        open={showForm}
        initial={null}
        managers={managers}
        onClose={() => setShowForm(false)}
        onSubmit={(project) => { onCreateProject(project); setShowForm(false); }}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Сбросить проекты к демо-данным?"
        message="Все текущие проекты, финансы, документы и чаты будут удалены и заменены демо-набором. Это действие необратимо."
        confirmLabel="Сбросить"
        onConfirm={() => { onResetDemo(); setShowResetConfirm(false); }}
        onCancel={() => setShowResetConfirm(false)}
      />

      <div style={{ height: 90 }} />
    </div>
  );
}

