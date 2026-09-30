import { CLIENT_TUNING } from "../tuning.js";

/**
 * Sound effects. Files live in public/sounds/ and are plain static assets: a
 * designer replaces a sound by overwriting the file of the same name. Missing
 * files are skipped silently. Nothing here knows any game rule; `sounds.ts`
 * decides what to play from state differences.
 */
export const SOUND_FILES = {
  key: "key.wav",
  box: "box.wav",
  trap: "trap.wav",
  lightOn: "light-on.wav",
  lightOff: "light-off.wav",
  caught: "caught.wav",
  catch: "catch.wav",
  climb: "climb.wav",
} as const;

export type SoundName = keyof typeof SOUND_FILES;

const MUTE_KEY = "supermaze.muted";

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly raw = new Map<SoundName, ArrayBuffer>();
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private muted = false;
  private started = false;
  private readonly unlockListeners: ((ctx: AudioContext, master: GainNode) => void)[] = [];

  /**
   * Fetch the files and wait for the first tap or key press: browsers only
   * allow audio after a user gesture. `M` toggles mute; `?mute` starts muted.
   */
  init(): void {
    if (this.started) return;
    this.started = true;
    this.muted = new URLSearchParams(location.search).has("mute") || safeGet(MUTE_KEY) === "1";
    const base = `${import.meta.env.BASE_URL}sounds/`;
    for (const [name, file] of Object.entries(SOUND_FILES) as [SoundName, string][]) {
      void fetch(base + file)
        .then((r) => (r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? r.arrayBuffer() : null))
        .then((data) => {
          if (!data) return;
          this.raw.set(name, data);
          if (this.ctx) this.decode(name);
        })
        .catch(() => undefined);
    }
    const unlock = (): void => {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : CLIENT_TUNING.audio.volume;
        this.master.connect(this.ctx.destination);
        for (const name of this.raw.keys()) this.decode(name);
        for (const f of this.unlockListeners) f(this.ctx, this.master);
      }
      void this.ctx.resume();
    };
    // Nothing plays while the page is hidden (another tab, the phone locked).
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    for (const type of ["pointerdown", "touchend", "keydown"]) window.addEventListener(type, unlock, { passive: true });
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM" && !(e.target instanceof HTMLInputElement)) this.setMuted(!this.muted);
    });
  }

  /**
   * Call `f` with the audio context and the master gain once audio is allowed
   * (right away if it already is). Music plays through the same master, so
   * muting silences it too.
   */
  onUnlock(f: (ctx: AudioContext, master: GainNode) => void): void {
    if (this.ctx && this.master) f(this.ctx, this.master);
    else this.unlockListeners.push(f);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    safeSet(MUTE_KEY, muted ? "1" : "0");
    if (this.master) this.master.gain.value = muted ? 0 : CLIENT_TUNING.audio.volume;
  }

  /** Play once; `volume` is relative to the master volume. Silent until unlocked and loaded. */
  play(name: SoundName, volume = 1): void {
    const buffer = this.buffers.get(name);
    if (!this.ctx || !this.master || !buffer || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.master);
    src.start();
  }

  private decode(name: SoundName): void {
    const data = this.raw.get(name);
    if (!data || !this.ctx || this.buffers.has(name)) return;
    // decodeAudioData detaches the buffer it is given; keep ours for a later context.
    void this.ctx.decodeAudioData(data.slice(0)).then((b) => this.buffers.set(name, b)).catch(() => undefined);
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

export const sfx = new Sfx();
