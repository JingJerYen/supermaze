# Super Maze / Maze Tower

Competitive multiplayer maze racing game for the web. See `CLAUDE.md` for the full
design spec, technical decisions (section 17) and development phases (section 18).

## Layout

| Path | Purpose |
| --- | --- |
| `packages/sim` | Authoritative game rules. Pure TypeScript, deterministic, no runtime dependencies. |
| `packages/protocol` | Client/server message types. |
| `apps/client` | Three.js + Vite browser client. Renders state, sends input intents. |
| `apps/server` | Node.js authoritative server. Runs the simulation each tick. |
| `tools/map-validator` | Validates hand-made maps in `content/maps/`. |
| `tools/net-spike` | Scripted clients: load, snapshot cadence and reconnection checks against a running server. |
| `content/maps` | Hand-made map data. |

## Commands

```bash
npm install
npm run dev             # game server (:2567) + Vite dev server (:5173) together
npm run dev:client      # Vite dev server only (local single-player by default)
npm run dev:server      # Colyseus server only
npm run spike:net       # 6 bots + reconnection checks; needs the server running
npm test                # Vitest across workspaces
npm run typecheck
npm run validate-maps
```

Add `?server=ws://host:2567` to point the client at another machine.

## Where the knobs are

| What | File | Notes |
| --- | --- | --- |
| Game balance: round length, tick rate, team limits, movement speed, key/box counts per participant, item draw weights, darkness radii, placeable lifetimes, ghost event timings, scores and the winner multiplier, reconnect window | `packages/sim/src/tuning/defaults.ts` | Plain numbers; types and units in `tuning/types.ts`. Never hard-coded elsewhere. |
| Per-map: layout, tower plaza radius, number of light switches, candidate tiles for keys, item boxes and light switches, supported player counts | `content/maps/<id>.json` | Rules in `content/maps/README.md`; run `npm run validate-maps` after editing. |
| Per-round draw: which candidates become keys, boxes and switches; map orientation | round seed | Deterministic. Server: seed per room. Sandbox: `?seed=N`, `?rot=0..3`. |
| Feel: camera height/distance/FOV/smoothing, tower proportions, key beam, darkness look, pixel ratio cap, frame delta clamp | `apps/client/src/tuning.ts` | Client only; never affects rules. |
| Real models | `apps/client/public/models/*.glb` + manifest in `apps/client/src/render/models.ts` | Drop `key.glb` / `box.glb` in; missing files fall back to placeholders in `render/assets.ts`. |

Opening `http://localhost:5173/` shows the home screen: quick match, create a private
room, or join one by its four-letter code. Several tabs or devices on the LAN can share
a room. Press F3 in game for the developer status panel, F4 to force a ghost-tag event (server honours it unless started with `SUPERMAZE_DEBUG=0`).

Sandbox: `http://localhost:5173/?local` runs the single-player simulation in the page
with no server. Extra parameters: `players=N` pretends N participants (idle CPUs) so
keys and boxes are drawn as in a real round; `seed=N` fixes the draw; `rot=0..3` picks
the map orientation; `map=<id>` picks a map; `name=<nick>` sets your display name
(also used online; otherwise remembered from last time).
