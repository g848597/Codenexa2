
export default function Pill({ children, color = "#9A9EA6", subtle = true }) {
  return (
    <span
      className="cnb-pill"
      style={{
        color: color,
        background: subtle ? `${color}1A` : color,
        borderColor: `${color}33`,
      }}
    >
      {children}
    </span>
  );
}
