import { CLIENT_TUNING } from "./tuning.js";

/**
 * Fixed-timestep game loop with clamped frame delta.
 * `update` runs at exactly `tickRate` Hz; `render` runs once per animation frame
 * and receives the interpolation alpha between the last two ticks.
 */
export function startLoop(
  tickRate: number,
  update: () => void,
  render: (alpha: number) => void,
): () => void {
  const stepSec = 1 / tickRate;
  let accumulator = 0;
  let last = performance.now();
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    let delta = (now - last) / 1000;
    last = now;
    if (delta > CLIENT_TUNING.loop.maxFrameDeltaSec) delta = CLIENT_TUNING.loop.maxFrameDeltaSec;
    accumulator += delta;
    while (accumulator >= stepSec) {
      update();
      accumulator -= stepSec;
    }
    render(accumulator / stepSec);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return () => {
    running = false;
  };
}
