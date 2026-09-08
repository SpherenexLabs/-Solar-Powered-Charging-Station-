import { useSyncExternalStore } from "react";

/* One shared 1-second clock for every countdown in the app.
   The timer only runs while something is subscribed to it. */

let current = Date.now();
let timer = null;
const listeners = new Set();

function tick() {
  current = Date.now();
  listeners.forEach((notify) => notify());
}

function subscribe(notify) {
  listeners.add(notify);
  if (!timer) timer = setInterval(tick, 1000);

  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return current;
}

export default function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
