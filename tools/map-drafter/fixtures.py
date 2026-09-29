"""Automatic fixture placement that keeps a map fair: after every door or obstacle
the whole map is rechecked, so nothing that was reachable becomes unreachable and
no one-way door can trap a player. Obstacles therefore only land where a detour
exists (they block shortcuts, never the only way)."""
import random

from mapkit import D4, DOOR_CHAR, Map


def corridor_cells(rows, keep_clear=4):
    """Straight one-wide corridor tiles (road on two opposite sides, wall on the
    other two), away from the tower. Returns (x, y, axis direction)."""
    m = Map(rows)
    out = []
    for y in range(m.h):
        for x in range(m.w):
            if rows[y][x] != ".":
                continue
            if abs(x - m.cx) <= keep_clear and abs(y - m.cy) <= keep_clear:
                continue
            ns = [(dx, dy) for dx, dy in D4 if m.cell(x + dx, y + dy) in ".S="]
            walls = [(dx, dy) for dx, dy in D4 if m.cell(x + dx, y + dy) == "#"]
            if len(ns) == 2 and len(walls) == 2 and ns[0] == (-ns[1][0], -ns[1][1]):
                if all(m.cell(x + dx, y + dy) == "." for dx, dy in ns):
                    out.append((x, y, ns[0]))
    return out


def place(rows, n_doors, n_traps, n_obstacles, seed, gap=6):
    """Place up to n_doors one-way doors, n_obstacles obstacles and n_traps traps,
    at least `gap` tiles apart. Fewer are placed when no fair spot is left."""
    rnd = random.Random(seed)
    g = [list(r) for r in rows]
    cells = corridor_cells(rows)
    rnd.shuffle(cells)
    placed = []

    def reach(test_rows):
        m = Map(test_rows)
        errs = m.check(verbose=False)
        return errs, set(m.fwd)

    _, base = reach(rows)

    def fair(test_rows, x, y):
        errs, r = reach(test_rows)
        return not errs and base - {(x, y, "r")} <= r

    for kind, n in [("door", n_doors), ("obstacle", n_obstacles), ("trap", n_traps)]:
        count = 0
        for x, y, (dx, dy) in cells:
            if count == n:
                break
            if g[y][x] != "." or not all(abs(x - a) + abs(y - b) >= gap for a, b in placed):
                continue
            if kind == "trap":
                g[y][x] = "A"
            elif kind == "obstacle":
                g[y][x] = "O"
            else:
                if rnd.random() < 0.5:
                    dx, dy = -dx, -dy
                g[y][x] = DOOR_CHAR[(dx, dy)]
            if kind != "trap" and not fair(["".join(r) for r in g], x, y):
                g[y][x] = "."
                continue
            placed.append((x, y))
            count += 1
    return ["".join(r) for r in g]
