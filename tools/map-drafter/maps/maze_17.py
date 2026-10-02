"""maze-17 "Glacier": long east-west crevasses with few ways between them, so
the way out to the far rows is a long zigzag. Here and there an ice slide (a
fixed one-way door) drops you a row closer to the tower: slow going out,
fast coming back, and a gamble in a ghost event, because a slide only runs
one way."""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(31, 23)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
cells = [(x, y) for y in range(1, 22, 2) for x in range(1, 30, 2) if not plaza(x, y)]
# Long horizontal runs: a step east or west is far likelier than north or south.
c.maze(cells, seed=17, bias=lambda a, b: 9 if a[1] == b[1] else 1, loops=3, start=(1, 1))
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates
    c.put(x, y)
rows = c.rows()

# Ice slides: walls between two crevasses, away from the middle rows, turned
# into one-way doors pointing toward the tower's row.
grid = mk.Map(rows)
spots = [(x, y) for y in range(2, 21, 2) for x in range(3, 28, 2)
         if abs(y - cy) >= 3 and rows[y][x] == "#" and rows[y - 1][x] == "." and rows[y + 1][x] == "."]
rnd = random.Random(170)
slides = []
for x, y in rnd.sample(spots, len(spots)):
    if len(slides) < 8 and all(abs(x - a) + abs(y - b) > 7 for a, b, _ in slides):
        slides.append((x, y, "v" if y < cy else "^"))

if "--explore" in sys.argv:
    explore("maze-17", rows)
    print("slides:", slides)
    sys.exit()

finish("maze-17", rows,
       stairs=[(7, 3), (29, 7), (1, 17), (21, 15), (21, 9), (11, 11)],
       manual=slides,
       doors=0, traps=2, obstacles=1, fseed=17, time=210,
       candidates=dict(n_keys=8, n_road_keys=4, n_boxes=14, n_box_top=2, n_switch=6, key_gap=6, wall_cap=2, road_cap=2),
       meta=dict(difficulty="medium", boxes=8, switches=4, theme="ice"))
