"""maze-07 "Four keeps": a street maze round the tower and a walled keep in each
corner, each sealed a different way:
  NW  its only gate is blocked by an obstacle (hammer, or in over the rooftop)
  NE  its gate is a one-way door inward; the way out is up onto the rooftop
  SE  no gate at all; in and out only over the rooftop
  SW  two gates, a trap in each
Road keys sit in the keeps; outside them keys are on wall tops only."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import finish  # noqa: E402

KEEPS = {"NW": (2, 14, 2, 12), "NE": (28, 40, 2, 12), "SW": (2, 14, 18, 28), "SE": (28, 40, 18, 28)}
inside = lambda p, k: k[0] < p[0] < k[1] and k[2] < p[1] < k[3]

c = mk.Canvas()
c.tower()
city = [(x, y) for y in range(1, 30, 2) for x in range(1, 42, 2)
        if not any(inside((x, y), k) for k in KEEPS.values()) and max(abs(x - c.cx), abs(y - c.cy)) > 2]
c.maze(city, seed=1, loops=12, start=(1, 1))
for i, k in enumerate(KEEPS.values()):
    cells = [(x, y) for y in range(k[2] + 1, k[3], 2) for x in range(k[0] + 1, k[1], 2)]
    c.maze(cells, seed=10 + i, loops=3, start=cells[0])
for x, y in [(21, 12), (21, 18), (18, 15), (24, 15)]:
    c.put(x, y)
for x, y in [(14, 7), (28, 9), (7, 18), (14, 23)]:  # keep gates
    c.put(x, y)

finish("maze-07", c.rows(),
       # inside NW / NE / SE keeps, onto the NE and SE keep walls from outside, then the main rooftop
       stairs=[(7, 9), (37, 9), (39, 25), (39, 15), (31, 15), (1, 17), (41, 13), (21, 1), (25, 27)],
       manual=[(14, 7, "O"), (28, 9, ">"), (7, 18, "A"), (14, 23, "A")],
       doors=4, traps=3, obstacles=3, fseed=1, time=240,
       candidates=dict(n_keys=12, n_road_keys=6, wall_cap=4,
                       fixed_keys=[(3, 3, "r"), (31, 3, "r"), (39, 23, "r"), (29, 25, "r"), (3, 27, "r"), (13, 27, "r")]))
