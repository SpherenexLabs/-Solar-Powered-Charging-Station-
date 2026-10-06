import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue, push, set, update } from "firebase/database";
import { db } from "../firebase";
import useNow from "./useNow";

/* ══════════════════════════════════════════════════════════════
   DC fast charging.

   DC output is available at all times — it is never "occupied", so any
   number of users may run a DC session at once. Payment is still
   mandatory before a session is created.

   Firebase:
     Solar_Power_System/DC/Active    → 1 while at least one paid DC session is running
     Solar_Power_System/DC/Status    → "Charging" / "Idle"
     Solar_Power_System/DC/Sessions  → the individual paid sessions
══════════════════════════════════════════════════════════════ */

export default function useDcSessions() {
  const now = useNow();
  const [sessions, setSessions] = useState([]);
  const listRef = useRef([]);
  const busy = useRef({});
  const lastActive = useRef(null);

  useEffect(() => {
    const off = onValue(ref(db, "Solar_Power_System/DC/Sessions"), (snap) => {
      const val = snap.val() || {};
      const list = Object.keys(val).map((key) => ({ key, ...val[key] }));
      listRef.current = list;
      setSessions(list);
    });

    return () => off();
  }, []);

  const endSession = useCallback(async (key) => {
    const session = listRef.current.find((s) => s.key === key);

    await update(ref(db, `Solar_Power_System/DC/Sessions/${key}`), { status: "Completed" });

    if (session?.txnKey) {
      await update(ref(db, `Solar_Power_System/Transactions/${session.txnKey}`), {
        sessionStatus: "Completed",
        releasedAt: new Date().toISOString()
      });
    }
  }, []);

  /* Tick: close finished sessions and keep DC/Active + DC/Status in sync */
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();

      listRef.current.forEach((s) => {
        if (s.status !== "Charging") return;
        if (busy.current[s.key]) return;
        if (s.endTime && t >= s.endTime) {
          busy.current[s.key] = true;
          endSession(s.key).finally(() => {
            busy.current[s.key] = false;
          });
        }
      });

      const running = listRef.current.some(
        (s) => s.status === "Charging" && s.endTime > t
      );
      const flag = running ? 1 : 0;

      if (lastActive.current !== flag) {
        lastActive.current = flag;
        set(ref(db, "Solar_Power_System/DC/Active"), flag);
        set(ref(db, "Solar_Power_System/DC/Status"), running ? "Charging" : "Idle");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endSession]);

  /* Start a DC session after a successful payment */
  const startSession = useCallback(async (booking) => {
    const node = push(ref(db, "Solar_Power_System/DC/Sessions"));
    const payload = { ...booking, supply: "DC", status: "Charging" };

    await set(node, payload);
    await set(ref(db, "Solar_Power_System/DC/Active"), 1);
    await set(ref(db, "Solar_Power_System/DC/Status"), "Charging");
    lastActive.current = 1;

    return { key: node.key, ...payload };
  }, []);

  const activeSessions = sessions.filter(
    (s) => s.status === "Charging" && s.endTime > now
  );

  return { sessions, activeSessions, startSession, endSession };
}
