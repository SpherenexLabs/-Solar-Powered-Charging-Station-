import { useMemo, useState } from "react";
import { ref, push, set } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import LiveDataCard from "../components/LiveDataCard";
import SlotCard from "../components/SlotCard";
import PaymentGateway from "../components/PaymentGateway";
import useSolarLive from "../hooks/useSolarLive";
import useSlots from "../hooks/useSlots";
import useDcSessions from "../hooks/useDcSessions";
import {
  AC_DURATIONS,
  AC_OPTIONS,
  DC_DURATIONS,
  DC_OPTIONS,
  findDuration,
  fmtClock,
  fmtCountdown,
  slotConfig
} from "../lib/solarConfig";

function UserPanel() {
  const { currentUser } = useAuth();
  const live = useSolarLive();
  const { slots, now, bookSlot } = useSlots();
  const { sessions, activeSessions, startSession } = useDcSessions();

  const [supply, setSupply] = useState("AC"); // AC | DC
  const [selectedSlot, setSelectedSlot] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [receiptView, setReceiptView] = useState(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: currentUser?.name || "",
    phone: "",
    chargingOption: AC_OPTIONS[0],
    duration: AC_DURATIONS[0].label,
    startNow: true,
    timeSlot: ""
  });

  const durations = supply === "AC" ? AC_DURATIONS : DC_DURATIONS;
  const options = supply === "AC" ? AC_OPTIONS : DC_OPTIONS;
  const tariff = findDuration(durations, form.duration);
  const amount = tariff.amount;

  const slotList = useMemo(() => Object.values(slots), [slots]);
  const relayValues = {
    Relay1: live.relay1,
    Relay2: live.relay2,
    Relay3: live.relay3,
    Relay4: live.relay4
  };

  const availableCount = slotList.filter((s) => s.status === "available").length;

  /* Sessions belonging to the signed-in user */
  const mySlot = slotList.find((s) => s.userUid && s.userUid === currentUser?.uid);
  const myDc = sessions.filter(
    (s) => s.userUid === currentUser?.uid && s.status === "Charging" && s.endTime > now
  );

  /* ── Switch AC / DC ── */
  function switchSupply(next) {
    setSupply(next);
    setSelectedSlot("");
    setForm((f) => ({
      ...f,
      chargingOption: next === "AC" ? AC_OPTIONS[0] : DC_OPTIONS[0],
      duration: next === "AC" ? AC_DURATIONS[0].label : DC_DURATIONS[0].label
    }));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  /* Resolve the chosen clock time to an absolute timestamp (today, or
     tomorrow when the time has already passed) */
  function resolveStart() {
    if (form.startNow || !form.timeSlot) return Date.now();

    const [h, m] = form.timeSlot.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    if (start.getTime() < Date.now() - 60000) start.setDate(start.getDate() + 1);
    return start.getTime();
  }

  function proceedToPayment(e) {
    e.preventDefault();

    if (supply === "AC" && !selectedSlot) {
      alert("Please select one available slot (Slot 1 to Slot 4).");
      return;
    }
    if (!form.name.trim() || !/^\d{10}$/.test(form.phone.trim())) {
      alert("Please enter your name and a valid 10-digit phone number.");
      return;
    }
    if (!form.startNow && !form.timeSlot) {
      alert("Please pick a start time or choose Start Now.");
      return;
    }

    setShowPayment(true);
  }

  /* ── Called only after the gateway reports a successful payment ── */
  async function handlePaid(receipt) {
    /* Someone else may have grabbed the slot while this checkout was open */
    if (supply === "AC" && slots[selectedSlot]?.status !== "available") {
      alert(
        `${slotConfig(selectedSlot)?.name} was just taken by another user. ` +
          "Please choose a different slot."
      );
      setShowPayment(false);
      setSelectedSlot("");
      return;
    }

    setBusy(true);

    const startTime = resolveStart();
    const endTime = startTime + tariff.minutes * 60000;
    const created = new Date();

    const base = {
      name: form.name.trim(),
      userUid: currentUser?.uid || "",
      email: currentUser?.email || "",
      phone: form.phone.trim(),
      supply,
      chargingOption: form.chargingOption,
      duration: tariff.label,
      durationMinutes: tariff.minutes,
      startTime,
      endTime,
      timeSlot: fmtClock(startTime),
      amount,
      paymentStatus: "Paid",
      paymentMethod: receipt.paymentMethod,
      paymentRef: receipt.paymentRef,
      txnId: receipt.txnId,
      voltage: live.voltage,
      current: live.current,
      power: live.power,
      battery: live.battery,
      temperature: live.temperature,
      date: created.toLocaleDateString(),
      time: created.toLocaleTimeString(),
      createdAt: created.toISOString()
    };

    try {
      if (supply === "AC") {
        const cfg = slotConfig(selectedSlot);

        /* 1. transaction record */
        const txnNode = push(ref(db, "Solar/Transactions"));
        await set(txnNode, {
          ...base,
          slot: selectedSlot,
          slotName: cfg.name,
          relay: cfg.relay,
          relayState: startTime <= Date.now() ? 1 : 0,
          sessionStatus: startTime <= Date.now() ? "Charging" : "Reserved"
        });

        /* 2. occupy the slot and switch its relay to 1 */
        await bookSlot(selectedSlot, {
          bookedBy: base.name,
          userUid: base.userUid,
          phone: base.phone,
          supply: "AC",
          chargingOption: base.chargingOption,
          duration: base.duration,
          durationMinutes: base.durationMinutes,
          startTime,
          endTime,
          timeSlot: base.timeSlot,
          amount,
          paymentStatus: "Paid",
          paymentMethod: base.paymentMethod,
          paymentRef: base.paymentRef,
          txnId: base.txnId,
          txnKey: txnNode.key
        });

        setReceiptView({ ...base, slotName: cfg.name, relay: cfg.relay });
      } else {
        /* DC — always available, no slot is blocked */
        const txnNode = push(ref(db, "Solar/Transactions"));
        await set(txnNode, {
          ...base,
          slot: "DC Port",
          slotName: "DC Fast Charging",
          relay: "DC",
          sessionStatus: "Charging"
        });

        await startSession({
          name: base.name,
          userUid: base.userUid,
          phone: base.phone,
          chargingOption: base.chargingOption,
          duration: base.duration,
          durationMinutes: base.durationMinutes,
          startTime,
          endTime,
          amount,
          paymentStatus: "Paid",
          paymentMethod: base.paymentMethod,
          txnId: base.txnId,
          txnKey: txnNode.key
        });

        setReceiptView({ ...base, slotName: "DC Fast Charging", relay: "DC" });
      }

      setShowPayment(false);
      setSelectedSlot("");
      setForm((f) => ({ ...f, phone: "", timeSlot: "", startNow: true }));
    } catch (err) {
      alert(err.message || "Could not complete the booking.");
      setShowPayment(false);
    } finally {
      setBusy(false);
    }
  }

  const paySummary = [
    { label: "Supply", value: supply === "AC" ? "AC Charging" : "DC Fast Charging" },
    { label: supply === "AC" ? "Slot" : "Port", value: supply === "AC" ? slotConfig(selectedSlot)?.name || "—" : "DC Port" },
    { label: "Charging Type", value: form.chargingOption },
    { label: "Duration", value: tariff.label },
    { label: "Starts", value: form.startNow ? "Immediately" : form.timeSlot }
  ];

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <span className="section-label">User Dashboard</span>
          <h1>Book a Solar Charging Slot</h1>
          <p>
            Four AC slots (Slot 1 – Slot 4) run on Relay 1 – Relay 4. DC fast charging is
            open at all times. Payment is required for both.
          </p>
        </div>
      </div>

      {/* ── Live panel readings ── */}
      <div className="metric-grid">
        <LiveDataCard title="Voltage" value={live.voltage} unit="V" icon="⚡" />
        <LiveDataCard title="Current" value={live.current} unit="A" icon="🔌" />
        <LiveDataCard title="Power" value={live.power} unit="W" icon="💡" />
        <LiveDataCard title="Battery" value={live.battery} unit="%" icon="🔋" />
        <LiveDataCard title="Temperature" value={live.temperature} unit="°C" icon="🌡️" />
      </div>

      {/* ── My running session ── */}
      {(mySlot || myDc.length > 0) && (
        <div className="my-session">
          <h3>Your Active Charging</h3>
          {mySlot && (
            <div className="my-session-row">
              <span className="ms-tag ac">AC</span>
              <strong>{mySlot.name}</strong>
              <span>{mySlot.chargingOption}</span>
              <span>
                {fmtClock(mySlot.startTime)} – {fmtClock(mySlot.endTime)}
              </span>
              <span className="ms-time">
                {mySlot.status === "reserved"
                  ? `starts in ${fmtCountdown(mySlot.startTime - now)}`
                  : `${fmtCountdown(mySlot.endTime - now)} left`}
              </span>
            </div>
          )}
          {myDc.map((s) => (
            <div className="my-session-row" key={s.key}>
              <span className="ms-tag dc">DC</span>
              <strong>DC Fast Port</strong>
              <span>{s.chargingOption}</span>
              <span>
                {fmtClock(s.startTime)} – {fmtClock(s.endTime)}
              </span>
              <span className="ms-time">{fmtCountdown(s.endTime - now)} left</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Supply selector ── */}
      <div className="supply-switch">
        <button
          className={supply === "AC" ? "active" : ""}
          onClick={() => switchSupply("AC")}
          type="button"
        >
          <strong>AC Charging</strong>
          <small>{availableCount} of 4 slots free</small>
        </button>

        <button
          className={supply === "DC" ? "active" : ""}
          onClick={() => switchSupply("DC")}
          type="button"
        >
          <strong>DC Fast Charging</strong>
          <small>Always available · {activeSessions.length} charging now</small>
        </button>
      </div>

      {supply === "AC" ? (
        <>
          <h2>Select Charging Slot</h2>
          <div className="station-grid">
            {slotList.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                relayValue={relayValues[slot.relay]}
                now={now}
                selected={selectedSlot === slot.id}
                mine={slot.userUid === currentUser?.uid}
                onSelect={setSelectedSlot}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <h2>DC Fast Charging</h2>
          <div className="dc-banner">
            <div className="dc-icon">🔋</div>
            <div className="dc-text">
              <h3>DC Output — Available 24/7</h3>
              <p>
                The DC port is never blocked, so you can start a session at any time. It
                still needs a paid booking, and the session closes automatically when the
                paid time is over.
              </p>
              <div className="dc-tags">
                <span className="dc-live">
                  <span className="relay-led on" /> {activeSessions.length} active session
                  {activeSessions.length === 1 ? "" : "s"}
                </span>
                <span>Bus voltage: {live.voltage} V</span>
                <span>Battery: {live.battery}%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Booking form ── */}
      <div className="form-box">
        <h2>{supply === "AC" ? "AC Slot Booking" : "DC Session Booking"}</h2>

        <form onSubmit={proceedToPayment}>
          {supply === "AC" && (
            <>
              <label>Selected Slot</label>
              <input
                value={slotConfig(selectedSlot)?.name || ""}
                readOnly
                placeholder="Select a slot above"
              />
            </>
          )}

          <label>User Name</label>
          <input
            name="name"
            placeholder="Enter user name"
            value={form.name}
            onChange={handleChange}
          />

          <label>Phone Number</label>
          <input
            name="phone"
            inputMode="numeric"
            placeholder="10-digit phone number"
            value={form.phone}
            onChange={(e) =>
              setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
            }
          />

          <label>Charging Option</label>
          <select name="chargingOption" value={form.chargingOption} onChange={handleChange}>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>

          <label>Charging Duration</label>
          <select name="duration" value={form.duration} onChange={handleChange}>
            {durations.map((d) => (
              <option key={d.label} value={d.label}>
                {d.label} — ₹{d.amount}
              </option>
            ))}
          </select>

          <label className="inline-check">
            <input
              type="checkbox"
              name="startNow"
              checked={form.startNow}
              onChange={handleChange}
            />
            Start immediately after payment
          </label>

          {!form.startNow && (
            <>
              <label>Start Time</label>
              <input type="time" name="timeSlot" value={form.timeSlot} onChange={handleChange} />
            </>
          )}

          <label>Amount</label>
          <input value={`₹${amount}`} readOnly />

          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : `Proceed to Payment · ₹${amount}`}
          </button>
        </form>
      </div>

      {/* Mounted only while checking out, so every checkout starts fresh */}
      {showPayment && (
        <PaymentGateway
          open
          amount={amount}
          summary={paySummary}
          onCancel={() => setShowPayment(false)}
          onSuccess={handlePaid}
        />
      )}

      {/* ── Booking confirmation ── */}
      {receiptView && (
        <div className="popup">
          <div className="popup-box success-receipt">
            <div className="pay-tick">✓</div>
            <h2>Slot Booked Successfully</h2>
            <p className="receipt-line">
              {receiptView.slotName} · {receiptView.duration}
            </p>

            <div className="pay-receipt">
              <div>
                <span>Transaction ID</span>
                <strong>{receiptView.txnId}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong>₹{receiptView.amount}</strong>
              </div>
              <div>
                <span>Method</span>
                <strong>{receiptView.paymentMethod}</strong>
              </div>
              <div>
                <span>Session</span>
                <strong>
                  {fmtClock(receiptView.startTime)} – {fmtClock(receiptView.endTime)}
                </strong>
              </div>
              <div>
                <span>Output</span>
                <strong>
                  {receiptView.relay === "DC"
                    ? "DC port energised"
                    : `${receiptView.relay} = 1 (ON)`}
                </strong>
              </div>
            </div>

            <p className="receipt-note">
              {receiptView.relay === "DC"
                ? "The DC port stays energised for your paid time and closes automatically afterwards."
                : `${receiptView.relay} switches back to 0 automatically the moment your paid time is over.`}
            </p>

            <button onClick={() => setReceiptView(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserPanel;
