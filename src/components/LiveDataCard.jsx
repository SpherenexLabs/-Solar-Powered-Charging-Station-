function LiveDataCard({ title, value, unit, icon }) {
  /* Nothing published by the hardware yet → show a dash, never a fake 0 */
  const missing = value === null || value === undefined || value === "";

  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{icon || "⚡"}</span>
        <p>{title}</p>
      </div>

      <h2>
        {missing ? <span className="metric-empty">—</span> : value}
        {!missing && unit && <small>{unit}</small>}
      </h2>
    </div>
  );
}

export default LiveDataCard;
