function LiveDataCard({ title, value, unit, icon }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{icon || "⚡"}</span>
        <p>{title}</p>
      </div>

      <h2>
        {value ?? 0}
        <small>{unit}</small>
      </h2>
    </div>
  );
}

export default LiveDataCard;