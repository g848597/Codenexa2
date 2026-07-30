import { useEffect, useMemo, useState } from "react";
import { Sparkles, Plus, Instagram, Send, Mail, Rocket, Trash2, Edit3 } from "lucide-react";
import ListSkeleton from "../../components/ui/ListSkeleton";
import Glass from "../../components/ui/Glass";
import Pill from "../../components/ui/Pill";
import TopBar from "../../components/layout/TopBar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ContentFormModal from "./ContentFormModal";
import { CONTENT_STATUSES } from "../../data/marketingData";
import { loadContentIdeas, persistContentIdea, persistContentIdeasIndex, deleteContentIdea } from "../../storage/marketingStorage";

const ICON_MAP = { instagram: Instagram, telegram: Send, email: Mail, reels: Rocket };
const STATUS_PILL_COLOR = { "Идея": "#9A9EA6", "В работе": "#F2B84B", "Опубликовано": "#17D896" };

export default function Marketing({ onBack }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Все");
  const [showForm, setShowForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [deletingIdea, setDeletingIdea] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items } = await loadContentIdeas();
      if (!cancelled) { setIdeas(items); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "Все") return ideas;
    return ideas.filter((i) => i.status === statusFilter);
  }, [ideas, statusFilter]);

  function createIdea(idea) {
    setIdeas((prev) => {
      const next = [idea, ...prev];
      persistContentIdea(idea);
      persistContentIdeasIndex(next);
      return next;
    });
    setShowForm(false);
  }
  function updateIdea(patch) {
    setIdeas((prev) => {
      const next = prev.map((i) => (i.id === patch.id ? { ...i, ...patch } : i));
      const updated = next.find((i) => i.id === patch.id);
      if (updated) persistContentIdea(updated);
      return next;
    });
    setEditingIdea(null);
  }
  function cycleStatus(idea) {
    const idx = CONTENT_STATUSES.indexOf(idea.status);
    const nextStatus = CONTENT_STATUSES[(idx + 1) % CONTENT_STATUSES.length];
    updateIdea({ ...idea, status: nextStatus });
  }
  function confirmDelete() {
    if (!deletingIdea) return;
    setIdeas((prev) => {
      const next = prev.filter((i) => i.id !== deletingIdea.id);
      persistContentIdeasIndex(next);
      return next;
    });
    deleteContentIdea(deletingIdea.id);
    setDeletingIdea(null);
  }

  const publishedShare = ideas.length ? Math.round((ideas.filter((i) => i.status === "Опубликовано").length / ideas.length) * 100) : 0;

  return (
    <div className="cnb-screen">
      <TopBar title="Маркетинг" subtitle="Идеи и контент-план" onBack={onBack} />

      <div className="cnb-filter-row">
        {["Все", ...CONTENT_STATUSES].map((s) => (
          <button key={s} className={`cnb-filter-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      {loading && <ListSkeleton rows={4} />}

      {!loading && filtered.length === 0 && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><Rocket size={22} /></div>
          <div className="cnb-empty-title">Пока нет идей</div>
          <div className="cnb-empty-text">Добавьте первую идею контента для соцсетей или рассылки.</div>
          <button className="cnb-btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Добавить идею</button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="cnb-list">
          {filtered.map((c) => {
            const Icon = ICON_MAP[c.iconKey] || Rocket;
            return (
              <Glass key={c.id} className="cnb-client-row">
                <div className="cnb-strip-icon" style={{ background: `${c.color}22`, color: c.color }}><Icon size={16} /></div>
                <div className="cnb-client-info" onClick={() => cycleStatus(c)} style={{ cursor: "pointer" }}>
                  <div className="cnb-client-name">{c.title}</div>
                  <div className="cnb-client-sub">{c.type}</div>
                </div>
                <Pill color={STATUS_PILL_COLOR[c.status]}>{c.status}</Pill>
                <button className="cnb-row-icon-btn" onClick={() => setEditingIdea(c)}><Edit3 size={14} /></button>
                <button className="cnb-row-icon-btn" onClick={() => setDeletingIdea(c)}><Trash2 size={14} /></button>
              </Glass>
            );
          })}
        </div>
      )}

      {!loading && (
        <Glass className="cnb-ai-hero" style={{ cursor: "default" }}>
          <div className="cnb-ai-glow" />
          <div className="cnb-ai-hero-top"><div className="cnb-ai-badge"><Sparkles size={13} /> Контент-план</div></div>
          <div className="cnb-ai-line"><span className="cnb-ai-dot" style={{ background: "#6E6AF6" }} />{publishedShare}% идей уже опубликовано — нажмите на идею, чтобы продвинуть её по статусам.</div>
        </Glass>
      )}

      {!loading && <button className="cnb-fab" onClick={() => setShowForm(true)}><Plus size={22} /></button>}

      <ContentFormModal open={showForm} initial={null} onClose={() => setShowForm(false)} onSubmit={createIdea} />
      <ContentFormModal open={!!editingIdea} initial={editingIdea} onClose={() => setEditingIdea(null)} onSubmit={updateIdea} />
      <ConfirmDialog
        open={!!deletingIdea}
        title={`Удалить идею «${deletingIdea?.title}»?`}
        message="Это действие необратимо."
        confirmLabel="Удалить"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingIdea(null)}
      />

      <div style={{ height: 90 }} />
    </div>
  );
}
