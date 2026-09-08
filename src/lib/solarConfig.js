/* ══════════════════════════════════════════════════════════════
   Central configuration for the Solar Charging Station.

   AC  →  4 physical slots, each wired to one relay (Relay1..Relay4).
          Only one user can hold a slot at a time.
   DC  →  Always available (no slot limit), but payment is still
          required before a DC session starts.
══════════════════════════════════════════════════════════════ */

/* The 4 AC slots and the Firebase relay key each one switches */
export const AC_SLOTS = [
  { id: "Slot1", name: "Slot 1", relay: "Relay1" },
  { id: "Slot2", name: "Slot 2", relay: "Relay2" },
  { id: "Slot3", name: "Slot 3", relay: "Relay3" },
  { id: "Slot4", name: "Slot 4", relay: "Relay4" }
];

export const SLOT_IDS = AC_SLOTS.map((s) => s.id);

export function slotConfig(slotId) {
  return AC_SLOTS.find((s) => s.id === slotId) || null;
}

/* ── Tariff: AC (slot based) ── */
export const AC_DURATIONS = [
  { label: "30 Minutes", minutes: 30, amount: 30 },
  { label: "1 Hour", minutes: 60, amount: 50 },
  { label: "2 Hours", minutes: 120, amount: 90 },
  { label: "3 Hours", minutes: 180, amount: 120 }
];

/* ── Tariff: DC fast charging (always available, still paid) ── */
export const DC_DURATIONS = [
  { label: "15 Minutes", minutes: 15, amount: 60 },
  { label: "30 Minutes", minutes: 30, amount: 100 },
  { label: "45 Minutes", minutes: 45, amount: 140 },
  { label: "1 Hour", minutes: 60, amount: 180 }
];

export const AC_OPTIONS = ["USB Type-C", "USB Multi Pin", "AC Socket (230V)"];
export const DC_OPTIONS = ["DC Fast (CCS-2)", "DC Fast (CHAdeMO)", "DC 12V Output"];

export function findDuration(list, label) {
  return list.find((d) => d.label === label) || list[0];
}

/* ── Small shared formatters ── */
export function fmtClock(ms) {
  if (!ms) return "--:--";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* Milliseconds → "01:24:09" / "24:09" countdown text */
export function fmtCountdown(ms) {
  if (!ms || ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function makeTxnId() {
  return (
    "TXN" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}
