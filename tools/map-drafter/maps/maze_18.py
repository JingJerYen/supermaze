"""maze-18 "Spokes" (easy, factory): a ring road round the outside and four
straight spokes from the tower gates out to it, with short side mazes between
them. Hard to get lost: every spoke leads home. Keys mostly on the ground."""
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
c.maze(cells, seed=18, loops=4, start=(1, 1))
c.rect(1, 21, 1, 13)  # the ring
c.vline(cx, 1, cy - 2)  # spokes
c.vline(cx, cy + 2, 13)
c.hline(1, cx - 2, cy)
c.hline(cx + 2, 21, cy)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-18", rows)
    sys.exit()

finish("maze-18", rows,
       stairs=[(3, 7), (7, 3), (19, 3), (19, 11)],  # one in each quarter; one key on a rooftop
       doors=0, traps=0, obstacles=0, time=180,
       candidates=dict(n_keys=8, n_road_keys=7, n_boxes=10, n_box_top=0, n_switch=4, key_gap=4, wall_cap=1,
                       road_cap=3, box_gap=4, switch_gap=8, keys_on_dead_ends=False,
                       key_filter=lambda x, y, layer: abs(x - cx) + abs(y - cy) >= 7),
       meta=dict(difficulty="easy", boxes=6, switches=2, theme="factory"))
