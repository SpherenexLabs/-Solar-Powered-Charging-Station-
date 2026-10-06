import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue, set, update } from "firebase/database";
import { db } from "../firebase";
import { AC_SLOTS } from "../lib/solarConfig";
import useNow from "./useNow";

/* ══════════════════════════════════════════════════════════════
   Slot + relay engine.

   Slot life cycle
   ───────────────
   available  → nobody booked it, relay = 0
   reserved   → paid, but the chosen start time is still in the future,
                relay stays 0
   occupied   → start time reached, relay = 1, counting down
   (expiry)   → end time reached, relay is written back to 0 and the
                slot is reset to available exactly as it was before

   Every mounted panel runs the same 1-second tick, so the relay is
   released even if the person who booked it closed their browser.
══════════════════════════════════════════════════════════════ */

export function blankSlot(cfg) {
  return {
    id: cfg.id,
    name: cfg.name,
    relay: cfg.relay,
    supply: "AC",
    status: "available",
    bookedBy: "",
    userUid: "",
    phone: "",
    chargingOption: "",
    duration: "",
    durationMinutes: 0,
    startTime: 0,
    endTime: 0,
    timeSlot: "",
    amount: 0,
    paymentStatus: "",
    paymentMethod: "",
    paymentRef: "",
    txnId: "",
    txnKey: ""
  };
}

/* Reset payload — writes the slot back to its original empty shape */
function resetPayload(cfg) {
  return blankSlot(cfg);
}

function sessionRelays(slot, cfg) {
  return Array.isArray(slot?.relays) && slot.relays.length ? slot.relays : [cfg.relay];
}

function writeRelays(relays, value) {
  return update(
    ref(db, "Solar_Power_System"),
    Object.fromEntries(relays.map((relay) => [relay, value]))
  );
}

export default function useSlots() {
  const [slots, setSlots] = useState({});
  const now = useNow();
  const slotsRef = useRef({});
  const seeded = useRef(false);
  const busy = useRef({}); // guards against firing the same write twice

  /* ── Live subscription + first-run seeding ── */
  useEffect(() => {
    const off = onValue(ref(db, "Solar_Power_System/Slots"), (snap) => {
      const val = snap.val() || {};
      const merged = {};

      AC_SLOTS.forEach((cfg) => {
        merged[cfg.id] = { ...blankSlot(cfg), ...(val[cfg.id] || {}) };
      });

      slotsRef.current = merged;
      setSlots(merged);

      /* Create any slot that does not exist yet in the database */
      if (!seeded.current) {
        seeded.current = true;
        AC_SLOTS.forEach((cfg) => {
          if (!val[cfg.id]) set(ref(db, `Solar_Power_System/Slots/${cfg.id}`), blankSlot(cfg));
        });
      }
    });

    return () => off();
  }, []);

  /* ── Release a slot: relay OFF + slot back to available ── */
  const releaseSlot = useCallback(async (slotId, reason = "Completed") => {
    const cfg = AC_SLOTS.find((s) => s.id === slotId);
    if (!cfg) return;

    const current = slotsRef.current[slotId];

    await writeRelays(sessionRelays(current, cfg), 0);
    await set(ref(db, `Solar_Power_System/Slots/${slotId}`), resetPayload(cfg));

    if (current?.txnKey) {
      await update(ref(db, `Solar_Power_System/Transactions/${current.txnKey}`), {
        sessionStatus: reason,
        relayState: 0,
        releasedAt: new Date().toISOString()
      });
    }
  }, []);

  /* ── Start a reserved slot: relay ON ── */
  const activateSlot = useCallback(async (slotId) => {
    const cfg = AC_SLOTS.find((s) => s.id === slotId);
    if (!cfg) return;

    const current = slotsRef.current[slotId];

    await writeRelays(sessionRelays(current, cfg), 1);
    await update(ref(db, `Solar_Power_System/Slots/${slotId}`), { status: "occupied" });

    if (current?.txnKey) {
      await update(ref(db, `Solar_Power_System/Transactions/${current.txnKey}`), {
        sessionStatus: "Charging",
        relayState: 1
      });
    }
  }, []);

  /* ── 1-second tick: drive reserved → occupied → available ── */
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();

      Object.values(slotsRef.current).forEach((slot) => {
        if (slot.status === "available") return;
        if (busy.current[slot.id]) return;

        const expired = slot.endTime && t >= slot.endTime;
        const shouldStart = slot.status === "reserved" && slot.startTime && t >= slot.startTime;

        if (expired) {
          busy.current[slot.id] = true;
          releaseSlot(slot.id, "Completed").finally(() => {
            busy.current[slot.id] = false;
          });
        } else if (shouldStart) {
          busy.current[slot.id] = true;
          activateSlot(slot.id).finally(() => {
            busy.current[slot.id] = false;
          });
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [releaseSlot, activateSlot]);

  /* ── Book a slot after a successful payment ── */
  const bookSlot = useCallback(async (slotId, booking) => {
    const cfg = AC_SLOTS.find((s) => s.id === slotId);
    if (!cfg) throw new Error("Unknown slot");

    const live = slotsRef.current[slotId];
    if (live && live.status !== "available") {
      throw new Error(`${cfg.name} was just taken by another user. Please pick a different slot.`);
    }

    const startsNow = booking.startTime <= Date.now();

    const payload = {
      ...blankSlot(cfg),
      ...booking,
      status: startsNow ? "occupied" : "reserved"
    };

    await set(ref(db, `Solar_Power_System/Slots/${slotId}`), payload);
    /* Relay goes HIGH the moment the session actually starts */
    await writeRelays(sessionRelays(payload, cfg), startsNow ? 1 : 0);

    return payload;
  }, []);

  return { slots, now, bookSlot, releaseSlot, activateSlot };
}
