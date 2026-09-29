"""maze-04 "Citadel": a walled keep round the tower (rampart top is a loop, the four
gates are bridges), a moat road, and four themed zones in a pinwheel:
north labyrinth, east concentric rings with a rooftop escape from the core,
south street ladder under a rooftop maze, west pillar hall.
Everything here is placed by hand; only the labyrinth is carved from a seed."""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import save  # noqa: E402

c = mk.Canvas()
put, hline, vline = c.put, c.hline, c.vline

# keep: tower, plaza ring, rampart gates (bridges), moat ring
hline(19, 23, 13); hline(19, 23, 17); vline(19, 13, 17); vline(23, 13, 17)
for y in range(14, 17):
    for x in range(20, 23):
        put(x, y, "T")
hline(17, 25, 11); hline(17, 25, 19); vline(17, 11, 19); vline(25, 11, 19)


def dfs_maze(x0, x1, y0, y1, seed, extra_loops):
    """The labyrinth's own carver (kept as is so the map regenerates identically)."""
    rnd = random.Random(seed)
    for y in range(y0, y1 + 1, 2):
        for x in range(x0, x1 + 1, 2):
            put(x, y)
    seen = {(x0, y0)}
    stack = [(x0, y0)]
    while stack:
        cx, cy = stack[-1]
        nbrs = [(cx + dx, cy + dy) for dx, dy in [(2, 0), (-2, 0), (0, 2), (0, -2)]
                if x0 <= cx + dx <= x1 and y0 <= cy + dy <= y1 and (cx + dx, cy + dy) not in seen]
        if not nbrs:
            stack.pop()
            continue
        nx, ny = rnd.choice(nbrs)
        put((cx + nx) // 2, (cy + ny) // 2)
        seen.add((nx, ny))
        stack.append((nx, ny))
    walls = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if (x + y) % 2 == 1 and c.get(x, y) == "#"]
    for x, y in rnd.sample(walls, extra_loops):
        put(x, y)


# north (x1..25 y1..9): labyrinth
dfs_maze(1, 25, 1, 9, seed=4, extra_loops=4)

# east (x27..41 y1..19): concentric rings, one gap per wall ring on alternating sides
for x0, x1, y0, y1 in [(27, 41, 1, 19), (29, 39, 3, 17), (31, 37, 5, 15), (33, 35, 7, 13)]:
    c.rect(x0, x1, y0, y1)
vline(34, 8, 12, "#")  # the core
for x, y in [(40, 11), (30, 5), (34, 14)]:
    put(x, y)

# south (x17..41 y21..29): street ladder; gaps split the wall rows into rooftop segments
for y in (21, 23, 25, 27, 29):
    hline(17, 41, y)
vline(17, 21, 29); vline(41, 21, 29)
for x, y in [(27, 22), (35, 22), (23, 24), (31, 24), (39, 24), (27, 26), (21, 28), (33, 28)]:
    put(x, y)

# west (x1..15 y11..29): pillar hall with a few wall runs
for y in range(11, 30):
    for x in range(1, 16):
        if not (x % 2 == 0 and y % 2 == 0):
            put(x, y)
for x, y in [(3, 12), (4, 13), (5, 12), (9, 14), (10, 13), (11, 14), (12, 13),
             (3, 18), (3, 20), (4, 21), (5, 22), (7, 22),
             (12, 19), (13, 18), (11, 20), (12, 23), (13, 24), (12, 25),
             (5, 26), (6, 27), (7, 26), (9, 28), (10, 27), (11, 26), (14, 15), (2, 25)]:
    put(x, y, "#")

# zone links (A-D, A-B, B-C, D-C) and moat exits
for x, y in [(7, 10), (26, 5), (35, 20), (16, 25), (19, 10), (26, 13), (23, 20), (16, 17)]:
    put(x, y)

STAIRS = [(19, 11), (23, 19),  # moat -> rampart
          (34, 13),  # ring core
          (27, 23),  # rooftop maze
          (1, 19), (9, 5), (11, 15), (15, 21)]
BRIDGES = [(21, 12), (21, 18), (18, 15), (24, 15),  # rampart gates
           (17, 13), (25, 17),  # moat crossings
           (33, 10), (31, 11), (29, 7), (27, 9),  # rings: core -> outward
           (25, 23), (19, 21), (29, 25), (37, 27), (35, 25), (33, 23),  # rooftop maze
           (7, 10), (26, 5)]  # join the north rooftops
for x, y in STAIRS:
    put(x, y, "S")
for x, y in BRIDGES:
    put(x, y, "=")

# candidates, placed by hand; keys where the walk is longest
KEYS = [(1, 1), (13, 5), (35, 10), (37, 5), (34, 8), (40, 12), (20, 10), (40, 28), (16, 2), (16, 26), (24, 8)]
BOXES = [(3, 1), (11, 3), (19, 3), (7, 7), (13, 9), (23, 1), (27, 3), (41, 15), (33, 3), (29, 11), (37, 11),
         (21, 23), (37, 23), (23, 27), (31, 29), (5, 13), (13, 17), (3, 23), (7, 29), (13, 21), (25, 13),
         (12, 6), (22, 22), (36, 18)]
SWITCHES = [(9, 3), (33, 1), (41, 9), (27, 29), (1, 25), (17, 11)]
marks = []
for spots, road, top in [(KEYS, "K", "k"), (BOXES, "B", "b"), (SWITCHES, "L", None)]:
    for x, y in spots:
        marks.append((x, y, road if c.get(x, y) == "." else top))
save("maze-04", mk.stamp(c.rows(), marks), time=240)
