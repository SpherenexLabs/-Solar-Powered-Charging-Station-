import { useEffect, useState } from "react";
import { ref, onValue, push, set, update } from "firebase/database";
import { db } from "../firebase";
import LiveDataCard from "../components/LiveDataCard";
import StationCard from "../components/StationCard";

function UserPanel() {
  const [liveData, setLiveData] = useState({});
  const [stations, setStations] = useState({});
  const [selectedStation, setSelectedStation] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    chargingOption: "USB Type-C",
    duration: "30 Minutes",
    timeSlot: "",
    amount: 30
  });

  useEffect(() => {
    const liveRef = ref(db, "Solar/LiveData");
    const stationRef = ref(db, "Solar/Stations");

    onValue(liveRef, (snapshot) => {
      if (snapshot.exists()) {
        setLiveData(snapshot.val());
      }
    });

    onValue(stationRef, (snapshot) => {
      if (snapshot.exists()) {
        setStations(snapshot.val());
      } else {
        const defaultStations = {
          Station1: { status: "available", selectedBy: "" },
          Station2: { status: "available", selectedBy: "" },
          Station3: { status: "available", selectedBy: "" }
        };

        set(ref(db, "Solar/Stations"), defaultStations);
      }
    });
  }, []);

  const handleStationSelect = (stationName) => {
    setSelectedStation(stationName);
    setConfirmation(false);
  };

  const calculateAmount = (duration) => {
    if (duration === "30 Minutes") return 30;
    if (duration === "1 Hour") return 50;
    if (duration === "2 Hours") return 90;
    if (duration === "3 Hours") return 120;
    return 30;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "duration") {
      setFormData({
        ...formData,
        duration: value,
        amount: calculateAmount(value)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const proceedToPayment = (e) => {
    e.preventDefault();

    if (!selectedStation) {
      alert("Please select one available station");
      return;
    }

    if (!formData.name || !formData.phone || !formData.timeSlot) {
      alert("Please fill all details");
      return;
    }

    setShowPayment(true);
  };

  const confirmPayment = async () => {
    const now = new Date();

    const transactionData = {
      name: formData.name,
      phone: formData.phone,
      station: selectedStation,
      chargingOption: formData.chargingOption,
      duration: formData.duration,
      timeSlot: formData.timeSlot,
      amount: formData.amount,
      paymentStatus: "Paid",
      voltage: liveData.voltage || 0,
      current: liveData.current || 0,
      load: liveData.load || 0,
      battery: liveData.battery || 0,
      energy: liveData.energy || 0,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString()
    };

    const transactionRef = push(ref(db, "Solar/Transactions"));
    await set(transactionRef, transactionData);

    await update(ref(db, `Solar/Stations/${selectedStation}`), {
      status: "occupied",
      selectedBy: formData.name,
      chargingOption: formData.chargingOption,
      duration: formData.duration,
      timeSlot: formData.timeSlot,
      paymentStatus: "Paid"
    });

    setShowPayment(false);
    setConfirmation(true);

    setFormData({
      name: "",
      phone: "",
      chargingOption: "USB Type-C",
      duration: "30 Minutes",
      timeSlot: "",
      amount: 30
    });

    setSelectedStation("");
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <span className="section-label">User Dashboard</span>
          <h1>Book Solar Charging Slot</h1>
          <p>
            Select available station, choose charging type, set time slot and
            complete dummy payment.
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

      <h2>Select Charging Station</h2>

      <div className="station-grid">
        {Object.keys(stations).map((stationName) => (
          <StationCard
            key={stationName}
            stationName={stationName}
            data={stations[stationName]}
            onSelect={handleStationSelect}
          />
        ))}
      </div>

      <div className="form-box">
        <h2>Charging Booking Form</h2>

        <form onSubmit={proceedToPayment}>
          <label>Selected Station</label>
          <input value={selectedStation} readOnly placeholder="Select station above" />

          <label>User Name</label>
          <input
            name="name"
            placeholder="Enter user name"
            value={formData.name}
            onChange={handleChange}
          />

          <label>Phone Number</label>
          <input
            name="phone"
            placeholder="Enter phone number"
            value={formData.phone}
            onChange={handleChange}
          />

          <label>Charging Option</label>
          <select
            name="chargingOption"
            value={formData.chargingOption}
            onChange={handleChange}
          >
            <option>USB Type-C</option>
            <option>USB Multi Pin</option>
            <option>AC Socket</option>
          </select>

          <label>Charging Duration</label>
          <select
            name="duration"
            value={formData.duration}
            onChange={handleChange}
          >
            <option>30 Minutes</option>
            <option>1 Hour</option>
            <option>2 Hours</option>
            <option>3 Hours</option>
          </select>

          <label>Time Slot</label>
          <input
            type="time"
            name="timeSlot"
            value={formData.timeSlot}
            onChange={handleChange}
          />

          <label>Amount</label>
          <input value={`₹${formData.amount}`} readOnly />

          <button type="submit">Proceed to Dummy Payment</button>
        </form>
      </div>

      {showPayment && (
        <div className="popup">
          <div className="popup-box">
            <h2>Dummy Payment Gateway</h2>

            <p>
              <b>Name:</b> {formData.name}
            </p>
            <p>
              <b>Station:</b> {selectedStation}
            </p>
            <p>
              <b>Option:</b> {formData.chargingOption}
            </p>
            <p>
              <b>Duration:</b> {formData.duration}
            </p>
            <p>
              <b>Time Slot:</b> {formData.timeSlot}
            </p>
            <p>
              <b>Amount:</b> ₹{formData.amount}
            </p>

            <button onClick={confirmPayment}>Pay Now</button>
            <button className="cancel" onClick={() => setShowPayment(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="success-box">
          <h2>Payment Successful</h2>
          <p>Your charging session has been booked successfully.</p>
          <p>Payment status and session details are stored inside Firebase path:</p>
          <strong>Solar / Transactions</strong>
        </div>
      )}
    </div>
  );
}

export default UserPanel;