export default function ListSkeleton({ rows = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cnb-skel-row cnb-glass">
          <div className="cnb-skel cnb-skel-avatar" />
          <div className="cnb-skel-lines">
            <div className="cnb-skel cnb-skel-line" style={{ width: "55%" }} />
            <div className="cnb-skel cnb-skel-line" style={{ width: "35%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
