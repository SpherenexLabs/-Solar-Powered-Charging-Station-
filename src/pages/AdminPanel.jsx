import { useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "../firebase";
import LiveDataCard from "../components/LiveDataCard";
import EnergyChart from "../components/EnergyChart";
import useSolarLive, { relayIsOn } from "../hooks/useSolarLive";
import useSlots from "../hooks/useSlots";
import useDcSessions from "../hooks/useDcSessions";
import { fmtClock, fmtCountdown } from "../lib/solarConfig";
import jsPDF from "jspdf";

function AdminPanel() {
  const live = useSolarLive();
  const { slots, now, releaseSlot } = useSlots();
  const { sessions, activeSessions, endSession } = useDcSessions();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const off = onValue(ref(db, "Solar_Power_System/Transactions"), (snapshot) => {
      if (!snapshot.exists()) {
        setTransactions([]);
        return;
      }

      const data = snapshot.val();
      const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
      setTransactions(list.reverse());
    });

    return () => off();
  }, []);

  const slotList = Object.values(slots);
  const relayValues = {
    Relay1: live.relay1,
    Relay2: live.relay2,
    Relay3: live.relay3,
    Relay4: live.relay4
  };

  const occupied = slotList.filter((s) => s.status !== "available").length;
  const revenue = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  /* Manual relay override — useful for testing the hardware */
  const toggleRelay = async (relay, value) => {
    await set(ref(db, `Solar_Power_System/${relay}`), value);
  };

  const downloadCSV = () => {
    const headers = [
      "Txn ID",
      "Name",
      "Phone",
      "Supply",
      "Slot",
      "Relay",
      "Charging Option",
      "Duration",
      "Start",
      "End",
      "Amount",
      "Payment Status",
      "Payment Method",
      "Session",
      "Voltage",
      "Current",
      "Power",
      "Battery",
      "Date",
      "Time"
    ];

    const rows = transactions.map((item) => [
      item.txnId,
      item.name,
      item.phone,
      item.supply,
      item.slotName || item.slot,
      item.relay,
      item.chargingOption,
      item.duration,
      fmtClock(item.startTime),
      fmtClock(item.endTime),
      item.amount,
      item.paymentStatus,
      item.paymentMethod,
      item.sessionStatus,
      item.voltage,
      item.current,
      item.power,
      item.battery,
      item.date,
      item.time
    ]);

    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const csvContent =
      headers.join(",") +
      "\n" +
      rows.map((row) => row.map(escape).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "solar_station_report.csv";
    link.click();
  };

  const downloadPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Solar Charging Station Report", 20, 20);

    doc.setFontSize(10);
    doc.text(`Total bookings: ${transactions.length}   Total collected: Rs.${revenue}`, 20, 28);

    let y = 40;

    transactions.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.name} | ${item.supply || "AC"} | ${
          item.slotName || item.slot || "-"
        } | ${item.duration} | Rs.${item.amount} | ${item.paymentMethod || "-"} | ${
          item.sessionStatus || item.paymentStatus
        }`,
        20,
        y
      );

      y += 8;

      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("solar_station_report.pdf");
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <span className="section-label">Admin Dashboard</span>
          <h1>Station Monitoring Panel</h1>
          <p>
            Live solar data, slot occupancy, relay states, DC sessions, payments and
            reports.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <LiveDataCard title="Voltage" value={live.voltage} unit="V" icon="⚡" />
        <LiveDataCard title="Current" value={live.current} unit="A" icon="🔌" />
        <LiveDataCard title="Power" value={live.power} unit="W" icon="💡" />
        <LiveDataCard title="Battery" value={live.battery} unit="%" icon="🔋" />
        <LiveDataCard title="Temperature" value={live.temperature} unit="°C" icon="🌡️" />
      </div>

      <div className="metric-grid">
        <LiveDataCard title="Slots Occupied" value={`${occupied}/4`} unit="" icon="🅿️" />
        <LiveDataCard title="DC Sessions" value={activeSessions.length} unit="live" icon="⚡" />
        <LiveDataCard title="Bookings" value={transactions.length} unit="" icon="🧾" />
        <LiveDataCard title="Collected" value={`₹${revenue}`} unit="" icon="💰" />
      </div>

      <EnergyChart live={live} />

      {/* ── AC slots ── */}
      <h2>AC Slot Monitoring (Relay 1 – Relay 4)</h2>

      <div className="station-grid">
        {slotList.map((slot) => {
          const relayValue = relayValues[slot.relay];
          const relayOn = relayIsOn(relayValue);
          const relayText =
            relayValue === null || relayValue === undefined ? "—" : String(relayValue);
          const available = slot.status === "available";

          return (
            <div
              key={slot.id}
              className={`slot-card ${
                available ? "available" : slot.status === "reserved" ? "reserved" : "occupied"
              }`}
            >
              <div className="slot-head">
                <div className="slot-id">
                  <span className="slot-num">{slot.name.replace(/\D/g, "")}</span>
                  <div>
                    <h3>{slot.name}</h3>
                    <p>AC Supply · {slot.relay}</p>
                  </div>
                </div>
                <span className="status-pill">
                  {available ? "Available" : slot.status === "reserved" ? "Reserved" : "Occupied"}
                </span>
              </div>

              <div className="slot-relay">
                <span className={`relay-led ${relayOn ? "on" : "off"}`} />
                <span className="relay-text">
                  {slot.relay} = <strong>{relayText}</strong>
                </span>
                <span className="relay-state">{relayOn ? "Power ON" : "Power OFF"}</span>
              </div>

              <div className="station-body">
                <div>
                  <span>User</span>
                  <strong>{slot.bookedBy || "None"}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{slot.phone || "None"}</strong>
                </div>
                <div>
                  <span>Option</span>
                  <strong>{slot.chargingOption || "None"}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{slot.duration || "None"}</strong>
                </div>
                <div>
                  <span>Session</span>
                  <strong>
                    {slot.startTime ? `${fmtClock(slot.startTime)} – ${fmtClock(slot.endTime)}` : "None"}
                  </strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>{slot.paymentMethod || "None"}</strong>
                </div>
              </div>

              {!available && (
                <div className="slot-timer">
                  <div className="slot-timer-top">
                    <span>{slot.status === "reserved" ? "Starts in" : "Time remaining"}</span>
                    <strong>
                      {fmtCountdown(
                        slot.status === "reserved" ? slot.startTime - now : slot.endTime - now
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <div className="admin-slot-actions">
                <button onClick={() => releaseSlot(slot.id, "Released by admin")} disabled={available}>
                  Free Slot &amp; Relay OFF
                </button>
                <button
                  className="ghost"
                  onClick={() => toggleRelay(slot.relay, relayOn ? 0 : 1)}
                >
                  Force {slot.relay} {relayOn ? "OFF" : "ON"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DC sessions ── */}
      <h2>DC Fast Charging (Always Available)</h2>

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Phone</th>
              <th>Option</th>
              <th>Duration</th>
              <th>Start</th>
              <th>End</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions
              .slice()
              .reverse()
              .map((s) => (
                <tr key={s.key}>
                  <td>{s.name}</td>
                  <td>{s.phone}</td>
                  <td>{s.chargingOption}</td>
                  <td>{s.duration}</td>
                  <td>{fmtClock(s.startTime)}</td>
                  <td>{fmtClock(s.endTime)}</td>
                  <td>₹{s.amount}</td>
                  <td>
                    {s.status === "Charging" && s.endTime > now
                      ? `Charging · ${fmtCountdown(s.endTime - now)}`
                      : "Completed"}
                  </td>
                  <td>
                    <button
                      className="mini-btn"
                      disabled={s.status !== "Charging"}
                      onClick={() => endSession(s.key)}
                    >
                      Stop
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {sessions.length === 0 && <p className="empty-text">No DC sessions yet.</p>}
      </div>

      <div className="report-buttons">
        <button onClick={downloadCSV}>Download CSV Report</button>
        <button onClick={downloadPDF}>Download PDF Report</button>
      </div>

      <h2>User Transactions</h2>

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Supply</th>
              <th>Slot</th>
              <th>Option</th>
              <th>Duration</th>
              <th>Session</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td>{item.txnId || "—"}</td>
                <td>{item.name}</td>
                <td>{item.phone}</td>
                <td>
                  <span className={`ms-tag ${item.supply === "DC" ? "dc" : "ac"}`}>
                    {item.supply || "AC"}
                  </span>
                </td>
                <td>{item.slotName || item.slot || item.station || "—"}</td>
                <td>{item.chargingOption}</td>
                <td>{item.duration}</td>
                <td>
                  {item.startTime
                    ? `${fmtClock(item.startTime)} – ${fmtClock(item.endTime)}`
                    : item.timeSlot || "—"}
                </td>
                <td>₹{item.amount}</td>
                <td>{item.paymentMethod || "—"}</td>
                <td>{item.sessionStatus || item.paymentStatus}</td>
                <td>{item.date}</td>
                <td>{item.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {transactions.length === 0 && <p className="empty-text">No transactions found.</p>}
      </div>
    </div>
  );
}

export default AdminPanel;
