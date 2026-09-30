"""Procedural placeholder sound effects. Usage: python3 scripts/sfx_gen.py apps/client/public/sounds

Writes small 16-bit mono WAV files. Designers can overwrite any of them with a
file of the same name; the game only cares about the names.
"""
import math, os, random, struct, sys, wave

RATE = 22050
random.seed(7)

def env(t, dur, attack=0.005, release=0.08):
    if t < attack: return t / attack
    if t > dur - release: return max(0.0, (dur - t) / release)
    return 1.0

def tone(freq, dur, vol=0.5, shape="sine", decay=0.0, glide=0.0, start=0.0):
    """One voice. `glide` is the frequency change in Hz over the whole note; `decay` an exponential fade."""
    n = int(dur * RATE); out = [0.0] * n; phase = 0.0
    for i in range(n):
        t = i / RATE
        f = freq + glide * (t / dur)
        phase += 2 * math.pi * f / RATE
        if shape == "sine": v = math.sin(phase)
        elif shape == "square": v = 1.0 if math.sin(phase) >= 0 else -1.0
        elif shape == "tri": v = 2 / math.pi * math.asin(math.sin(phase))
        else: v = math.sin(phase) + 0.5 * math.sin(2 * phase) + 0.25 * math.sin(3 * phase)
        out[i] = v * vol * env(t, dur) * math.exp(-decay * t)
    return (start, out)

def noise(dur, vol=0.5, decay=20.0, lowpass=0.0, start=0.0):
    n = int(dur * RATE); out = [0.0] * n; prev = 0.0
    for i in range(n):
        t = i / RATE
        v = random.uniform(-1, 1)
        if lowpass > 0: prev += (v - prev) * lowpass; v = prev
        out[i] = v * vol * math.exp(-decay * t) * env(t, dur, 0.001, 0.02)
    return (start, out)

def mix(*voices):
    total = max(int(s * RATE) + len(v) for s, v in voices)
    buf = [0.0] * total
    for s, v in voices:
        o = int(s * RATE)
        for i, x in enumerate(v): buf[o + i] += x
    peak = max(1e-9, max(abs(x) for x in buf))
    gain = min(1.0, 0.89 / peak)
    return [x * gain for x in buf]

def write(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x)) * 32767)) for x in samples))
    print(f"{os.path.basename(path):14s} {len(samples) / RATE:.2f}s {os.path.getsize(path) / 1024:.0f} KB")

SOUNDS = {
    # Key: a bright three-note rise with a shimmer on top.
    "key.wav": lambda: mix(
        tone(988, 0.12, 0.5, "tri", decay=6), tone(1319, 0.12, 0.5, "tri", decay=6, start=0.09),
        tone(1976, 0.45, 0.55, "sine", decay=5, start=0.18), tone(3951, 0.4, 0.15, "sine", decay=8, start=0.18)),
    # Box: a wooden pop, then two quick sparkles.
    "box.wav": lambda: mix(
        noise(0.08, 0.6, decay=45, lowpass=0.35), tone(220, 0.12, 0.5, "sine", decay=25, glide=-120),
        tone(1047, 0.1, 0.35, "tri", decay=12, start=0.07), tone(1568, 0.22, 0.35, "tri", decay=9, start=0.13)),
    # Trap: the cage slamming down. A metallic clang (inharmonic partials) over a low thud and a rattle.
    "trap.wav": lambda: mix(
        tone(90, 0.25, 0.8, "sine", decay=14, glide=-40), noise(0.12, 0.5, decay=30, lowpass=0.6),
        tone(523, 0.6, 0.3, "sine", decay=6), tone(787, 0.6, 0.25, "sine", decay=7), tone(1243, 0.5, 0.2, "sine", decay=9),
        tone(1867, 0.4, 0.15, "sine", decay=11), noise(0.05, 0.25, decay=60, start=0.12), noise(0.05, 0.18, decay=60, start=0.2)),
    # Lights off: a click and a hum winding down.
    "light-off.wav": lambda: mix(
        noise(0.03, 0.7, decay=120), tone(440, 0.5, 0.45, "saw", decay=4, glide=-330, start=0.02), tone(110, 0.5, 0.3, "sine", decay=3, glide=-50, start=0.02)),
    # Lights on: a click and a hum winding up into a soft chord.
    "light-on.wav": lambda: mix(
        noise(0.03, 0.7, decay=120), tone(140, 0.35, 0.4, "saw", decay=3, glide=380, start=0.02),
        tone(659, 0.35, 0.3, "sine", decay=6, start=0.3), tone(988, 0.35, 0.25, "sine", decay=6, start=0.3)),
    # Caught by a ghost: a wobbling wail falling away, with a dull hit at the start.
    "caught.wav": lambda: mix(
        noise(0.1, 0.5, decay=35, lowpass=0.25), tone(70, 0.2, 0.6, "sine", decay=15),
        wail(620, 250, 0.8, 0.45), wail(930, 370, 0.8, 0.2)),
    # You caught someone (as the ghost): short rising sting.
    "catch.wav": lambda: mix(
        tone(330, 0.1, 0.45, "square", decay=10), tone(494, 0.1, 0.45, "square", decay=10, start=0.08),
        tone(740, 0.3, 0.5, "tri", decay=6, start=0.16)),
    # Reaching the tower top: a small fanfare.
    "climb.wav": lambda: mix(
        tone(523, 0.14, 0.45, "tri", decay=5), tone(659, 0.14, 0.45, "tri", decay=5, start=0.12),
        tone(784, 0.14, 0.45, "tri", decay=5, start=0.24), tone(1047, 0.6, 0.5, "tri", decay=3.5, start=0.36),
        tone(784, 0.6, 0.25, "sine", decay=3.5, start=0.36), tone(1319, 0.6, 0.2, "sine", decay=4, start=0.36)),
    # Menu button: a soft, short bubbly tick.
    "click.wav": lambda: mix(
        tone(880, 0.07, 0.5, "sine", decay=55, glide=500), tone(1760, 0.04, 0.12, "sine", decay=80)),
}

def wail(f0, f1, dur, vol):
    n = int(dur * RATE); out = [0.0] * n; phase = 0.0
    for i in range(n):
        t = i / RATE
        f = f0 + (f1 - f0) * (t / dur) ** 0.7 + 18 * math.sin(2 * math.pi * 7 * t)
        phase += 2 * math.pi * f / RATE
        out[i] = math.sin(phase) * vol * env(t, dur, 0.02, 0.25)
    return (0.05, out)

if __name__ == "__main__":
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    for name, make in SOUNDS.items():
        write(os.path.join(out_dir, name), make())
