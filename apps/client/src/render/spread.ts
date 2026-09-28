/** Where a character is drawn from, world units (y is height). */
export interface SpreadPoint {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface SpreadTuning {
  radius: number;
  spacing: number;
  maxRing: number;
}

/**
 * On-screen offsets that keep overlapping characters apart (CLAUDE.md section
 * 6). Pure geometry, no rendering: points closer than `radius` form a group;
 * two stand side by side, three or more evenly round a circle no wider than
 * `maxRing`, so a crowd on one tile stays inside that tile. Each offset scales
 * with how close the point is to its nearest neighbour, which makes the
 * result continuous as characters approach or part. Points on their own get
 * no entry. Deterministic: slots go by id.
 */
export function spreadTargets(points: readonly SpreadPoint[], t: SpreadTuning): Map<string, { x: number; z: number }> {
  const sorted = [...points].sort((a, b) => a.id.localeCompare(b.id));
  const group = new Map<string, SpreadPoint[]>();
  for (const p of sorted) group.set(p.id, [p]);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!, b = sorted[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= t.radius) continue;
      const ga = group.get(a.id)!, gb = group.get(b.id)!;
      if (ga === gb) continue;
      for (const p of gb) {
        ga.push(p);
        group.set(p.id, ga);
      }
    }
  }

  const out = new Map<string, { x: number; z: number }>();
  for (const members of new Set(group.values())) {
    const n = members.length;
    if (n < 2) continue;
    members.sort((a, b) => a.id.localeCompare(b.id));
    const ring = n === 2 ? t.spacing / 2 : Math.min(t.maxRing, t.spacing / (2 * Math.sin(Math.PI / n)));
    members.forEach((p, i) => {
      const angle = n === 2 ? (i === 0 ? Math.PI : 0) : (i / n) * Math.PI * 2 - Math.PI / 2;
      // 0 when the nearest neighbour is a full `radius` away (the moment a group forms), 1 when on top of it.
      const nearest = Math.min(...members.filter((q) => q !== p).map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)));
      const near = Math.max(0, 1 - nearest / t.radius);
      out.set(p.id, { x: Math.cos(angle) * ring * near, z: Math.sin(angle) * ring * near });
    });
  }
  return out;
}
