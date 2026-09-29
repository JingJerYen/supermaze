"""maze-06 "Whirlpool": a depth-first maze that strongly prefers to follow the
square rings round the tower, so corridors circle it; the wide map leaves long
vertical corridors on both sides. Many one-way doors."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import finish  # noqa: E402

c = mk.Canvas()
c.tower()
ring = lambda p: max(abs(p[0] - c.cx), abs(p[1] - c.cy))
cells = [(x, y) for y in range(1, 30, 2) for x in range(1, 42, 2) if ring((x, y)) > 2]
c.maze(cells, seed=1, bias=lambda a, b: 12 if ring(a) == ring(b) else 1, loops=10, start=(1, 1))
for x, y in [(21, 12), (21, 18), (18, 15), (24, 15)]:
    c.put(x, y)

finish("maze-06", c.rows(),
       stairs=[(3, 5), (41, 19), (15, 29), (37, 15), (21, 9), (25, 23)],
       doors=8, traps=4, obstacles=4, fseed=1, time=300)
