// Page side of the packet pump: starts the worker (its bundled source is inlined at build time) and relays its
// messages into the session.

export function startPump(session, onControl) {
  const url = URL.createObjectURL(new Blob([__PUMP_WORKER_SOURCE__], { type: "text/javascript" }));
  const worker = new Worker(url, { name: "bo1-coop-pump" });
  worker.onmessage = ({ data: message }) => {
    if (message.type === "socket") session.onSocket(message);
    else if (message.type === "control") onControl(session, message.message);
    else if (message.type === "stats") session.stats = message.stats;
  };
  worker.onerror = (event) => session.fail("workerFailed", event.message);
  worker.postMessage({ type: "connect", relay: session.relay, room: session.room, role: session.mode, guestId: session.guestId });
  return worker;
}

/** Sends a control message to the other player(s) through the relay. */
export function send(session, message) {
  session.pump?.postMessage({ type: "send", message });
}
