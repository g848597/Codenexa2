
export default function SectionTitle({ children, action }) {
  return (
    <div className="cnb-section-title">
      <span>{children}</span>
      {action}
    </div>
  );
}
