import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Glass from "../../components/ui/Glass";
import TopBar from "../../components/layout/TopBar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { PLANS } from "../../data/plansData";
import { loadCompanySettings, saveCompanySettings } from "../../storage/settingsStorage";

export default function Subscription({ onBack }) {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await loadCompanySettings();
      setCurrentPlan(s.plan);
    })();
  }, []);

  async function confirmChange() {
    if (!pendingPlan) return;
    const s = await loadCompanySettings();
    const next = { ...s, plan: pendingPlan.name };
    await saveCompanySettings(next);
    setCurrentPlan(pendingPlan.name);
    setPendingPlan(null);
  }

  return (
    <div className="cnb-screen">
      <TopBar title="Подписка" subtitle={currentPlan ? `Текущий план: ${currentPlan}` : "CodeNexa Business"} onBack={onBack} />
      <div className="cnb-plans">
        {PLANS.map((p) => {
          const isCurrent = p.name === currentPlan;
          return (
            <Glass key={p.name} className={`cnb-plan-card ${isCurrent ? "cnb-plan-current" : ""}`} style={{ borderColor: `${p.accent}44` }}>
              {isCurrent && <div className="cnb-plan-badge" style={{ background: p.accent }}>Текущий</div>}
              <div className="cnb-plan-name" style={{ color: p.accent }}>{p.name}</div>
              <div className="cnb-plan-price mono">{p.price}</div>
              <div className="cnb-plan-features">
                {p.features.map((f) => <div key={f} className="cnb-plan-feature"><CheckCircle2 size={13} color={p.accent} /> {f}</div>)}
              </div>
              {!isCurrent && (
                <button
                  className="cnb-plan-btn"
                  style={{ background: `${p.accent}22`, color: p.accent, borderColor: `${p.accent}55` }}
                  onClick={() => setPendingPlan(p)}
                >
                  Выбрать
                </button>
              )}
            </Glass>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!pendingPlan}
        danger={false}
        title={`Перейти на план «${pendingPlan?.name}»?`}
        message={pendingPlan ? `Новая стоимость: ${pendingPlan.price}. Изменения вступят в силу немедленно.` : ""}
        confirmLabel="Подтвердить переход"
        onConfirm={confirmChange}
        onCancel={() => setPendingPlan(null)}
      />

      <div style={{ height: 40 }} />
    </div>
  );
}
