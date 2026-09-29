"""The shared last step of every generated map: stairs, bridges and hand-placed
fixtures, then automatic fixtures and candidates, a check, the JSON and a preview."""
import sys

import mapkit as mk
from fixtures import place


def finish(map_id, rows, stairs=(), bridges=(), manual=(), doors=4, traps=4, obstacles=2, fseed=1,
           time=240, candidates=None):
    rows = mk.stamp(rows, [(x, y, "S") for x, y in stairs] + [(x, y, "=") for x, y in bridges] + list(manual))
    errs = mk.Map(rows).check(verbose=False)
    if errs:
        sys.exit(f"{map_id}: terrain is not valid before fixtures:\n  " + "\n  ".join(errs))
    rows = place(rows, doors, traps, obstacles, fseed)
    rows = mk.auto_candidates(rows, **(candidates or {}))
    save(map_id, rows, time)
    return rows


def save(map_id, rows, time):
    """Check, report, write content/maps/<id>.json and out/<id>.png."""
    print(f"== {map_id}")
    if mk.Map(rows).check():
        sys.exit(1)
    mk.key_report(rows)
    mk.write_map(map_id, rows, time=time)
    png = mk.OUT_DIR / f"{map_id}.png"
    mk.render(rows, png)
    print(f"wrote content/maps/{map_id}.json and {png.relative_to(mk.REPO)}")
