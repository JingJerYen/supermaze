import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@supermaze/protocol";
import { MazeRoom } from "./room.js";

/**
 * Authoritative game server. Colyseus provides rooms, matchmaking and
 * reconnection; the simulation lives in @supermaze/sim and knows nothing
 * about the transport.
 */
const PORT = Number(process.env["PORT"] ?? 2567);

const server = new Server({
  transport: new WebSocketTransport(),
});
// Quick matching only joins quick rooms; private rooms are found by their code.
server.define(ROOM_NAME, MazeRoom).filterBy(["mode", "metadata.code"]);

await server.listen(PORT);
console.log(`[server] listening on ws://localhost:${PORT} (room "${ROOM_NAME}")`);
