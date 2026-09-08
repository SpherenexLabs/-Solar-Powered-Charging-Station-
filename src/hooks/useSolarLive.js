import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

/* Live values published by the hardware as flat children of Solar/:
     Solar/Voltage, Solar/Current, Solar/Power, Solar/Battery, Solar/Temperature,
     Solar/Relay1..4

   Nothing here is invented or derived — a key the board has not published
   stays null so the dashboard can show "—" instead of a fake 0.
   We subscribe leaf-by-leaf so Users / Transactions are never pulled down. */

const NUMERIC = {
  Voltage: "voltage",
  Current: "current",
  Power: "power",
  Battery: "battery",
  Temperature: "temperature"
};

/* Relay values are kept exactly as the board wrote them */
const RAW = {
  Relay1: "relay1",
  Relay2: "relay2",
  Relay3: "relay3",
  Relay4: "relay4"
};

const INITIAL = Object.fromEntries(
  [...Object.values(NUMERIC), ...Object.values(RAW)].map((field) => [field, null])
);

export default function useSolarLive() {
  const [live, setLive] = useState(INITIAL);

  useEffect(() => {
    const unsubs = [];

    Object.entries(NUMERIC).forEach(([key, field]) => {
      unsubs.push(
        onValue(ref(db, `Solar/${key}`), (snap) => {
          const raw = snap.val();
          const num = Number(raw);
          const value = raw === null || raw === "" || !Number.isFinite(num) ? null : num;
          setLive((prev) => ({ ...prev, [field]: value }));
        })
      );
    });

    Object.entries(RAW).forEach(([key, field]) => {
      unsubs.push(
        onValue(ref(db, `Solar/${key}`), (snap) => {
          setLive((prev) => ({ ...prev, [field]: snap.val() }));
        })
      );
    });

    return () => unsubs.forEach((off) => off());
  }, []);

  return live;
}

/* A relay is energised for any non-zero value the board reports */
export function relayIsOn(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number(value) !== 0;
}
