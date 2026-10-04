"""night-03 (night parade only, theme desert): a 29x17 braided maze with no dead
ends at all, so a chased player can always go round a ghost (CLAUDE.md 4.4).
Ground only: no stairs, so the key, the boxes and the switch are on the road."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(29, 17)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
cells = [(x, y) for y in range(1, 17 - 1, 2) for x in range(1, 29 - 1, 2) if not plaza(x, y)]
c.maze(cells, seed=303, loops=4, start=(1, 1))
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates
    c.put(x, y)
c.braid(cells, seed=303)
rows = c.rows()

if "--explore" in sys.argv:
    explore("night-03", rows)
    sys.exit()

finish("night-03", rows,
       doors=0, traps=0, obstacles=0, time=480,
       candidates=dict(n_keys=6, n_road_keys=6, n_boxes=12, n_box_top=0, n_switch=4, key_gap=5, wall_cap=0,
                       road_cap=3, box_gap=4, switch_gap=8, keys_on_dead_ends=False,
                       key_filter=lambda x, y, layer: abs(x - cx) + abs(y - cy) >= 8),
       meta=dict(difficulty=None, modes=["night"], participants=(1,), boxes=8, switches=2, theme="desert"))
