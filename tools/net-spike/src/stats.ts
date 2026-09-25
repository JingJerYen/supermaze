/** Small numeric summary helper for the spike report. */
export function summarize(values: number[]): { n: number; mean: number; p50: number; p95: number; max: number } {
  if (values.length === 0) return { n: 0, mean: 0, p50: 0, p95: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { n: sorted.length, mean, p50: pick(0.5), p95: pick(0.95), max: sorted[sorted.length - 1] as number };
}

export function fmt(s: ReturnType<typeof summarize>, unit = "ms"): string {
  return `n=${s.n} mean=${s.mean.toFixed(2)}${unit} p50=${s.p50.toFixed(2)}${unit} p95=${s.p95.toFixed(2)}${unit} max=${s.max.toFixed(2)}${unit}`;
}
