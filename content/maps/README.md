# Maps

Hand-made, pre-validated maps. One JSON file per map.

The data format is `MapData` in `packages/sim/src/map/types.ts`; the cell codes are
documented there. Run `npm run validate-maps` before adding a map to a pool.

Phase-0 draft cell codes:

| Code | Meaning |
| --- | --- |
| `X` | void, never walkable |
| `.` | road |
| `#` | wall; its top is walkable |
| `S` | stairs, the only place a player changes layer |
| `=` | bridge over a road cell |
| `T` | central tower footprint |
