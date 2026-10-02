"""maze-19 "Frozen Lake" (easy, ice): one small maze mirrored into four equal
quarters, so what you learn in one quarter holds in the others. The quarters
share the middle lines; stairs in two opposite quarters and a bridge teach
wall tops. Keys mostly on the ground."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

W, H = 23, 15
c = mk.Canvas(W, H)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
# One quarter, up to and including the middle column and row, carved and then
# mirrored; the middle lines are shared, which joins the four quarters.
quarter = [(x, y) for y in range(1, cy + 1, 2) for x in range(1, cx + 1, 2) if not plaza(x, y)]
c.maze(quarter, seed=19, loops=3, start=(1, 1))
for y in range(cy + 1):
    for x in range(cx + 1):
        v = c.get(x, y)
        c.put(W - 1 - x, y, v)
        c.put(x, H - 1 - y, v)
        c.put(W - 1 - x, H - 1 - y, v)
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates
    c.put(x, y)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-19", rows)
    sys.exit()

finish("maze-19", rows,
       stairs=[(7, 3), (15, 3), (7, 11), (15, 11)],  # one onto each quarter's rooftop
       bridges=[(11, 4)],  # over the north plaza gate, joining the two north rooftops
       doors=0, traps=0, obstacles=0, time=180,
       candidates=dict(n_keys=8, n_road_keys=6, n_boxes=10, n_box_top=1, n_switch=4, key_gap=4, wall_cap=1,
                       road_cap=3, box_gap=4, switch_gap=8, keys_on_dead_ends=False,
                       key_filter=lambda x, y, layer: abs(x - cx) + abs(y - cy) >= 7),
       meta=dict(difficulty="easy", boxes=6, switches=2, theme="ice"))
