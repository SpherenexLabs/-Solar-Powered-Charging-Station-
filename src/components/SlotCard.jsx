import { fmtClock, fmtCountdown } from "../lib/solarConfig";
import { relayIsOn } from "../hooks/useSolarLive";

/* One AC charging slot (Slot 1 … Slot 4).
   Shows Available / Reserved / Occupied, the live relay state and the
   remaining time of the paid session. */

function SlotCard({ slot, relayValues, now, selected, onSelect, mine }) {
  const status = slot?.status || "available";
  const isAvailable = status === "available";
  const isReserved = status === "reserved";

  const remaining = slot?.endTime ? slot.endTime - now : 0;
  const startsIn = slot?.startTime ? slot.startTime - now : 0;

  const total = (slot?.durationMinutes || 0) * 60000;
  const progress = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;

  const statusText = isAvailable ? "Available" : isReserved ? "Reserved" : "Occupied";

  const sessionRelays = Array.isArray(slot?.relays) && slot.relays.length
    ? slot.relays
    : [slot?.relay].filter(Boolean);

  return (
    <div
      className={`slot-card ${isAvailable ? "available" : isReserved ? "reserved" : "occupied"} ${
        selected ? "selected" : ""
      }`}
    >
      <div className="slot-head">
        <div className="slot-id">
          <span className="slot-num">{slot?.name?.replace(/\D/g, "") || "-"}</span>
          <div>
            <h3>{slot?.name}</h3>
            <p>AC Supply · {sessionRelays.join(" + ")}</p>
          </div>
        </div>

        <span className="status-pill">{statusText}</span>
      </div>

      <div className="slot-relay-list">
        {sessionRelays.map((relay) => {
          const relayValue = relayValues[relay];
          const relayOn = relayIsOn(relayValue);
          const relayText = relayValue === null || relayValue === undefined
            ? "—"
            : String(relayValue);
          return (
            <div className="slot-relay" key={relay}>
              <span className={`relay-led ${relayOn ? "on" : "off"}`} />
              <span className="relay-text">
                {relay} = <strong>{relayText}</strong>
              </span>
              <span className="relay-state">{relayOn ? "Power ON" : "Power OFF"}</span>
            </div>
          );
        })}
      </div>

      {isAvailable ? (
        <div className="slot-empty">
          <p>Free right now — book this slot to switch its relay on.</p>
        </div>
      ) : (
        <>
          <div className="station-body">
            <div>
              <span>Booked By</span>
              <strong>{slot.bookedBy || "—"}</strong>
            </div>
            <div>
              <span>Charging Type</span>
              <strong>{slot.chargingOption || "—"}</strong>
            </div>
            <div>
              <span>Duration</span>
              <strong>{slot.duration || "—"}</strong>
            </div>
            <div>
              <span>Session</span>
              <strong>
                {fmtClock(slot.startTime)} – {fmtClock(slot.endTime)}
              </strong>
            </div>
          </div>

          <div className="slot-timer">
            <div className="slot-timer-top">
              <span>{isReserved ? "Starts in" : "Time remaining"}</span>
              <strong>{fmtCountdown(isReserved ? startsIn : remaining)}</strong>
            </div>
            <div className="slot-progress">
              <div style={{ width: `${isReserved ? 0 : progress}%` }} />
            </div>
          </div>
        </>
      )}

      <button disabled={!isAvailable} onClick={() => onSelect(slot.id)}>
        {isAvailable
          ? selected
            ? "Slot Selected ✓"
            : `Select ${slot?.name}`
          : mine
          ? "Your Active Session"
          : "Slot Occupied"}
      </button>
    </div>
  );
}

export default SlotCard;
