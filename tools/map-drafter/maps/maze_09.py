"""maze-09 "Dark alleys": a dense maze of short dead ends in the middle, and
an outer alley running round the edge that holds every light switch. Six
switches a round, so the lights go out three times; keys hide in the dead
ends, where finding your way back in the dark is the hard part."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(31, 23)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
inner = [(x, y) for y in range(3, 20, 2) for x in range(3, 28, 2) if not plaza(x, y)]
c.maze(inner, seed=9, loops=2, start=(3, 3), algo="prim")
c.rect(1, 29, 1, 21)  # the outer alley
for x, y in [(2, 7), (28, 15), (19, 2), (11, 20)]:  # four ways between alley and maze
    c.put(x, y)
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates
    c.put(x, y)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-09", rows)
    sys.exit()

in_alley = lambda x, y: x in (1, 29) or y in (1, 21)
finish("maze-09", rows,
       stairs=[(19, 1), (27, 5), (11, 17), (5, 3)],
       doors=0, traps=3, obstacles=1, fseed=9, time=210,
       candidates=dict(n_keys=8, n_road_keys=5, n_boxes=14, n_box_top=2, n_switch=10, key_gap=8, road_cap=3,
                       switch_gap=8, key_filter=lambda x, y, layer: not in_alley(x, y),
                       switch_filter=in_alley),
       meta=dict(difficulty="medium", boxes=8, switches=6))
