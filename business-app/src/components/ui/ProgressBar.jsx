
export default function ProgressBar({ value, color = "#6E6AF6" }) {
  return (
    <div className="cnb-progress-track">
      <div
        className="cnb-progress-fill"
        style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
      />
    </div>
  );
}
