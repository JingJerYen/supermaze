"""maze-12 "Skyline": on the ground there is only a cross of sunken streets running
from the tower to the four map edges. Everything else is some twenty sealed
courtyards, each a small maze with a single stairway up. The streets cut the
rooftop into four districts joined by bridges, and one notch in each street arm
holds a stairway up into the district beside it. To reach any courtyard you go up,
cross the roofs and find its stairs; keys sit deep in the courtyards."""
import random
import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas()
c.tower()
cx, cy = c.cx, c.cy
c.vline(cx, 0, c.h - 1)  # the sunken streets, out through both map edges
c.hline(0, c.w - 1, cy)
for y in range(cy - 1, cy + 2):
    for x in range(cx - 1, cx + 2):
        c.put(x, y, "T")

# one notch per arm: a two-tile alcove beside the street makes a stairway legal there
NOTCHES = [((21, 5), (20, 5), (19, 5)), ((21, 25), (22, 25), (23, 25)),
           ((7, 15), (7, 16), (7, 17)), ((35, 15), (35, 14), (35, 13))]
notch_junctions = {n[2] for n in NOTCHES}

plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
junctions = {(x, y) for y in range(1, c.h - 1, 2) for x in range(1, c.w - 1, 2)
             if x != cx and y != cy and not plaza(x, y) and (x, y) not in notch_junctions}

# courtyards: grow regions from random seeds over the junction lattice (always connected)
rnd = random.Random(12)
seeds = rnd.sample(sorted(junctions), 22)
owner = {s: i for i, s in enumerate(seeds)}
q = deque(seeds)
while q:
    p = q.popleft()
    for dx, dy in [(2, 0), (-2, 0), (0, 2), (0, -2)]:
        n = (p[0] + dx, p[1] + dy)
        if n in junctions and n not in owner:
            owner[n] = owner[p]
            q.append(n)
yards = {}
for p, i in owner.items():
    yards.setdefault(i, []).append(p)
for i, cells in sorted(yards.items()):
    c.maze(cells, seed=1200 + i, start=min(cells))  # no loops: a loop would wall off a rooftop island
for street, passage, alcove in NOTCHES:
    c.put(*passage)
    c.put(*alcove)
rows = c.rows()


def stair_spots(m, i, chosen):
    """Legal stairway tiles inside courtyard i that rise onto a district rooftop
    (not a small wall island), not beside an already chosen one."""
    comp = m.wall_components()
    size = {}
    for v in comp.values():
        size[v] = size.get(v, 0) + 1
    spots = []
    for (x, y), j in sorted(owner.items()):
        if j != i:
            continue
        for tx, ty in [(x, y), (x + 1, y), (x, y + 1)]:
            if m.cell(tx, ty) != "." or owner.get((tx + tx % 2 - 1 if tx % 2 == 0 else tx, ty), i) != i:
                continue
            walls = [(dx, dy) for dx, dy in mk.D4 if m.cell(tx + dx, ty + dy) == "#"]
            if (len(walls) == 1 and m.cell(tx - walls[0][0], ty - walls[0][1]) == "."
                    and size[comp[(tx + walls[0][0], ty + walls[0][1])]] >= 60):
                side = [(tx + walls[0][1], ty + walls[0][0]), (tx - walls[0][1], ty - walls[0][0])]
                if not any(p in chosen for p in side):
                    spots.append((tx, ty))
    return spots


def yard_stairs():
    """One stairway per courtyard, chosen by seed. A courtyard too small for one is
    opened into a neighbouring courtyard and shares its stairway."""
    chosen, out = set(), []
    for i in sorted(yards):
        m = mk.Map(c.rows())
        spots = stair_spots(m, i, chosen)
        if not spots:
            a, b = next((p, (p[0] + dx, p[1] + dy)) for p in sorted(yards[i]) for dx, dy in [(2, 0), (-2, 0), (0, 2), (0, -2)]
                        if owner.get((p[0] + dx, p[1] + dy), i) != i)
            c.put((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)
            continue
        s = random.Random(1300 + i).choice(spots)
        chosen.add(s)
        out.append(s)
    return out


stairs = [n[0] for n in NOTCHES] + yard_stairs()
rows = c.rows()
bridges = [(21, 2), (21, 8), (21, 22), (21, 28), (2, 15), (12, 15), (30, 15), (40, 15)]

if "--explore" in sys.argv:
    explore("maze-12", mk.stamp(rows, [(x, y, "S") for x, y in stairs] + [(x, y, "=") for x, y in bridges]))
    sys.exit()

finish("maze-12", rows, stairs=stairs, bridges=bridges,
       doors=0, traps=3, obstacles=0, fseed=12, time=300,
       candidates=dict(n_keys=11, n_road_keys=7, key_gap=7, wall_cap=2, road_cap=3,
                       key_filter=lambda x, y, layer: x != cx and y != cy),
       meta=dict(theme="factory"))
