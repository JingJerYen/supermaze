/**
 * Placeholder background music, composed in code and rendered once into an
 * audio buffer (no file, nothing to download). It stands in until a real track
 * is dropped into public/music/ under the same name. Each is an exact loop:
 * every note ends before the last bar does.
 */
export type TrackName = "menu" | "game";

interface Plan {
  bpm: number;
  /** Chord roots as MIDI notes, one per bar; minor chords marked. */
  bars: { root: number; minor: boolean }[];
  /** A gentle beat under the game track; none under the menu. */
  pulse: boolean;
}

const C = 48;
const PLANS: Record<TrackName, Plan> = {
  // Relaxed: Am F C G twice, arpeggios over a soft bass, no beat.
  menu: {
    bpm: 88,
    bars: [
      { root: C + 9, minor: true },
      { root: C + 5, minor: false },
      { root: C, minor: false },
      { root: C + 7, minor: false },
      { root: C + 9, minor: true },
      { root: C + 5, minor: false },
      { root: C + 7, minor: false },
      { root: C + 7, minor: false },
    ],
    pulse: false,
  },
  // Light and steady, to walk the maze to without distraction: C Am F G twice,
  // soft eighth-note arpeggios, a sparse tune and only a gentle pulse.
  game: {
    bpm: 100,
    bars: [
      { root: C, minor: false },
      { root: C + 9, minor: true },
      { root: C + 5, minor: false },
      { root: C + 7, minor: false },
      { root: C, minor: false },
      { root: C + 9, minor: true },
      { root: C + 5, minor: false },
      { root: C + 7, minor: false },
    ],
    pulse: true,
  },
};

/** A sparse tune over the chords for the game track: steps above each bar's root, per quarter note (null for a rest). */
const MELODY: (number | null)[] = [7, null, 4, null, 9, null, 7, null];

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export async function renderPlaceholder(name: TrackName, sampleRate: number): Promise<AudioBuffer> {
  const plan = PLANS[name];
  const beat = 60 / plan.bpm;
  const seconds = plan.bars.length * 4 * beat;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(ctx.destination);
  const noise = noiseBuffer(ctx);

  const tone = (type: OscillatorType, midi: number, t: number, dur: number, vol: number, pan = 0): void => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
    o.start(t);
    o.stop(t + dur + 0.01);
  };
  const hit = (t: number, dur: number, vol: number, filter: BiquadFilterType, freq: number): void => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.01);
  };
  const kick = (t: number): void => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
  };

  plan.bars.forEach((bar, b) => {
    const t0 = b * 4 * beat;
    const chord = [0, bar.minor ? 3 : 4, 7, 12].map((i) => bar.root + i);
    const eighth = beat / 2;
    // Bass: root and fifth an octave down, on the beats.
    for (let q = 0; q < 4; q++) {
      const note = bar.root - 12 + (q === 2 ? 7 : 0);
      tone("triangle", note, t0 + q * beat, beat * 0.9, plan.pulse ? 0.24 : 0.34);
    }
    // Arpeggio: up and down the chord an octave above, soft eighths.
    const order = [0, 1, 2, 3, 2, 1, 0, 1];
    for (let i = 0; i < 8; i++) {
      const note = (chord[order[i] as number] as number) + 12;
      tone("triangle", note, t0 + i * eighth, eighth * 0.85, plan.pulse ? 0.08 : 0.16, i % 2 ? 0.3 : -0.3);
    }
    // A soft held chord underneath.
    for (const n of chord.slice(0, 3)) tone("sine", n + 12, t0, 4 * beat * 0.95, plan.pulse ? 0.05 : 0.09);
    if (!plan.pulse) return;
    // A sparse tune on alternate bars.
    if (b % 2 === 0) {
      MELODY.slice(0, 4).forEach((m, q) => {
        // On a minor chord the major third steps down a semitone.
        const deg = m !== null && bar.minor && m === 4 ? 3 : m;
        if (deg !== null) tone("sine", bar.root + 24 + deg, t0 + q * beat, beat * 1.6, 0.07);
      });
    } else {
      MELODY.slice(4).forEach((m, q) => {
        if (m !== null) tone("sine", bar.root + 24 + m, t0 + q * beat, beat * 1.6, 0.06);
      });
    }
    // A gentle pulse: a soft low kick on 1 and 3 and a faint shaker between; no snare.
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      if (q % 2 === 0) kick(t);
      hit(t + eighth, 0.04, 0.02, "highpass", 8000);
    }
  });
  return ctx.startRendering();
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return buf;
}
