
export default function Avatar({ label, color = "#6E6AF6", size = 40 }) {
  return (
    <div
      className="cnb-avatar"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${color}55, ${color}22)`,
        borderColor: `${color}55`, color: "#fff",
      }}
    >
      {label}
    </div>
  );
}
