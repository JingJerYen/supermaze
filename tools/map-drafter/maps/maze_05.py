"""maze-05 "Deep labyrinth": one depth-first maze over the whole map, long
corridors and long dead ends, few loops, so the rooftop splits into three
separate networks with one to three stairs each."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import finish  # noqa: E402

c = mk.Canvas()
c.tower()
cells = [(x, y) for y in range(1, 30, 2) for x in range(1, 42, 2) if not (19 <= x <= 23 and 13 <= y <= 17)]
cells += [(19, 13), (21, 13), (23, 13), (19, 17), (21, 17), (23, 17), (19, 15), (23, 15)]
c.maze(cells, seed=3, loops=14, start=(1, 1))
# the carver may open the plaza ring anywhere: keep only the four exits on the door axes
for x, y in [(18, 13), (18, 17), (24, 13), (24, 17), (19, 12), (23, 12), (19, 18), (23, 18),
             (18, 14), (18, 16), (24, 14), (24, 16), (20, 12), (22, 12), (20, 18), (22, 18)]:
    c.put(x, y, "#")
for x, y in [(21, 12), (21, 18), (18, 15), (24, 15)]:
    c.put(x, y)

finish("maze-05", c.rows(),
       stairs=[(11, 1), (41, 7), (3, 29), (31, 5), (17, 25), (35, 23)],
       doors=5, traps=5, obstacles=3, fseed=2, time=300, meta=dict(theme="garden"))
