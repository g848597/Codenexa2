import { useState, useEffect } from "react";
import useFonts from "./utils/fonts";
import { useTelegramWebApp } from "./utils/telegram";
import "./styles/globals.css";

// Data & helpers
import { genId } from "./utils/helpers";
import { MANAGERS } from "./data/teamData";
import { SEED_CLIENTS } from "./data/seedClients";
import { SEED_PROJECTS } from "./data/seedProjects";

// Persistence
import {
  loadClientsFromStorage, persistClient, persistClientsIndex, deleteClientFromStorage,
} from "./storage/clientsStorage";
import {
  loadProjectsFromStorage, persistProject, persistProjectsIndex, deleteProjectFromStorage,
} from "./storage/projectsStorage";
import {
  loadNotifications, persistNotification, persistNotificationsIndex,
} from "./storage/notificationsStorage";
import { loadCompanySettings } from "./storage/settingsStorage";

// Layout
import BottomNav from "./components/layout/BottomNav";

// Features
import Dashboard from "./features/dashboard/Dashboard";
import AIDirector from "./features/ai/AIDirector";
import CRM from "./features/crm/CRM";
import ClientDetail from "./features/crm/ClientDetail";
import Projects from "./features/projects/Projects";
import ProjectDetail from "./features/projects/ProjectDetail";
import Finance from "./features/finance/Finance";
import Tasks from "./features/tasks/Tasks";
import Sales from "./features/sales/Sales";
import Marketing from "./features/marketing/Marketing";
import Team from "./features/team/Team";
import Analytics from "./features/analytics/Analytics";
import Notifications from "./features/notifications/Notifications";
import Settings from "./features/settings/Settings";
import Profile from "./features/settings/Profile";
import Subscription from "./features/settings/Subscription";
import MoreGrid from "./features/more/MoreGrid";

/**
 * Root application component. Owns navigation (tab / subScreen) and the
 * top-level CRM / Projects state, which is loaded from and persisted to
 * window.storage. Renders exactly one screen at a time, plus the
 * bottom tab bar.
 */
