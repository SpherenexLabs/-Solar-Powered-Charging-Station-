import { useEffect, useMemo, useState } from "react";
import { ref, push, set } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import LiveDataCard from "../components/LiveDataCard";
import SlotCard from "../components/SlotCard";
import PaymentGateway from "../components/PaymentGateway";
import useSolarLive from "../hooks/useSolarLive";
import useSlots from "../hooks/useSlots";
import useDcSessions from "../hooks/useDcSessions";
import { getCurrentPosition } from "../lib/googleMaps";
import {
  AC_DURATIONS,
  AC_OPTIONS,
  DC_DURATIONS,
  DC_OPTIONS,
  findDuration,
  fmtClock,
  fmtCountdown,
  relaysForChargingOption,
  slotConfig
} from "../lib/solarConfig";

const CUSTOM_DURATION = "Custom Minutes";

function priceForCustomMinutes(durations, minutes) {
  const points = [...durations].sort((a, b) => a.minutes - b.minutes);
  const exact = points.find((point) => point.minutes === minutes);
  if (exact) return exact.amount;

  const upperIndex = points.findIndex((point) => point.minutes > minutes);
  if (upperIndex === 0) {
    return Math.max(1, Math.ceil((points[0].amount / points[0].minutes) * minutes));
  }
  if (upperIndex === -1) {
    const last = points.at(-1);
    return Math.ceil((last.amount / last.minutes) * minutes);
  }

  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const progress = (minutes - lower.minutes) / (upper.minutes - lower.minutes);
  return Math.ceil(lower.amount + progress * (upper.amount - lower.amount));
}

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
  const [stationLocation, setStationLocation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentPosition()
      .then((position) => {
        if (!cancelled) setStationLocation(position);
      })
      .catch((error) => {
        console.warn("Current charging-station location is unavailable:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [form, setForm] = useState({
    name: currentUser?.name || "",
    phone: "",
    chargingOption: AC_OPTIONS[0],
    chargingOptions: [],
    acRelay: "Relay2",
    duration: AC_DURATIONS[0].label,
    customMinutes: AC_DURATIONS[0].minutes,
    startNow: true,
    timeSlot: ""
  });

  const durations = supply === "AC" ? AC_DURATIONS : DC_DURATIONS;
  const options = supply === "AC" ? AC_OPTIONS : DC_OPTIONS;
  const tariff = findDuration(durations, form.duration);
  const usingCustomDuration = form.duration === CUSTOM_DURATION;
  const customMinutes = Math.min(720, Math.max(1, Number(form.customMinutes) || 1));
  const durationMinutes = usingCustomDuration ? customMinutes : tariff.minutes;
  const durationLabel = usingCustomDuration ? `${durationMinutes} Minutes` : tariff.label;
  const amount = usingCustomDuration
    ? priceForCustomMinutes(durations, durationMinutes)
    : tariff.amount;
  const selectedChargingOptions =
    supply === "AC" ? form.chargingOptions : [form.chargingOption];
  const selectedRelays = supply === "AC"
    ? [...new Set(
        form.chargingOptions.flatMap((option) =>
          relaysForChargingOption(option, form.acRelay)
        )
      )]
    : [];

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
      chargingOptions: [],
      duration: next === "AC" ? AC_DURATIONS[0].label : DC_DURATIONS[0].label,
      customMinutes: next === "AC" ? AC_DURATIONS[0].minutes : DC_DURATIONS[0].minutes
    }));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  function selectChargingOption(option) {
    if (supply !== "AC") {
      setForm((f) => ({ ...f, chargingOption: option }));
      return;
    }

    setForm((f) => ({
      ...f,
      chargingOption: option,
      chargingOptions: f.chargingOptions.includes(option)
        ? f.chargingOptions
        : [...f.chargingOptions, option]
    }));
  }

  function selectAcRelay(acRelay) {
    setForm((f) => ({ ...f, acRelay }));
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
    if (supply === "AC" && selectedChargingOptions.length === 0) {
      alert("Please select at least one charging connector.");
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
    if (usingCustomDuration && (Number(form.customMinutes) < 1 || Number(form.customMinutes) > 720)) {
      alert("Please enter a charging duration between 1 and 720 minutes.");
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
    const endTime = startTime + durationMinutes * 60000;
    const created = new Date();

    const base = {
      name: form.name.trim(),
      userUid: currentUser?.uid || "",
      email: currentUser?.email || "",
      phone: form.phone.trim(),
      supply,
      chargingOption: supply === "AC" ? selectedChargingOptions.join(" + ") : form.chargingOption,
      chargingOptions: supply === "AC" ? selectedChargingOptions : [form.chargingOption],
      acRelay: form.chargingOptions.includes("AC Socket (230V)") ? form.acRelay : "",
      relays: selectedRelays,
      duration: durationLabel,
      durationMinutes,
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
        const relays = base.relays;

        /* 1. transaction record */
        const txnNode = push(ref(db, "Solar_Power_System/Transactions"));
        await set(txnNode, {
          ...base,
          slot: selectedSlot,
          slotName: cfg.name,
          relay: relays.join(" + "),
          relays,
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
          chargingOptions: base.chargingOptions,
          acRelay: base.acRelay,
          relays,
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

        setReceiptView({ ...base, slotName: cfg.name, relay: relays.join(" + "), relays });
      } else {
        /* DC — always available, no slot is blocked */
        const txnNode = push(ref(db, "Solar_Power_System/Transactions"));
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
      setForm((f) => ({
        ...f,
        phone: "",
        chargingOptions: [],
        timeSlot: "",
        startNow: true
      }));
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
    {
      label: "Charging Type",
      value: supply === "AC" ? selectedChargingOptions.join(" + ") || "—" : form.chargingOption
    },
    ...(supply === "AC"
      ? [{
          label: "Relay Output",
          value: selectedRelays.join(" + ") || "—"
        }]
      : []),
    { label: "Duration", value: durationLabel },
    { label: "Starts", value: form.startNow ? "Immediately" : form.timeSlot }
  ];

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <span className="section-label">User Dashboard</span>
          <h1>Book a Solar Charging Slot</h1>
          <p>
            Type-C uses Relay 1, AC uses either Relay 2 or Relay 3 selected by the user,
            and Multi Pin uses Relay 4. DC fast charging is open at all times.
          </p>
        </div>
      </div>

      <div className="current-station-card">
        <div className="current-station-icon">⚡</div>
        <div>
          <span className="current-station-label">Current charging station</span>
          <h3>My Current Location Charging Station</h3>
          <p>
            {stationLocation
              ? `${stationLocation.lat.toFixed(5)}, ${stationLocation.lng.toFixed(5)}`
              : "Allow location access to display the station coordinates."}
          </p>
        </div>
        <span className="current-station-status">Available now</span>
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
                relayValues={relayValues}
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
          <div className="charging-option-buttons">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                className={
                  supply === "AC"
                    ? form.chargingOptions.includes(o) ? "active" : ""
                    : form.chargingOption === o ? "active" : ""
                }
                aria-pressed={
                  supply === "AC"
                    ? form.chargingOptions.includes(o)
                    : form.chargingOption === o
                }
                onClick={() => selectChargingOption(o)}
              >
                {supply === "AC"
                    ? o === "AC Socket (230V)"
                      ? `${o} · Choose R2 or R3`
                      : `${o} · ${relaysForChargingOption(o)
                          .map((relay) => relay.replace("Relay", "R"))
                          .join(" + ")}`
                    : o}
              </button>
            ))}
          </div>
          {supply === "AC" && (
            <small className="custom-duration-note">
              Select any required outputs together. Relays turn on only after successful payment.
            </small>
          )}

          {supply === "AC" && form.chargingOptions.includes("AC Socket (230V)") && (
            <>
              <label>Select AC Output</label>
              <div className="charging-option-buttons ac-relay-buttons">
                {["Relay2", "Relay3"].map((relay) => (
                  <button
                    key={relay}
                    type="button"
                    className={form.acRelay === relay ? "active" : ""}
                    aria-pressed={form.acRelay === relay}
                    onClick={() => selectAcRelay(relay)}
                  >
                    {relay.replace("Relay", "Relay ")}
                  </button>
                ))}
              </div>
            </>
          )}

          <label>Charging Duration</label>
          <select name="duration" value={form.duration} onChange={handleChange}>
            {durations.map((d) => (
              <option key={d.label} value={d.label}>
                {d.label} — ₹{d.amount}
              </option>
            ))}
            <option value={CUSTOM_DURATION}>Custom duration</option>
          </select>

          {usingCustomDuration && (
            <>
              <label>Custom Charging Time (Minutes)</label>
              <input
                type="number"
                name="customMinutes"
                min="1"
                max="720"
                step="1"
                value={form.customMinutes}
                onChange={handleChange}
              />
              <small className="custom-duration-note">
                Choose 1–720 minutes. Estimated charge: ₹{amount}.
              </small>
            </>
          )}

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
