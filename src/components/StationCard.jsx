function StationCard({ stationName, data, onSelect }) {
  const isAvailable = data?.status === "available";

  return (
    <div className={`new-station-card ${isAvailable ? "available" : "occupied"}`}>
      <div className="station-head">
        <div>
          <h3>{stationName}</h3>
          <p>{isAvailable ? "Ready for charging" : "Currently in use"}</p>
        </div>

        <span className="status-pill">
          {isAvailable ? "Available" : "Occupied"}
        </span>
      </div>

      <div className="station-body">
        <div>
          <span>Selected By</span>
          <strong>{data?.selectedBy || "None"}</strong>
        </div>

        <div>
          <span>Charging Type</span>
          <strong>{data?.chargingOption || "Not selected"}</strong>
        </div>

        <div>
          <span>Duration</span>
          <strong>{data?.duration || "Not selected"}</strong>
        </div>
      </div>

      <button disabled={!isAvailable} onClick={() => onSelect(stationName)}>
        {isAvailable ? "Select This Station" : "Station Busy"}
      </button>
    </div>
  );
}

export default StationCard;