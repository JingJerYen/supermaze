"""Map drafting kit: a canvas for carving lattice mazes, a checker that mirrors the
sim's movement rules (including fixtures), automatic candidate placement and an
SVG/PNG preview. Pure Python 3; the preview needs `rsvg-convert`."""
import json
import random
import subprocess
from collections import deque
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MAPS_DIR = REPO / "content" / "maps"
OUT_DIR = HERE / "out"

D4 = [(1, 0), (-1, 0), (0, 1), (0, -1)]
BASE = {"K": ".", "B": ".", "L": ".", "k": "#", "b": "#", "O": ".", "o": "#", "A": ".", "a": "#",
        "^": ".", "v": ".", "<": ".", ">": "."}
DOORS = {"^": (0, -1), "v": (0, 1), "<": (-1, 0), ">": (1, 0)}
DOOR_CHAR = {d: c for c, d in DOORS.items()}


# ------------------------------------------------------------------ canvas
class Canvas:
    """A grid that starts as solid wall. Coordinates are (x, y), y down."""

    def __init__(self, w=43, h=31):
        self.w, self.h = w, h
        self.cx, self.cy = w // 2, h // 2
        self.g = [["#"] * w for _ in range(h)]

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else "X"

    def put(self, x, y, c="."):
        self.g[y][x] = c

    def hline(self, x0, x1, y, c="."):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.g[y][x] = c

    def vline(self, x, y0, y1, c="."):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.g[y][x] = c

    def rect(self, x0, x1, y0, y1, c="."):
        self.hline(x0, x1, y0, c); self.hline(x0, x1, y1, c)
        self.vline(x0, y0, y1, c); self.vline(x1, y0, y1, c)

    def tower(self):
        """3x3 tower at the centre with a one-wide plaza ring round it."""
        cx, cy = self.cx, self.cy
        self.rect(cx - 2, cx + 2, cy - 2, cy + 2)
        for y in range(cy - 1, cy + 2):
            for x in range(cx - 1, cx + 2):
                self.put(x, y, "T")

    def rows(self):
        return ["".join(r) for r in self.g]

    def maze(self, cells, seed, bias=None, loops=0, start=None, algo="dfs"):
        """Carve a depth-first lattice maze over a set of (odd, odd) junctions.

        bias(a, b) weights the step a -> b (higher is preferred), e.g. to make
        corridors follow rings. `loops` extra walls between junctions are then
        opened, each one adding a cycle (and splitting the rooftop).
        algo="prim" grows the maze from random frontier cells instead: many
        short side branches and dead ends rather than long corridors."""
        rnd = random.Random(seed)
        cells = set(cells)
        for x, y in cells:
            self.put(x, y)
        start = start or min(cells)
        seen = {start}
        if algo == "prim":
            self._prim(cells, seen, rnd)
            stack = []
        else:
            stack = [start]
        while stack:
            cx, cy = stack[-1]
            nb = [(cx + dx, cy + dy) for dx, dy in [(2, 0), (-2, 0), (0, 2), (0, -2)]
                  if (cx + dx, cy + dy) in cells and (cx + dx, cy + dy) not in seen]
            if not nb:
                stack.pop()
                continue
            n = rnd.choices(nb, [bias((cx, cy), p) for p in nb])[0] if bias else rnd.choice(nb)
            self.put((cx + n[0]) // 2, (cy + n[1]) // 2)
            seen.add(n)
            stack.append(n)
        walls = [((a[0] + b[0]) // 2, (a[1] + b[1]) // 2) for a in cells for b in [(a[0] + 2, a[1]), (a[0], a[1] + 2)]
                 if b in cells and self.get((a[0] + b[0]) // 2, (a[1] + b[1]) // 2) == "#"]
        for x, y in rnd.sample(sorted(walls), min(loops, len(walls))):
            self.put(x, y)


    def braid(self, cells, seed):
        """Open walls until no junction is a dead end: every junction gets at
        least two ways out, so a chase can always go round (the night parade's
        maps, CLAUDE.md 4.4). A dead end opens toward a neighbouring dead end
        when it has one, otherwise toward any neighbour."""
        rnd = random.Random(seed)
        cells = set(cells)
        steps = [(2, 0), (-2, 0), (0, 2), (0, -2)]
        open_ways = lambda c: sum(self.get(c[0] + dx // 2, c[1] + dy // 2) != "#" for dx, dy in steps)
        for c in sorted(cells):
            if open_ways(c) > 1:
                continue
            shut = [(c[0] + dx, c[1] + dy) for dx, dy in steps
                    if (c[0] + dx, c[1] + dy) in cells and self.get(c[0] + dx // 2, c[1] + dy // 2) == "#"]
            if not shut:
                continue
            dead = [n for n in shut if open_ways(n) <= 1]
            n = rnd.choice(dead or shut)
            self.put((c[0] + n[0]) // 2, (c[1] + n[1]) // 2)

    def _prim(self, cells, seen, rnd):
        steps = [(2, 0), (-2, 0), (0, 2), (0, -2)]
        frontier = sorted({(a[0] + dx, a[1] + dy) for a in seen for dx, dy in steps} & cells - seen)
        while frontier:
            n = frontier.pop(rnd.randrange(len(frontier)))
            if n in seen:
                continue
            links = [(n[0] + dx, n[1] + dy) for dx, dy in steps if (n[0] + dx, n[1] + dy) in seen]
            a = rnd.choice(links)
            self.put((a[0] + n[0]) // 2, (a[1] + n[1]) // 2)
            seen.add(n)
            for dx, dy in steps:
                m = (n[0] + dx, n[1] + dy)
                if m in cells and m not in seen and m not in frontier:
                    frontier.append(m)


def stamp(rows, cells):
    """Overwrite single cells: `cells` is a list of (x, y, char)."""
    g = [list(r) for r in rows]
    for x, y, ch in cells:
        g[y][x] = ch
    return ["".join(r) for r in g]


# ------------------------------------------------------------------ analysis
class Map:
    """Walkability graph that mirrors MapGrid.tryMove plus the placeable veto
    (obstacles block; a one-way door is entered and left only along its arrow)."""

    def __init__(self, rows):
        self.rows = rows
        self.h, self.w = len(rows), len(rows[0])
        tower = self.tower()
        if tower:
            self.cx = (min(x for x, _ in tower) + max(x for x, _ in tower)) // 2
            self.cy = (min(y for _, y in tower) + max(y for _, y in tower)) // 2
        else:
            self.cx, self.cy = self.w // 2, self.h // 2

    def raw(self, x, y):
        return self.rows[y][x] if 0 <= x < self.w and 0 <= y < self.h else "X"

    def cell(self, x, y):
        r = self.raw(x, y)
        return BASE.get(r, r)

    @staticmethod
    def walk(c, layer):
        return (c == "." and layer == "r") or (c == "#" and layer == "w") or c in "S="

    def fixture(self, x, y, layer):
        r = self.raw(x, y)
        if layer == "r" and r in "OA^v<>":
            return r
        if layer == "w" and r in "oa":
            return r
        return None

    def moves(self, x, y, layer, strict):
        for dx, dy in D4:
            nx, ny = x + dx, y + dy
            if self.walk(self.cell(nx, ny), layer):
                nl = layer
            elif self.cell(x, y) == "S":
                nl = "w" if layer == "r" else "r"
                if not self.walk(self.cell(nx, ny), nl):
                    continue
            else:
                continue
            if strict:
                here, ahead = self.fixture(x, y, layer), self.fixture(nx, ny, nl)
                if ahead in ("O", "o"):
                    continue
                if ahead in DOORS and DOORS[ahead] != (dx, dy):
                    continue
                if here in DOORS and DOORS[here] != (dx, dy):
                    continue
            yield nx, ny, nl

    def tower(self):
        return [(x, y) for y in range(self.h) for x in range(self.w) if self.cell(x, y) == "T"]

    def entries(self):
        """Road tiles next to the tower: the spawn tiles."""
        return {(x + dx, y + dy) for x, y in self.tower() for dx, dy in D4 if self.cell(x + dx, y + dy) == "."}

    def bfs(self, starts, strict, reverse=False):
        radj = {}
        if reverse:
            for y in range(self.h):
                for x in range(self.w):
                    for layer in "rw":
                        if self.walk(self.cell(x, y), layer):
                            for n in self.moves(x, y, layer, strict):
                                radj.setdefault(n, []).append((x, y, layer))
        starts = sorted(starts)  # fixed order: set iteration depends on the string hash seed
        d = {s: 0 for s in starts}
        q = deque(starts)
        while q:
            p = q.popleft()
            for n in (radj.get(p, []) if reverse else self.moves(*p, strict)):
                if n not in d:
                    d[n] = d[p] + 1
                    q.append(n)
        return d

    def wall_components(self):
        """Connected wall-top regions (walls and bridge tops), keyed by (x, y)."""
        comp, n = {}, 0
        for y in range(self.h):
            for x in range(self.w):
                if self.cell(x, y) in "#=" and (x, y) not in comp:
                    n += 1
                    comp[(x, y)] = n
                    q = deque([(x, y)])
                    while q:
                        a, b = q.popleft()
                        for dx, dy in D4:
                            m = (a + dx, b + dy)
                            if self.cell(*m) in "#=" and m not in comp:
                                comp[m] = n
                                q.append(m)
        return comp

    def check(self, verbose=True):
        """Terrain rules, plus fairness with fixtures: every tile you can reach has
        a way back to the tower, and every candidate is reachable without a hammer.
        Leaves the fixture-aware distances from the spawn tiles in self.fwd."""
        errs = []
        c = self.cell
        for y in range(self.h):
            for x in range(self.w):
                k = c(x, y)
                if k == "S":
                    ws = [(dx, dy) for dx, dy in D4 if c(x + dx, y + dy) == "#"]
                    if len(ws) != 1:
                        errs.append(f"stairs {x},{y}: {len(ws)} walls")
                    elif c(x - ws[0][0], y - ws[0][1]) != ".":
                        errs.append(f"stairs {x},{y}: no road opposite")
                if k == "=":
                    if not any(c(x + dx, y + dy) == "#" and c(x - dx, y - dy) == "#"
                               and c(x + dy, y + dx) in ".S=" and c(x - dy, y - dx) in ".S="
                               for dx, dy in [(1, 0), (0, 1)]):
                        errs.append(f"bridge {x},{y} bad")
                r = self.raw(x, y)
                if r in "OAoa^v<>KkBbL" and any(c(x + dx, y + dy) == "T" for dx, dy in D4):
                    errs.append(f"marker {r} at {x},{y} touches the tower")
        spawn = {(x, y, "r") for x, y in self.entries()}
        loose = self.bfs(spawn, False)
        for y in range(self.h):
            for x in range(self.w):
                if c(x, y) in ".S" and (x, y, "r") not in loose:
                    errs.append(f"road {x},{y} unreachable")
        fwd = self.bfs(spawn, True)
        back = self.bfs(spawn, True, reverse=True)
        stuck = [p for p in fwd if p not in back]
        if stuck:
            errs.append(f"{len(stuck)} tiles reachable but no way back, e.g. {stuck[:5]}")
        for y in range(self.h):
            for x in range(self.w):
                r = self.raw(x, y)
                if r in "KkBbL" and (x, y, "r" if r in "KBL" else "w") not in fwd:
                    errs.append(f"{r} at {x},{y} needs a hammer (or is unreachable)")
        if verbose:
            print("errors:", errs or "none")
        self.fwd = fwd
        return errs

    def stair_spots(self):
        """Road tiles where stairs are legal, grouped by the wall-top region they rise onto."""
        comp, out = self.wall_components(), {}
        for y in range(self.h):
            for x in range(self.w):
                if self.cell(x, y) != ".":
                    continue
                ws = [(dx, dy) for dx, dy in D4 if self.cell(x + dx, y + dy) == "#"]
                if len(ws) == 1 and self.cell(x - ws[0][0], y - ws[0][1]) == ".":
                    out.setdefault(comp[(x + ws[0][0], y + ws[0][1])], []).append((x, y))
        return comp, out


# ------------------------------------------------------------------ candidates
def spread_pick(pool, n, min_gap, score, taken, taken_gap=None, quad_cap=None, centre=(21, 15)):
    """Greedy pick, highest score first, keeping Manhattan distance >= min_gap from
    the other picks and >= taken_gap (default min_gap) from tiles already taken.
    quad_cap limits picks plus taken tiles per quadrant round `centre`."""
    out = []
    if n <= 0:
        return out
    tg = min_gap if taken_gap is None else taken_gap
    dist = lambda p, q: abs(p[0] - q[0]) + abs(p[1] - q[1])
    quad = lambda p: (p[0] > centre[0], p[1] > centre[1])
    for p in sorted(pool, key=lambda p: -score(p)):
        if quad_cap is not None and sum(quad(q) == quad(p) for q in out + taken) >= quad_cap:
            continue
        if all(dist(p, q) >= min_gap for q in out) and all(dist(p, q) >= tg for q in taken):
            out.append(p)
            if len(out) == n:
                break
    return out


def auto_candidates(rows, n_keys=11, n_boxes=24, n_box_top=3, n_switch=6, n_road_keys=5, key_gap=7,
                    wall_cap=2, fixed_keys=(), road_cap=3, box_gap=5, switch_gap=12,
                    key_filter=None, switch_filter=None, keys_on_dead_ends=True, box_filter=None):
    """Stamp key / item-box / switch markers onto a finished terrain.

    Keys go on the dead ends that take longest to walk to (fixtures respected,
    no hammer): n_keys - n_road_keys on wall tops (at most wall_cap per quadrant),
    the rest on the road (at most 3 per quadrant). fixed_keys are (x, y, 'r'|'w')
    placed first. Boxes and switches are spread over straight corridor tiles.
    key_filter(x, y, layer), switch_filter(x, y) and box_filter(x, y) (road boxes)
    restrict where those may go.
    keys_on_dead_ends=False lets keys sit anywhere (small loopy maps have few dead ends)."""
    m = Map(rows)
    m.check(verbose=False)
    d = m.fwd
    centre = (m.cx, m.cy)
    entries = m.entries()
    g = [list(r) for r in rows]
    free = lambda x, y: (0 < x < m.w - 1 and 0 < y < m.h - 1 and g[y][x] in ".#" and (x, y) not in entries
                         and not any(m.cell(x + a, y + b) == "T" for a, b in D4))
    deg = lambda x, y, layer: sum(1 for _ in m.moves(x, y, layer, True))
    road = sorted((x, y) for (x, y, l) in d if l == "r" and m.cell(x, y) == "." and free(x, y))
    top = sorted((x, y) for (x, y, l) in d if l == "w" and m.cell(x, y) == "#" and free(x, y))
    road_ends = [p for p in road if deg(*p, "r") == 1 or not keys_on_dead_ends]
    top_ends = [p for p in top if deg(*p, "w") == 1 or not keys_on_dead_ends]
    if key_filter:
        road_ends = [p for p in road_ends if key_filter(p[0], p[1], "r")]
        top_ends = [p for p in top_ends if key_filter(p[0], p[1], "w")]

    keys = list(fixed_keys)
    kw = spread_pick(top_ends, n_keys - n_road_keys, key_gap, lambda p: d[(p[0], p[1], "w")],
                     [(k[0], k[1]) for k in keys], quad_cap=wall_cap, centre=centre)
    keys += [(x, y, "w") for x, y in kw]
    kr = spread_pick(road_ends, n_keys - len(keys), key_gap, lambda p: d[(p[0], p[1], "r")],
                     [(k[0], k[1]) for k in keys], quad_cap=road_cap, centre=centre)
    keys += [(x, y, "r") for x, y in kr]
    taken = [(k[0], k[1]) for k in keys]

    corridor = [p for p in road if deg(*p, "r") == 2 and p not in taken]
    rnd = random.Random(7)
    box_pool = [p for p in corridor if box_filter(*p)] if box_filter else corridor
    boxes = spread_pick(box_pool, n_boxes - n_box_top, box_gap, lambda p: rnd.random(), taken, 3)
    taken += boxes
    box_tops = spread_pick([p for p in top if p not in taken], n_box_top, 8, lambda p: rnd.random(), taken, 3)
    taken += box_tops
    sw_pool = [p for p in corridor if p not in taken and any(m.cell(p[0] + a, p[1] + b) == "#" for a, b in D4)]
    if switch_filter:
        sw_pool = [p for p in sw_pool if switch_filter(*p)]
    switches = spread_pick(sw_pool, n_switch, switch_gap, lambda p: rnd.random(), taken, 2)

    for x, y, layer in keys:
        g[y][x] = "K" if layer == "r" else "k"
    for x, y in boxes:
        g[y][x] = "B"
    for x, y in box_tops:
        g[y][x] = "b"
    for x, y in switches:
        g[y][x] = "L"
    return ["".join(r) for r in g]


# ------------------------------------------------------------------ output
def key_report(rows):
    m = Map(rows)
    m.check(verbose=False)
    out = []
    for y in range(m.h):
        for x in range(m.w):
            r = m.raw(x, y)
            if r in "Kk":
                out.append((m.fwd.get((x, y, "r" if r == "K" else "w")), x, y, "road" if r == "K" else "wallTop"))
    out.sort(key=lambda t: -(t[0] or 0))
    print("keys, steps from the tower:", ", ".join(f"({x},{y} {l}) {s}" for s, x, y, l in out))


def ruler(rows):
    print("    " + "".join(str(x // 10) for x in range(len(rows[0]))))
    print("    " + "".join(str(x % 10) for x in range(len(rows[0]))))
    for y, r in enumerate(rows):
        print(f"{y:3} {r}")


def render(rows, png):
    """Top-down preview. Same colour = one connected wall top; a white dot means
    that region is reachable by stairs."""
    m = Map(rows)
    comp = m.wall_components()
    sizes = {}
    for v in comp.values():
        sizes[v] = sizes.get(v, 0) + 1
    m.check(verbose=False)
    reach = {comp[(x, y)] for (x, y, l) in m.fwd if l == "w" and (x, y) in comp}
    big = sorted([k for k in sizes if sizes[k] > 1], key=lambda k: -sizes[k])
    pal = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#008080", "#9a6324"]
    s = 18
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{m.w*s}" height="{m.h*s+20}"><rect width="100%" height="100%" fill="#222"/>']
    for y in range(m.h):
        for x in range(m.w):
            c = m.cell(x, y)
            X, Y = x * s, y * s
            if c == "#":
                k = comp[(x, y)]
                col = "#555" if sizes[k] == 1 else ("#7a7a7a" if k == big[0] else pal[big.index(k) % len(pal)])
            else:
                col = {".": "#d8cfb8", "T": "#c9a227", "S": "#2e8b57", "=": "#1e90ff"}.get(c, "#000")
            o.append(f'<rect x="{X}" y="{Y}" width="{s}" height="{s}" fill="{col}" stroke="#222" stroke-width="0.5"/>')
            if c == "#" and comp[(x, y)] in reach:
                o.append(f'<circle cx="{X+s/2}" cy="{Y+s/2}" r="2" fill="#fff" opacity="0.6"/>')
            r = m.raw(x, y)
            if c in "S=":
                o.append(f'<text x="{X+4}" y="{Y+14}" font-size="13" fill="#fff" font-family="monospace">{c}</text>')
            if r in "KkBbL":
                fill = {"K": "#ffd700", "k": "#ffd700", "B": "#c0392b", "b": "#c0392b", "L": "#00e5ff"}[r]
                o.append(f'<circle cx="{X+s/2}" cy="{Y+s/2}" r="6" fill="{fill}" stroke="#000"/>')
                o.append(f'<text x="{X+5}" y="{Y+13}" font-size="10" font-weight="bold" fill="#000" font-family="monospace">{r}</text>')
            if r in "OoAa":
                fill = "#8b4513" if r in "Oo" else "#ff00aa"
                o.append(f'<rect x="{X+3}" y="{Y+3}" width="{s-6}" height="{s-6}" fill="{fill}" stroke="#000"/>')
                o.append(f'<text x="{X+5}" y="{Y+13}" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">{r}</text>')
            if r in DOORS:
                dx, dy = DOORS[r]
                cx, cy = X + s / 2, Y + s / 2
                o.append(f'<line x1="{cx-dx*6}" y1="{cy-dy*6}" x2="{cx+dx*6}" y2="{cy+dy*6}" stroke="#6a0dad" stroke-width="3"/>')
                o.append(f'<circle cx="{cx+dx*6}" cy="{cy+dy*6}" r="3" fill="#6a0dad"/>')
    for x in range(0, m.w, 5):
        o.append(f'<text x="{x*s+2}" y="{m.h*s+15}" font-size="11" fill="#aaa">{x}</text>')
    o.append("</svg>")
    png = Path(png)
    png.parent.mkdir(parents=True, exist_ok=True)
    svg = png.with_suffix(".svg")
    svg.write_text("".join(o))
    subprocess.run(["rsvg-convert", str(svg), "-o", str(png)], check=True)
    svg.unlink()


def load_rows(map_id):
    return json.loads((MAPS_DIR / f"{map_id}.json").read_text())["rows"]


def write_map(map_id, rows, time=240, participants=(2, 3, 4, 5, 6), switches=4, boxes=12, difficulty="hard", theme="stone", modes=None):
    d = {"id": map_id, "name": map_id.replace("maze-", "Maze ").replace("night-", "Night "), "theme": theme}
    if difficulty is not None:
        d["difficulty"] = difficulty
    if modes is not None:
        d["modes"] = list(modes)
    d.update({"supportedParticipants": list(participants), "plazaRadius": 1, "timeLimitSec": time,
              "lightSwitchCount": switches, "itemBoxCount": boxes, "rows": rows})
    (MAPS_DIR / f"{map_id}.json").write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
