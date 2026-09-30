import { CLIENT_TUNING } from "../tuning.js";

/**
 * Automatic quality for weak devices: lowers the pixel ratio while play runs
 * below `quality.slowFps`, one step at a time, and remembers the result for
 * the next launch. Only frames of a match in progress count, after a warm-up;
 * the median frame time decides, so a single hitch does not. When a step does
 * not help (the device is capped at 30 fps, or the CPU is the limit) the step
 * is undone and the governor stops, so the picture never gets blurry for
 * nothing. It never raises the ratio during a session.
 */
export type GovernorPhase = "warmup" | "measure" | "settle" | "verify" | "stopped";

export interface GovernorConfig {
  warmupSec: number;
  windowSec: number;
  settleSec: number;
  slowFps: number;
  /** A step must raise the frame rate by at least this share, else it is undone. */
  minGain: number;
}

export class QualityGovernor {
  private phase: GovernorPhase = "warmup";
  private elapsed = 0;
  private frames: number[] = [];
  private fpsBeforeStep = 0;
  /** Last measured frame rate, for the debug panel. */
  lastFps = 0;
  reason = "";

  constructor(
    /** Pixel ratios from best to worst. */
    readonly steps: readonly number[],
    private index: number,
    private readonly cfg: GovernorConfig,
  ) {}

  get ratio(): number {
    return this.steps[this.index] as number;
  }

  get state(): GovernorPhase {
    return this.phase;
  }

  /** A new match began: loading and the opening shot are not play, so warm up again. */
  restart(): void {
    if (this.phase === "stopped") return;
    this.phase = "warmup";
    this.elapsed = 0;
    this.frames = [];
  }

  /** Feed one rendered frame. Returns the new pixel ratio when it changes, else null. */
  frame(dtSec: number): number | null {
    if (this.phase === "stopped") return null;
    // A frame over a second is a tab switch or a breakpoint, not the device;
    // anything shorter counts, however slow, since slow devices are the point.
    if (dtSec <= 0 || dtSec > 1) return null;
    this.elapsed += dtSec;
    const c = this.cfg;
    if (this.phase === "warmup" || this.phase === "settle") {
      if (this.elapsed >= (this.phase === "warmup" ? c.warmupSec : c.settleSec)) {
        this.phase = this.phase === "warmup" ? "measure" : "verify";
        this.elapsed = 0;
        this.frames = [];
      }
      return null;
    }
    this.frames.push(dtSec);
    if (this.elapsed < c.windowSec) return null;
    const fps = 1 / median(this.frames);
    this.lastFps = fps;
    this.elapsed = 0;
    this.frames = [];

    if (this.phase === "verify" && fps < this.fpsBeforeStep * (1 + c.minGain)) {
      // Fewer pixels did not help: pixels are not the limit. Undo and stop.
      this.index -= 1;
      this.phase = "stopped";
      this.reason = `降解析度沒有變快（${this.fpsBeforeStep.toFixed(0)}→${fps.toFixed(0)} fps），已還原`;
      return this.ratio;
    }
    if (fps >= c.slowFps) {
      this.phase = "measure";
      return null;
    }
    if (this.index >= this.steps.length - 1) {
      this.phase = "stopped";
      this.reason = `已是最低解析度（${fps.toFixed(0)} fps）`;
      return null;
    }
    this.fpsBeforeStep = fps;
    this.index += 1;
    this.phase = "settle";
    return this.ratio;
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Pixel ratios to try on this device: its own (capped) first, then the tuning's steps below it. */
export function ratioSteps(devicePixelRatio: number): number[] {
  const q = CLIENT_TUNING.quality;
  const top = Math.min(devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio);
  return [top, ...q.ratioSteps.filter((r) => r < top - 0.01)];
}

const KEY = "supermaze.quality";

/** The pixel ratio this browser settled on last time, if any. */
export function rememberedRatio(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function rememberRatio(ratio: number | null): void {
  try {
    if (ratio === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(ratio));
  } catch {
    /* storage unavailable */
  }
}

/** Antialiasing is fixed when the renderer is made: off once this browser has had to go to 1× or below. */
export function antialiasAtLaunch(): boolean {
  const r = rememberedRatio();
  return r === null || r > CLIENT_TUNING.quality.antialiasAboveRatio;
}

/** The governor for this page, or null when the pixel ratio is forced (`?dpr=`) or auto quality is off. */
export function createGovernor(devicePixelRatio: number): QualityGovernor | null {
  const q = CLIENT_TUNING.quality;
  if (!q.enabled) return null;
  const steps = ratioSteps(devicePixelRatio);
  const remembered = rememberedRatio();
  // Start at the remembered step (or the nearest below it), else at the top.
  let index = 0;
  if (remembered !== null) {
    index = steps.findIndex((r) => r <= remembered + 0.01);
    if (index < 0) index = steps.length - 1;
  }
  return new QualityGovernor(steps, index, q);
}

let active: QualityGovernor | null = null;

/** Make `g` the page's governor (main.ts, once). */
export function installQuality(g: QualityGovernor | null): void {
  active = g;
}

/** Called when a match starts: its loading and opening shot are not measured. */
export function restartQuality(): void {
  active?.restart();
}

/** Called every rendered frame with the real frame time; applies and remembers a new pixel ratio. */
export function qualityFrame(renderer: { setPixelRatio(r: number): void }, dtSec: number): void {
  const r = active?.frame(dtSec) ?? null;
  if (r === null) return;
  renderer.setPixelRatio(r);
  rememberRatio(r);
}

/** One line for the F3 panel. */
export function qualityStatus(): string {
  if (!active) return "manual";
  const fps = active.lastFps ? ` ${active.lastFps.toFixed(0)}fps` : "";
  return `auto x${active.ratio} ${active.state}${fps}${active.reason ? ` (${active.reason})` : ""}`;
}
