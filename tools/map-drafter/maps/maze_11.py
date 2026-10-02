"""maze-11 "Garden": a small, loopy maze with no fixtures. Most keys are on the
ground and near; a couple sit on wall tops so new players learn the stairs."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(23, 15)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
cells = [(x, y) for y in range(1, 14, 2) for x in range(1, 22, 2) if not plaza(x, y)]
c.maze(cells, seed=11, loops=16, start=(1, 1))
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates
    c.put(x, y)
rows = c.rows()

# One in each quarter: two onto small islands, one onto the outer wall, one onto a south-east island.
STAIRS = [(5, 5), (17, 5), (5, 11), (17, 11)]

if "--explore" in sys.argv:
    explore("maze-11", rows)
    sys.exit()

finish("maze-11", rows,
       stairs=STAIRS,
       doors=0, traps=0, obstacles=0, time=180,
       candidates=dict(n_keys=8, n_road_keys=6, n_boxes=10, n_box_top=1, n_switch=4, key_gap=4, wall_cap=1,
                       road_cap=3, box_gap=4, switch_gap=8,
                       keys_on_dead_ends=False,
                       # Rooftop keys close to a stair, so they stay a short climb.
                       key_filter=lambda x, y, layer: min(abs(x - sx) + abs(y - sy) for sx, sy in STAIRS) <= 3
                       if layer == "w" else abs(x - cx) + abs(y - cy) >= 8),
       meta=dict(difficulty="easy", boxes=6, switches=2, theme="garden"))
