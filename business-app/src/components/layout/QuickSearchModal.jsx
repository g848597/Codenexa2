import { useMemo, useState, useEffect, useRef } from "react";
import { Search, X, Users, FolderKanban } from "lucide-react";
import Glass from "../ui/Glass";
import Pill from "../ui/Pill";
import { STATUS_COLOR, PROJECT_STATUS_COLOR } from "../../data/statusConstants";
import { fmt } from "../../utils/helpers";

export default function QuickSearchModal({ open, onClose, clients, projects, onOpenClient, onOpenProject }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { clients: [], projects: [] };
    const matchedClients = (clients || []).filter((c) =>
      c.name.toLowerCase().includes(term) ||
      (c.contact || "").toLowerCase().includes(term) ||
      (c.phone || "").toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term)
    ).slice(0, 6);
    const matchedProjects = (projects || []).filter((p) =>
      p.name.toLowerCase().includes(term) || (p.client || "").toLowerCase().includes(term)
    ).slice(0, 6);
    return { clients: matchedClients, projects: matchedProjects };
  }, [q, clients, projects]);

  if (!open) return null;
  const term = q.trim();
  const hasResults = results.clients.length > 0 || results.projects.length > 0;

  return (
    <div className="cnb-modal-overlay" onClick={onClose}>
      <Glass className="cnb-modal-card" style={{ maxHeight: "78vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="cnb-modal-head">
          <div className="cnb-search-box" style={{ flex: 1, marginRight: 8 }}>
            <Search size={15} color="#7A7E88" />
            <input
              ref={inputRef}
              className="cnb-search-input"
              placeholder="Поиск по клиентам и проектам"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="cnb-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="cnb-modal-body" style={{ overflowY: "auto" }}>
          {!term && <div className="cnb-empty-inline">Начните вводить название компании или проекта.</div>}
          {term && !hasResults && <div className="cnb-empty-inline">Ничего не найдено по запросу «{term}».</div>}

          {results.clients.length > 0 && (
            <>
              <div className="cnb-search-group-label"><Users size={12} /> Клиенты</div>
              {results.clients.map((c) => (
                <Glass key={c.id} className="cnb-client-row" onClick={() => onOpenClient(c)}>
                  <div className="cnb-client-info">
                    <div className="cnb-client-name">{c.name}</div>
                    <div className="cnb-client-sub">{c.contact}</div>
                  </div>
                  <Pill color={STATUS_COLOR[c.status]}>{c.status}</Pill>
                </Glass>
              ))}
            </>
          )}

          {results.projects.length > 0 && (
            <>
              <div className="cnb-search-group-label"><FolderKanban size={12} /> Проекты</div>
              {results.projects.map((p) => (
                <Glass key={p.id} className="cnb-client-row" onClick={() => onOpenProject(p)}>
                  <div className="cnb-client-info">
                    <div className="cnb-client-name">{p.name}</div>
                    <div className="cnb-client-sub">{p.client}</div>
                  </div>
                  <Pill color={PROJECT_STATUS_COLOR[p.status]}>{p.status}</Pill>
                  <div className="cnb-client-value mono">{fmt(p.budget)} ₸</div>
                </Glass>
              ))}
            </>
          )}
        </div>
      </Glass>
    </div>
  );
}
