import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import ListSkeleton from "../../components/ui/ListSkeleton";
import Glass from "../../components/ui/Glass";
import Avatar from "../../components/ui/Avatar";
import Pill from "../../components/ui/Pill";
import TopBar from "../../components/layout/TopBar";
import TeamFormModal from "./TeamFormModal";
import TeamMemberDetail from "./TeamMemberDetail";
import { loadTeam, persistTeamMember, persistTeamIndex, deleteTeamMember } from "../../storage/teamStorage";

export default function Team({ onBack }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items } = await loadTeam();
      if (!cancelled) { setTeam(items); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  function createMember(member) {
    setTeam((prev) => {
      const next = [member, ...prev];
      persistTeamMember(member);
      persistTeamIndex(next);
      return next;
    });
    setShowForm(false);
  }
  function updateMember(patch) {
    setTeam((prev) => {
      const next = prev.map((m) => (m.id === patch.id ? { ...m, ...patch } : m));
      const updated = next.find((m) => m.id === patch.id);
      if (updated) persistTeamMember(updated);
      return next;
    });
    setEditingMember(null);
    setSelectedMember((prev) => (prev && prev.id === patch.id ? { ...prev, ...patch } : prev));
  }
  function removeMember(member) {
    setTeam((prev) => {
      const next = prev.filter((m) => m.id !== member.id);
      persistTeamIndex(next);
      return next;
    });
    deleteTeamMember(member.id);
    setSelectedMember(null);
  }

  if (selectedMember) {
    return (
      <TeamMemberDetail
        member={selectedMember}
        onBack={() => setSelectedMember(null)}
        onEdit={(m) => setEditingMember(m)}
        onDelete={removeMember}
      />
    );
  }

  return (
    <div className="cnb-screen">
      <TopBar title="Команда" subtitle={`${team.length} сотрудников`} onBack={onBack} />

      {loading && <ListSkeleton rows={4} />}

      {!loading && team.length === 0 && (
        <div className="cnb-empty-state">
          <div className="cnb-empty-icon"><Plus size={22} /></div>
          <div className="cnb-empty-title">В команде пока никого нет</div>
          <div className="cnb-empty-text">Добавьте первого сотрудника.</div>
          <button className="cnb-btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Добавить сотрудника</button>
        </div>
      )}

      {!loading && team.length > 0 && (
        <div className="cnb-list">
          {team.map((m) => (
            <Glass key={m.id} className="cnb-client-row" onClick={() => setSelectedMember(m)}>
              <Avatar label={m.name[0]} color={m.color} />
              <div className="cnb-client-info">
                <div className="cnb-client-name">{m.name}</div>
                <div className="cnb-client-sub">{m.role} • {m.tasks} задач</div>
              </div>
              <div className="cnb-client-right">
                <Pill color={m.kpi > 90 ? "#17D896" : "#F2B84B"}>KPI {m.kpi}</Pill>
                <div className="cnb-client-value mono" title="Откройте профиль, чтобы посмотреть зарплату">•••• ₸</div>
              </div>
            </Glass>
          ))}
        </div>
      )}

      {!loading && <button className="cnb-fab" onClick={() => setShowForm(true)}><Plus size={22} /></button>}

      <TeamFormModal open={showForm} initial={null} onClose={() => setShowForm(false)} onSubmit={createMember} />
      <TeamFormModal open={!!editingMember} initial={editingMember} onClose={() => setEditingMember(null)} onSubmit={updateMember} />

      <div style={{ height: 90 }} />
    </div>
  );
}