export default function CodeNexaBusiness() {
  useFonts();
  useTelegramWebApp();

  /* ---- Appearance: theme + brand accent, applied to the root node ---- */
  const [appearance, setAppearance] = useState({ theme: "dark", brandAccent: "#6E6AF6" });
  useEffect(() => {
    (async () => {
      const s = await loadCompanySettings();
      setAppearance({ theme: s.theme, brandAccent: s.brandAccent });
    })();
    // Settings.jsx persists changes directly to storage and dispatches this
    // event so appearance updates without a full reload / prop-drilling.
    const onAppearanceChanged = async () => {
      const s = await loadCompanySettings();
      setAppearance({ theme: s.theme, brandAccent: s.brandAccent });
    };
    window.addEventListener("cnb:appearance-changed", onAppearanceChanged);
    return () => window.removeEventListener("cnb:appearance-changed", onAppearanceChanged);
  }, []);
  const [tab, setTab] = useState("dashboard");
  const [subScreen, setSubScreen] = useState(null); // for CRM/Project detail, or More sub-pages
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  /* ---- CRM state, backed by persistent storage ---- */
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsPersistent, setClientsPersistent] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { clients: loaded, persistent } = await loadClientsFromStorage();
      if (cancelled) return;
      setClients(loaded);
      setClientsPersistent(persistent);
      setClientsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- Projects state, backed by persistent storage ---- */
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsPersistent, setProjectsPersistent] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { projects: loaded, persistent } = await loadProjectsFromStorage();
      if (cancelled) return;
      setProjects(loaded);
      setProjectsPersistent(persistent);
      setProjectsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  function handleCreateProject(projectObj) {
    setProjects((prev) => {
      const next = [projectObj, ...prev];
      persistProject(projectObj);
      persistProjectsIndex(next);
      return next;
    });
  }

  function handleUpdateProject(id, patch) {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) persistProject(updated);
      return next;
    });
    setSelectedProject((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  function handleDeleteProject(id) {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistProjectsIndex(next);
      return next;
    });
    deleteProjectFromStorage(id);
    setSelectedProject((prev) => (prev && prev.id === id ? null : prev));
  }

  function handleLogProjectActivity(id, kind, text, color) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const entry = { id: genId("a"), kind, text, at: new Date().toISOString(), color };
    handleUpdateProject(id, { activity: [entry, ...(project.activity || [])] });
  }

  function handleAddProjectDocument(id, name) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const doc = { id: genId("d"), name, at: new Date().toISOString() };
    handleUpdateProject(id, { documents: [doc, ...(project.documents || [])] });
  }

  function handleAddProjectTransaction(id, type, amount, note) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const tx = { id: genId("tx"), type, amount, note, at: new Date().toISOString() };
    handleUpdateProject(id, { transactions: [tx, ...(project.transactions || [])] });
  }

  async function handleResetProjectsDemo() {
    setProjectsLoading(true);
    await Promise.all(projects.map((p) => deleteProjectFromStorage(p.id)));
    const seeded = SEED_PROJECTS;
    setProjects(seeded);
    setSelectedProject(null);
    await Promise.all(seeded.map((p) => persistProject(p)));
    await persistProjectsIndex(seeded);
    setProjectsPersistent(true);
    setProjectsLoading(false);
  }

  function handleCreateClient(clientObj) {
    setClients((prev) => {
      const next = [clientObj, ...prev];
      persistClient(clientObj);
      persistClientsIndex(next);
      return next;
    });
  }

  function handleUpdateClient(id, patch) {
    setClients((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      const updated = next.find((c) => c.id === id);
      if (updated) persistClient(updated);
      return next;
    });
    setSelectedClient((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  function handleDeleteClient(id) {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistClientsIndex(next);
      return next;
    });
    deleteClientFromStorage(id);
    setSelectedClient((prev) => (prev && prev.id === id ? null : prev));
  }

  function handleLogActivity(id, kind, text, color) {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const entry = { id: genId("a"), kind, text, at: new Date().toISOString(), color };
    const patch = { activity: [entry, ...(client.activity || [])] };
    if (kind === "history") patch.lastContactAt = entry.at;
    handleUpdateClient(id, patch);
  }

  function handleAddDocument(id, name) {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const doc = { id: genId("d"), name, at: new Date().toISOString() };
    handleUpdateClient(id, { documents: [doc, ...(client.documents || [])] });
  }

  async function handleResetDemo() {
    setClientsLoading(true);
    await Promise.all(clients.map((c) => deleteClientFromStorage(c.id)));
    const seeded = SEED_CLIENTS;
    setClients(seeded);
    setSelectedClient(null);
    await Promise.all(seeded.map((c) => persistClient(c)));
    await persistClientsIndex(seeded);
    setClientsPersistent(true);
    setClientsLoading(false);
  }

  /* ---- Notifications state, backed by persistent storage ---- */
  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items } = await loadNotifications();
      if (!cancelled) setNotifications(items);
    })();
    return () => { cancelled = true; };
  }, []);
  const unreadCount = notifications.filter((n) => !n.read).length;

  function markNotificationRead(id) {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      const updated = next.find((n) => n.id === id);
      if (updated) persistNotification(updated);
      return next;
    });
  }
  function markAllNotificationsRead() {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      Promise.all(next.map((n) => persistNotification(n)));
      return next;
    });
  }

  function nav(target, payload) {
    if (target === "crm" && payload) { setSelectedClient(payload); setTab("crm"); setSubScreen("clientDetail"); return; }
    if (target === "projects" && payload) { setSelectedProject(payload); setTab("projects"); setSubScreen("projectDetail"); return; }
    setSubScreen(null);
    setTab(target);
  }

  function openClient(c) { setSelectedClient(c); setSubScreen("clientDetail"); }
  function openProject(p) { setSelectedProject(p); setSubScreen("projectDetail"); }
  function backFromSub() { setSubScreen(null); }

  function renderMain() {
    if (tab === "crm" && subScreen === "clientDetail") {
      return (
        <ClientDetail
          client={selectedClient}
          managers={MANAGERS}
          allClients={clients}
          onBack={backFromSub}
          onUpdate={(patch) => handleUpdateClient(selectedClient.id, patch)}
          onDelete={() => { handleDeleteClient(selectedClient.id); backFromSub(); }}
          onLogActivity={(kind, text, color) => handleLogActivity(selectedClient.id, kind, text, color)}
          onAddDocument={(name) => handleAddDocument(selectedClient.id, name)}
          onAddComment={(text) => handleLogActivity(selectedClient.id, "comment", text, null)}
        />
      );
    }
    if (tab === "projects" && subScreen === "projectDetail") {
      return (
        <ProjectDetail
          project={selectedProject}
          managers={MANAGERS}
          onBack={backFromSub}
          onUpdate={(patch) => handleUpdateProject(selectedProject.id, patch)}
          onDelete={() => { handleDeleteProject(selectedProject.id); backFromSub(); }}
          onLogActivity={(kind, text, color) => handleLogProjectActivity(selectedProject.id, kind, text, color)}
          onAddDocument={(name) => handleAddProjectDocument(selectedProject.id, name)}
          onAddComment={(text) => handleLogProjectActivity(selectedProject.id, "comment", text, null)}
          onAddTransaction={(type, amount, note) => handleAddProjectTransaction(selectedProject.id, type, amount, note)}
        />
      );
    }
    if (tab === "more" && subScreen) {
      const map = {
        tasks: <Tasks onBack={backFromSub} projects={projects} />,
        sales: <Sales onBack={backFromSub} clients={clients} onOpenClient={openClient} />,
        marketing: <Marketing onBack={backFromSub} />,
        team: <Team onBack={backFromSub} />,
        analytics: <Analytics onBack={backFromSub} projects={projects} />,
        notifications: <Notifications onBack={backFromSub} notifications={notifications} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} />,
        settings: <Settings onBack={backFromSub} nav={nav} />,
        profile: <Profile onBack={backFromSub} clientsCount={clients.length} projectsCount={projects.length} />,
        subscription: <Subscription onBack={backFromSub} />,
      };
      return map[subScreen] || null;
    }

    switch (tab) {
      case "dashboard": return <Dashboard nav={nav} openNotifications={() => { setTab("more"); setSubScreen("notifications"); }} projects={projects} clients={clients} unreadCount={unreadCount} />;
      case "ai": return <AIDirector clients={clients} projects={projects} />;
      case "crm": return (
        <CRM
          clients={clients}
          loading={clientsLoading}
          persistent={clientsPersistent}
          managers={MANAGERS}
          onOpenClient={openClient}
          onCreateClient={handleCreateClient}
          onResetDemo={handleResetDemo}
        />
      );
      case "projects": return (
        <Projects
          projects={projects}
          loading={projectsLoading}
          persistent={projectsPersistent}
          managers={MANAGERS}
          openProject={openProject}
          onCreateProject={handleCreateProject}
          onResetDemo={handleResetProjectsDemo}
        />
      );
      case "finance": return <Finance projects={projects} clients={clients} />;
      case "more": return <MoreGrid nav={(k) => setSubScreen(k)} />;
      default: return null;
    }
  }

  return (
    <div className="cnb-root" data-theme={appearance.theme} style={{ "--violet": appearance.brandAccent }}>
      <div className="cnb-phone">
        {renderMain()}
        <BottomNav active={tab} setTab={(t) => { setSubScreen(null); setTab(t); }} />
      </div>
    </div>
  );
}
