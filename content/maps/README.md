# Maps

Hand-made, pre-validated maps. One JSON file per map.

The data format is `MapData` in `packages/sim/src/map/types.ts`; the cell codes are
documented there. Run `npm run validate-maps` before adding a map to a pool.

Rules every map must satisfy (checked by the validator):

- The outer ring is wall (`#`), never void.
- Corridors are exactly one tile wide and walls one tile thick: no 2x2 block that is
  fully walkable on the road layer or fully walkable on the wall-top layer, except
  within `plazaRadius` of the tower footprint.
- Stairs (`S`) have exactly one adjacent wall (the side they rise toward) and road on
  the opposite side. Bridges (`=`) join two walls on opposite sides with road passing
  underneath on the other two.
- Every road cell and every stairs is reachable from the tower; every key spawn is
  walkable on its layer, reachable, unique, and not on a tower-entry tile; there are
  at least as many key spawns as the largest supported participant count.

Drawing convention: odd map sizes with junctions on odd coordinates and walls or gaps
on even coordinates keep corridors one tile wide automatically. Maps are played in
any of four rotations (`rotateMap`), so no direction is privileged.

Cell codes:

| Code | Meaning |
| --- | --- |
| `X` | void, never walkable |
| `.` | road |
| `#` | wall; its top is walkable |
| `S` | stairs, the only place a player changes layer |
| `=` | bridge over a road cell |
| `T` | central tower footprint |
| `K` `B` `L` | road cell that is a key / item-box / light-switch spawn candidate |
| `k` `b` `l` | wall cell whose top is a key / item-box / light-switch spawn candidate |

Markers are authoring sugar: `normalizeMap` turns them into `spawns` entries and plain
cells. An explicit `spawns` list is still accepted and may be mixed with markers.
See `AUTHORING.md` (Chinese) for the full guide.
