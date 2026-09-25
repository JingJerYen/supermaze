import { DEFAULT_TUNING, Simulation } from "@supermaze/sim";

/**
 * Headless authoritative loop. Phase-0 skeleton: runs the simulation at the
 * configured tick rate with no network attached.
 *
 * Transport (Colyseus vs raw WebSocket) is chosen at the end of phase 0 and
 * plugged in here; the simulation itself does not change.
 */
const sim = new Simulation({
  seed: Date.now() >>> 0,
  participants: [],
});

const tickMs = 1000 / DEFAULT_TUNING.tickRate;
let lastLog = Date.now();

setInterval(() => {
  sim.step(new Map());
  const now = Date.now();
  if (now - lastLog >= 5000) {
    console.log(`[server] tick=${sim.getState().tick}`);
    lastLog = now;
  }
}, tickMs);

console.log(`[server] simulation running at ${DEFAULT_TUNING.tickRate} Hz (no transport yet)`);
