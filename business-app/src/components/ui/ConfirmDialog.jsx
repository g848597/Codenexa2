import { AlertTriangle } from "lucide-react";
import Glass from "./Glass";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Удалить", danger = true, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="cnb-modal-overlay" onClick={onCancel}>
      <Glass className="cnb-modal-card cnb-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="cnb-confirm-icon" style={{ background: danger ? "rgba(255,92,92,0.15)" : "rgba(110,106,246,0.15)", color: danger ? "#FF5C5C" : "#6E6AF6" }}>
          <AlertTriangle size={20} />
        </div>
        <div className="cnb-confirm-title">{title}</div>
        <div className="cnb-confirm-message">{message}</div>
        <div className="cnb-modal-actions">
          <button className="cnb-btn-secondary" onClick={onCancel}>Отмена</button>
          <button className={danger ? "cnb-btn-danger" : "cnb-btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </Glass>
    </div>
  );
}

