
export default function Glass({ className = "", style = {}, children, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`cnb-glass ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
