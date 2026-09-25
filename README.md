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
| `content/maps` | Hand-made map data. |

## Commands

```bash
npm install
npm run dev:client      # Vite dev server
npm run dev:server      # headless simulation loop
npm test                # Vitest across workspaces
npm run typecheck
npm run validate-maps
```
