import { CLIENT_TUNING } from "../tuning.js";
import { renderPlaceholder, type TrackName } from "./placeholderMusic.js";
import { sfx } from "./sfx.js";

/**
 * Background music: one track on the home screen, one in a match, each looped
 * without a gap. A match plays its map theme's own track when there is one
 * (`game-candy`, ...), else the shared match track. A track is
 * public/music/<name>.m4a or .mp3 when there is one (a designer drops the file
 * in), else a placeholder composed in code. A file
 * that is not a seamless loop (a song with an intro and an ending) has its
 * silent ends trimmed and its last seconds blended into its start, so it loops
 * smoothly too. It plays through the sound effects' master gain, so muting
 * silences both; it pauses with them while the page is hidden. The rate can be
 * raised a little for tension (a round's last seconds, a ghost chase).
 */
class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private readonly buffers = new Map<TrackKey, AudioBuffer>();
  private readonly loading = new Map<TrackKey, Promise<AudioBuffer>>();
  private wanted: TrackKey | null = null;
  private current: { track: TrackKey; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private rate = 1;
  private enabled = false;

  init(): void {
    const volume = CLIENT_TUNING.audio.musicVolume;
    this.enabled = volume > 0 && !new URLSearchParams(location.search).has("nomusic");
    if (!this.enabled) return;
    sfx.onUnlock((ctx, master) => {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = volume;
      this.out.connect(master);
      if (this.wanted) void this.load(this.wanted);
      this.apply();
    });
  }

  /** Switch to `track` (null for silence), fading between them. */
  play(track: TrackKey | null): void {
    if (!this.enabled) return;
    this.wanted = track;
    if (track && this.ctx) void this.load(track);
    this.apply();
  }

  /** Playback rate, 1 normal; eased so a change never jumps. */
  setRate(rate: number): void {
    if (rate === this.rate) return;
    this.rate = rate;
    if (this.ctx && this.current) this.current.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, CLIENT_TUNING.audio.musicRateEaseSec / 3);
  }

  /** The track's buffer, fetched or composed once; playback follows as soon as it is ready. */
  private load(track: TrackKey): Promise<AudioBuffer> {
    let pending = this.loading.get(track);
    if (!pending) {
      pending = this.decode(this.ctx as AudioContext, track);
      this.loading.set(track, pending);
      void pending.then((buffer) => {
        this.buffers.set(track, buffer);
        this.apply();
      });
    }
    return pending;
  }

  private async decode(ctx: AudioContext, track: TrackKey): Promise<AudioBuffer> {
    const data = await fetchFirst([`music/${track}.m4a`, `music/${track}.mp3`]);
    if (data) {
      try {
        return loopable(ctx, await ctx.decodeAudioData(data), CLIENT_TUNING.audio.musicLoopBlendSec);
      } catch {
        /* undecodable file: fall back as if there were none */
      }
    }
    const fallback = fallbackTrack(track);
    return fallback ? this.load(fallback) : renderPlaceholder(track as TrackName, ctx.sampleRate);
  }

  /** Bring what is playing in line with what is wanted. */
  private apply(): void {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    if (this.current?.track === this.wanted) return;
    const fade = CLIENT_TUNING.audio.musicFadeSec;
    const now = ctx.currentTime;
    if (this.current) {
      const { src, gain } = this.current;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fade);
      src.stop(now + fade + 0.05);
      this.current = null;
    }
    const buffer = this.wanted ? this.buffers.get(this.wanted) : undefined;
    if (!this.wanted || !buffer) return; // starts when it has loaded
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = this.rate;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    src.connect(gain).connect(out);
    src.start(now);
    this.current = { track: this.wanted, src, gain };
  }
}

/** The first of `urls` that exists, as bytes; null when none does (the dev server answers a missing file with the page). */
async function fetchFirst(urls: string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}${url}`);
      if (r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")) return await r.arrayBuffer();
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/**
 * Make `input` loop seamlessly: trim silence from both ends, then blend its
 * last `blendSec` into its first `blendSec` and start the loop just after
 * them. The result, played with `loop`, runs straight from its end back into
 * its start with no gap and no jump.
 */
export function loopable(ctx: BaseAudioContext, input: AudioBuffer, blendSec: number): AudioBuffer {
  const channels = Array.from({ length: input.numberOfChannels }, (_, c) => input.getChannelData(c));
  const loud = (i: number) => channels.some((d) => Math.abs(d[i] as number) > 1e-3);
  let start = 0;
  let end = input.length;
  while (start < end && !loud(start)) start++;
  while (end > start && !loud(end - 1)) end--;
  const length = end - start;
  const blend = Math.min(Math.round(blendSec * input.sampleRate), Math.floor(length / 3));
  if (blend <= 0) return input;
  const outLength = length - blend;
  const out = ctx.createBuffer(input.numberOfChannels, outLength, input.sampleRate);
  channels.forEach((src, c) => {
    const dst = out.getChannelData(c);
    for (let j = 0; j < outLength; j++) dst[j] = src[start + blend + j] as number;
    // The last `blend` samples fade out while the opening fades in under them.
    for (let k = 0; k < blend; k++) {
      const j = outLength - blend + k;
      const fadeIn = k / blend;
      dst[j] = (src[start + blend + j] as number) * (1 - fadeIn) + (src[start + k] as number) * fadeIn;
    }
  });
  return out;
}

/** "menu", "game", or a theme's own match track, "game-<theme id>". */
export type TrackKey = TrackName | `game-${string}`;

/** Themes that play another theme's track (one file, no copy in the app). Every theme has its own now. */
const SHARED_TRACKS: Record<string, TrackKey> = {};

/** The track to play instead when `track` has no file: a theme sharing another's track takes that one, any other theme's match track falls back to the shared one. */
export function fallbackTrack(track: TrackKey): TrackKey | null {
  if (track === "menu" || track === "game") return null;
  return SHARED_TRACKS[track] ?? "game";
}

export const music = new Music();
export type { TrackName };
