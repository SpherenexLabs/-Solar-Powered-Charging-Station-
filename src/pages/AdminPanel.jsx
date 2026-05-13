import { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase";
import LiveDataCard from "../components/LiveDataCard";
import EnergyChart from "../components/EnergyChart";
import jsPDF from "jspdf";

function AdminPanel() {
  const [liveData, setLiveData] = useState({});
  const [stations, setStations] = useState({});
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    onValue(ref(db, "Solar/LiveData"), (snapshot) => {
      if (snapshot.exists()) {
        setLiveData(snapshot.val());
      }
    });

    onValue(ref(db, "Solar/Stations"), (snapshot) => {
      if (snapshot.exists()) {
        setStations(snapshot.val());
      }
    });

    onValue(ref(db, "Solar/Transactions"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));

        setTransactions(list.reverse());
      } else {
        setTransactions([]);
      }
    });
  }, []);

  const makeStationAvailable = async (stationName) => {
    await update(ref(db, `Solar/Stations/${stationName}`), {
      status: "available",
      selectedBy: "",
      chargingOption: "",
      duration: "",
      timeSlot: "",
      paymentStatus: ""
    });
  };

  const downloadCSV = () => {
    const headers = [
      "Name",
      "Phone",
      "Station",
      "Charging Option",
      "Duration",
      "Time Slot",
      "Amount",
      "Payment Status",
      "Voltage",
      "Current",
      "Load",
      "Battery",
      "Energy",
      "Date",
      "Time"
    ];

    const rows = transactions.map((item) => [
      item.name,
      item.phone,
      item.station,
      item.chargingOption,
      item.duration,
      item.timeSlot,
      item.amount,
      item.paymentStatus,
      item.voltage,
      item.current,
      item.load,
      item.battery,
      item.energy,
      item.date,
      item.time
    ]);

    const csvContent =
      headers.join(",") + "\n" + rows.map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });

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

    let y = 35;

    transactions.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.name} | ${item.phone} | ${item.station} | ${
          item.chargingOption
        } | ${item.duration} | Rs.${item.amount} | ${item.paymentStatus}`,
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
            Monitor live solar data, users, station status, payments and reports.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <LiveDataCard title="Voltage" value={liveData.voltage} unit="V" icon="⚡" />
        <LiveDataCard title="Current" value={liveData.current} unit="A" icon="🔌" />
        <LiveDataCard title="Load" value={liveData.load} unit="W" icon="💡" />
        <LiveDataCard title="Battery" value={liveData.battery} unit="%" icon="🔋" />
        <LiveDataCard title="Energy" value={liveData.energy} unit="Wh" icon="☀️" />
      </div>

      <EnergyChart liveData={liveData} />

      <h2>Station Monitoring</h2>

      <div className="station-grid">
        {Object.keys(stations).map((stationName) => (
          <div
            key={stationName}
            className={`new-station-card ${
              stations[stationName]?.status === "available"
                ? "available"
                : "occupied"
            }`}
          >
            <div className="station-head">
              <div>
                <h3>{stationName}</h3>
                <p>
                  {stations[stationName]?.status === "available"
                    ? "Station is ready"
                    : "Station is occupied"}
                </p>
              </div>

              <span className="status-pill">
                {stations[stationName]?.status || "available"}
              </span>
            </div>

            <div className="station-body">
              <div>
                <span>User</span>
                <strong>{stations[stationName]?.selectedBy || "None"}</strong>
              </div>

              <div>
                <span>Option</span>
                <strong>{stations[stationName]?.chargingOption || "None"}</strong>
              </div>

              <div>
                <span>Duration</span>
                <strong>{stations[stationName]?.duration || "None"}</strong>
              </div>

              <div>
                <span>Time Slot</span>
                <strong>{stations[stationName]?.timeSlot || "None"}</strong>
              </div>
            </div>

            <button onClick={() => makeStationAvailable(stationName)}>
              Make Available
            </button>
          </div>
        ))}
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
              <th>Name</th>
              <th>Phone</th>
              <th>Station</th>
              <th>Option</th>
              <th>Duration</th>
              <th>Time Slot</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Battery</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.phone}</td>
                <td>{item.station}</td>
                <td>{item.chargingOption}</td>
                <td>{item.duration}</td>
                <td>{item.timeSlot}</td>
                <td>₹{item.amount}</td>
                <td>{item.paymentStatus}</td>
                <td>{item.battery}%</td>
                <td>{item.date}</td>
                <td>{item.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {transactions.length === 0 && (
          <p className="empty-text">No transactions found.</p>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;