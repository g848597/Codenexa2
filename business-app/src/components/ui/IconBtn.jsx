
export default function IconBtn({ icon: Icon, onClick, active = false, size = 18 }) {
  return (
    <button onClick={onClick} className="cnb-iconbtn" style={active ? { background: "rgba(255,255,255,0.10)" } : {}}>
      <Icon size={size} strokeWidth={1.8} />
    </button>
  );
}
